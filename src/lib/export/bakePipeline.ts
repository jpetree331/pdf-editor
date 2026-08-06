// Framework-free; runs inside the export worker (pdf-lib only, no DOM).
// The one-directional bake: virtual page list + overlays -> new PDF bytes.
//
// Two paths per page:
//  - Vector: copy the source page, set absolute rotation (/Rotate) and crop,
//    then draw overlays in the page's unrotated coordinate space — the same
//    space overlay rects are authored in, so no coordinate translation.
//  - Rasterized (page carries a redaction, or aggressive compression): the
//    main thread pre-rendered the page WITH overlays fused into pixels; here
//    it becomes a full-bleed JPEG on a fresh page. This is what makes
//    redaction real: the original content stream is discarded entirely.
import {
  BlendMode,
  PDFDocument,
  PDFFont,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib'
import type {
  DocumentSessionState,
  OverlayObject,
  PageId,
  TextOverlay,
} from '../core/types'
import { BLANK_SOURCE, totalRotation } from '../core/types'
import { wrapLines } from '../core/textWrap'
import { HIGHLIGHT_OPACITY } from '../../config/constants'

export interface RasterizedPage {
  jpeg: Uint8Array
  widthPt: number
  heightPt: number
}

export interface BakeInput {
  state: DocumentSessionState
  /** Pages replaced by pre-rendered images (redaction / aggressive compress). */
  rasterized: Record<PageId, RasterizedPage>
  /** Restrict output to these pages, in state order (extract/split). Omit = all. */
  pageIds?: PageId[]
}

export async function bakeDocument(
  input: BakeInput,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const { state, rasterized } = input
  const wanted = input.pageIds ? new Set(input.pageIds) : null
  const pages = state.pages.filter((p) => !wanted || wanted.has(p.id))
  if (pages.length === 0) throw new Error('Nothing to export — no pages selected.')

  const out = await PDFDocument.create()
  out.setTitle(state.meta.title)
  out.setProducer('PDF Editor (client-side)')

  // Load each referenced source once.
  const sourceDocs = new Map<string, PDFDocument>()
  for (const page of pages) {
    if (page.sourceId === BLANK_SOURCE || sourceDocs.has(page.sourceId)) continue
    if (rasterized[page.id]) continue // raster pages never touch their source here
    const source = state.sources[page.sourceId]
    if (!source) throw new Error(`Missing source document ${page.sourceId}`)
    sourceDocs.set(page.sourceId, await PDFDocument.load(source.bytes))
  }

  const fonts = {
    regular: await out.embedFont(StandardFonts.Helvetica),
    bold: await out.embedFont(StandardFonts.HelveticaBold),
  }
  const imageCache = new Map<OverlayObject, Awaited<ReturnType<PDFDocument['embedPng']>>>()

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const raster = rasterized[page.id]

    if (raster) {
      const outPage = out.addPage([raster.widthPt, raster.heightPt])
      const image = await out.embedJpg(raster.jpeg)
      outPage.drawImage(image, { x: 0, y: 0, width: raster.widthPt, height: raster.heightPt })
      onProgress?.((i + 1) / pages.length)
      continue
    }

    let outPage
    if (page.sourceId === BLANK_SOURCE) {
      outPage = out.addPage([page.baseSize.width, page.baseSize.height])
    } else {
      const srcDoc = sourceDocs.get(page.sourceId)!
      const [copied] = await out.copyPages(srcDoc, [page.sourcePageIndex])
      outPage = out.addPage(copied)
    }

    outPage.setRotation(degrees(totalRotation(page)))
    // Overlay/crop rects are relative to the page's view box; pdf-lib draws in
    // raw user space, so shift by the view-box origin.
    const origin = page.baseOrigin
    if (page.cropBox) {
      outPage.setCropBox(
        page.cropBox.x + origin.x,
        page.cropBox.y + origin.y,
        page.cropBox.width,
        page.cropBox.height,
      )
    }

    const overlays = [...(state.overlaysByPage[page.id] ?? [])].sort((a, b) => a.zIndex - b.zIndex)
    for (const overlay of overlays) {
      await drawOverlay(out, outPage, overlay, origin, fonts, imageCache)
    }
    onProgress?.((i + 1) / pages.length)
  }

  return out.save({ useObjectStreams: true })
}

type OutPage = Awaited<ReturnType<PDFDocument['addPage']>>

async function drawOverlay(
  doc: PDFDocument,
  page: OutPage,
  overlay: OverlayObject,
  origin: { x: number; y: number },
  fonts: { regular: PDFFont; bold: PDFFont },
  imageCache: Map<OverlayObject, Awaited<ReturnType<PDFDocument['embedPng']>>>,
): Promise<void> {
  const rect = {
    x: overlay.rect.x + origin.x,
    y: overlay.rect.y + origin.y,
    width: overlay.rect.width,
    height: overlay.rect.height,
  }
  switch (overlay.type) {
    case 'text':
      drawTextOverlay(page, overlay, rect, overlay.bold ? fonts.bold : fonts.regular)
      return
    case 'highlight':
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(overlay.color.r, overlay.color.g, overlay.color.b),
        opacity: HIGHLIGHT_OPACITY,
        blendMode: BlendMode.Multiply,
        borderWidth: 0,
      })
      return
    case 'erase':
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(overlay.fillColor.r, overlay.fillColor.g, overlay.fillColor.b),
        borderWidth: 0,
      })
      return
    case 'redact':
      // Redacted pages must have gone down the raster path; if one slips
      // through, fail loudly rather than ship a cover-only "redaction".
      throw new Error('Internal error: redact overlay reached the vector bake path.')
    case 'image':
    case 'signature': {
      let embedded = imageCache.get(overlay)
      if (!embedded) {
        embedded =
          overlay.imageData.mime === 'image/png'
            ? await doc.embedPng(overlay.imageData.bytes)
            : await doc.embedJpg(overlay.imageData.bytes)
        imageCache.set(overlay, embedded)
      }
      page.drawImage(embedded, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
      return
    }
  }
}

/** Sanitize to WinAnsi-encodable characters (Standard-14 font limitation). */
function sanitizeForFont(font: PDFFont, text: string): string {
  return [...text]
    .map((ch) => {
      try {
        font.widthOfTextAtSize(ch, 10)
        return ch
      } catch {
        return '?'
      }
    })
    .join('')
}

export function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number): string[] {
  return wrapLines(text, maxWidth, (s) => font.widthOfTextAtSize(s, fontSize))
}

function drawTextOverlay(
  page: OutPage,
  overlay: TextOverlay,
  rect: { x: number; y: number; width: number; height: number },
  font: PDFFont,
): void {
  const size = overlay.fontSize
  const text = sanitizeForFont(font, overlay.text)
  const lines = wrapText(font, text, size, rect.width)
  const lineHeight = size * overlay.lineHeight
  const ascent = size * 0.75

  lines.forEach((line, i) => {
    const y = rect.y + rect.height - ascent - i * lineHeight
    if (y < rect.y - lineHeight) return // clip overflow like the DOM view does
    let x = rect.x
    if (overlay.align !== 'left') {
      const lineWidth = font.widthOfTextAtSize(line, size)
      x =
        overlay.align === 'center'
          ? rect.x + (rect.width - lineWidth) / 2
          : rect.x + rect.width - lineWidth
    }
    page.drawText(line, {
      x,
      y,
      size,
      font,
      color: rgb(overlay.color.r, overlay.color.g, overlay.color.b),
    })
  })
}
