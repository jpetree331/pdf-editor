// Framework-free, but pdf.js-dependent: this module (and everything under
// lib/render) is the documented exception to "lib runs in plain Node" — it
// needs a browser. It owns all pdf.js document/page proxies; they are runtime
// handles tied to a worker port and must NEVER be stored in session state.
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { DocumentSessionState, PageState, SourceId } from '../core/types'
import { BLANK_SOURCE, totalRotation } from '../core/types'

let workerConfigured = false
export function configurePdfjsWorker(): void {
  if (workerConfigured) return
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  workerConfigured = true
}

const docCache = new Map<SourceId, Promise<PDFDocumentProxy>>()

export function getDocumentProxy(
  state: DocumentSessionState,
  sourceId: SourceId,
): Promise<PDFDocumentProxy> {
  let cached = docCache.get(sourceId)
  if (!cached) {
    configurePdfjsWorker()
    const source = state.sources[sourceId]
    if (!source) throw new Error(`Unknown source ${sourceId}`)
    // pdf.js TRANSFERS the buffer to its worker (detaching it) — always hand
    // it a copy so the session's source bytes stay intact for export.
    cached = pdfjs.getDocument({ data: source.bytes.slice() }).promise
    docCache.set(sourceId, cached)
  }
  return cached
}

export async function getPageProxy(
  state: DocumentSessionState,
  page: PageState,
): Promise<PDFPageProxy | null> {
  if (page.sourceId === BLANK_SOURCE) return null
  const doc = await getDocumentProxy(state, page.sourceId)
  return doc.getPage(page.sourcePageIndex + 1)
}

/** Destroy all cached proxies (call when a session is closed/replaced). */
export async function disposeAllProxies(): Promise<void> {
  const docs = [...docCache.values()]
  docCache.clear()
  await Promise.allSettled(
    docs.map(async (p) => (await p as unknown as { destroy(): Promise<void> }).destroy()),
  )
}

export interface RenderResult {
  cancel: () => void
  done: Promise<void>
}

/**
 * Render a page into a canvas at the given CSS-pixel scale, honoring total
 * rotation and devicePixelRatio. Blank pages paint white.
 */
export function renderPageToCanvas(
  pageProxy: PDFPageProxy | null,
  page: PageState,
  canvas: HTMLCanvasElement,
  scale: number,
): RenderResult {
  const dpr = Math.max(1, globalThis.devicePixelRatio || 1)
  const rotated = totalRotation(page) === 90 || totalRotation(page) === 270
  const cssW = (rotated ? page.baseSize.height : page.baseSize.width) * scale
  const cssH = (rotated ? page.baseSize.width : page.baseSize.height) * scale
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) return { cancel: () => {}, done: Promise.resolve() }

  if (!pageProxy) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return { cancel: () => {}, done: Promise.resolve() }
  }

  const viewport = pageProxy.getViewport({ scale: scale * dpr, rotation: totalRotation(page) })
  const task = pageProxy.render({ canvasContext: ctx, viewport, canvas })
  return {
    cancel: () => task.cancel(),
    done: task.promise.catch((err: unknown) => {
      // RenderingCancelledException is routine when scrolling/zooming fast.
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err
    }),
  }
}
