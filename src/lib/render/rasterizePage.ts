// Browser-only (canvas). The shared rasterization core used by redaction,
// aggressive compression, and image export. Renders a page via pdf.js and
// FUSES its overlays into the pixels — for redacted pages this is what
// guarantees the underlying content is destroyed, not covered.
import type { DocumentSessionState, OverlayObject, PageState } from '../core/types'
import { totalRotation } from '../core/types'
import { CoordinateMapper } from '../core/coordinates/CoordinateMapper'
import { rgbaCss } from '../core/color'
import { wrapLines } from '../core/textWrap'
import { bytesToBlob } from '../fileIO'
import { getPageProxy } from './pdfjsLoader'
import { HIGHLIGHT_OPACITY, REDACT_FILL_HEX } from '../../config/constants'

export interface RasterOptions {
  dpi: number
  /** JPEG quality 0..1; ignored for PNG output. */
  quality: number
  format: 'image/jpeg' | 'image/png'
}

export interface RasterOutput {
  bytes: Uint8Array
  widthPx: number
  heightPx: number
  widthPt: number
  heightPt: number
}

export async function rasterizePage(
  state: DocumentSessionState,
  page: PageState,
  options: RasterOptions,
): Promise<RasterOutput> {
  const scale = options.dpi / 72
  const mapper = new CoordinateMapper(
    {
      baseWidth: page.baseSize.width,
      baseHeight: page.baseSize.height,
      rotation: totalRotation(page),
    },
    scale,
  )
  const viewport = mapper.viewportSize()

  let canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const proxy = await getPageProxy(state, page)
  if (proxy) {
    const pdfViewport = proxy.getViewport({ scale, rotation: totalRotation(page) })
    // intent: 'print' — renders without requestAnimationFrame pacing (which
    // stalls in hidden tabs) and flattens annotations, which is what an
    // export should do anyway.
    await proxy.render({ canvasContext: ctx, viewport: pdfViewport, canvas, intent: 'print' })
      .promise
  }

  const overlays = [...(state.overlaysByPage[page.id] ?? [])].sort((a, b) => a.zIndex - b.zIndex)
  for (const overlay of overlays) {
    await paintOverlay(ctx, overlay, page, mapper, scale)
  }

  // Apply crop by copying out the kept region.
  if (page.cropBox) {
    const cropScreen = mapper.pdfRectToScreen(page.cropBox)
    const cropped = document.createElement('canvas')
    cropped.width = Math.max(1, Math.round(cropScreen.width))
    cropped.height = Math.max(1, Math.round(cropScreen.height))
    const cctx = cropped.getContext('2d')
    if (!cctx) throw new Error('Canvas 2D unavailable')
    cctx.drawImage(
      canvas,
      Math.round(cropScreen.x),
      Math.round(cropScreen.y),
      cropped.width,
      cropped.height,
      0,
      0,
      cropped.width,
      cropped.height,
    )
    canvas = cropped
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))),
      options.format,
      options.quality,
    )
  })
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    widthPx: canvas.width,
    heightPx: canvas.height,
    widthPt: canvas.width / scale,
    heightPt: canvas.height / scale,
  }
}

/**
 * Paint an overlay onto the rotated screen-space canvas. The transform makes
 * the local origin the overlay box's top-left in the page's own (unrotated)
 * orientation — mirroring rotationCss.ts exactly.
 */
async function paintOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: OverlayObject,
  page: PageState,
  mapper: CoordinateMapper,
  scale: number,
): Promise<void> {
  const screen = mapper.pdfRectToScreen(overlay.rect)
  const innerW = overlay.rect.width * scale
  const innerH = overlay.rect.height * scale

  ctx.save()
  switch (totalRotation(page)) {
    case 0:
      ctx.translate(screen.x, screen.y)
      break
    case 90:
      ctx.translate(screen.x + screen.width, screen.y)
      ctx.rotate(Math.PI / 2)
      break
    case 180:
      ctx.translate(screen.x + screen.width, screen.y + screen.height)
      ctx.rotate(Math.PI)
      break
    case 270:
      ctx.translate(screen.x, screen.y + screen.height)
      ctx.rotate(-Math.PI / 2)
      break
  }

  switch (overlay.type) {
    case 'highlight':
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = rgbaCss(overlay.color, HIGHLIGHT_OPACITY + 0.25)
      ctx.fillRect(0, 0, innerW, innerH)
      break
    case 'erase':
      ctx.fillStyle = rgbaCss(overlay.fillColor)
      ctx.fillRect(0, 0, innerW, innerH)
      break
    case 'redact':
      ctx.fillStyle = REDACT_FILL_HEX
      ctx.fillRect(0, 0, innerW, innerH)
      break
    case 'text': {
      const size = overlay.fontSize * scale
      ctx.font = `${overlay.bold ? '700' : '400'} ${size}px Helvetica, Arial, sans-serif`
      ctx.fillStyle = rgbaCss(overlay.color)
      ctx.textBaseline = 'alphabetic'
      const lines = wrapLines(overlay.text, innerW, (s) => ctx.measureText(s).width)
      const lineHeight = size * overlay.lineHeight
      lines.forEach((line, i) => {
        const y = size * 0.75 + i * lineHeight
        if (y > innerH + lineHeight) return
        let x = 0
        if (overlay.align !== 'left') {
          const w = ctx.measureText(line).width
          x = overlay.align === 'center' ? (innerW - w) / 2 : innerW - w
        }
        ctx.fillText(line, x, y)
      })
      break
    }
    case 'image':
    case 'signature': {
      const { bytes, mime, widthPx, heightPx } = overlay.imageData
      const bitmap = await createImageBitmap(bytesToBlob(bytes, mime))
      // Placement rects are aspect-correct; contain-fit guards imported docs.
      const fit = Math.min(innerW / widthPx, innerH / heightPx)
      const w = widthPx * fit
      const h = heightPx * fit
      ctx.drawImage(bitmap, (innerW - w) / 2, (innerH - h) / 2, w, h)
      bitmap.close()
      break
    }
  }
  ctx.restore()
}

