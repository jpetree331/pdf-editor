// Framework-free. Places a pending image/signature (captured via dialogs)
// centered on the click point, aspect-fit to a sensible default width.
import { newId } from '../lib/core/ids'
import { containSize } from '../lib/core/geometry'
import type { ImageOverlay, SignatureOverlay } from '../lib/core/types'
import { nextZ } from './boxTools'
import type { ToolBehavior } from './types'

const DEFAULT_WIDTH = 180 // PDF points

export const placeTool: ToolBehavior = {
  onPointerUp(ctx, e) {
    const pending = ctx.ui.getPendingPlacement()
    if (!pending) return
    const box = containSize(
      pending.imageData.widthPx,
      pending.imageData.heightPx,
      DEFAULT_WIDTH,
      DEFAULT_WIDTH,
    )
    const pageW = ctx.mapper.geometry.baseWidth
    const pageH = ctx.mapper.geometry.baseHeight
    const rect = {
      x: Math.max(0, Math.min(e.pdfPoint.x - box.width / 2, pageW - box.width)),
      y: Math.max(0, Math.min(e.pdfPoint.y - box.height / 2, pageH - box.height)),
      width: box.width,
      height: box.height,
    }
    const base = { id: newId(), pageId: ctx.pageId, rect, zIndex: nextZ(ctx) }
    const overlay: ImageOverlay | SignatureOverlay =
      pending.type === 'image'
        ? { ...base, type: 'image', imageData: pending.imageData }
        : { ...base, type: 'signature', imageData: pending.imageData }
    ctx.session.addOverlay(overlay)
    ctx.ui.clearPendingPlacement()
    ctx.ui.setSelection(overlay.id)
  },
}
