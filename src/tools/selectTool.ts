// Framework-free. Select: click to pick the topmost overlay under the cursor,
// drag to move it, click empty space to deselect. Resizing is handled by the
// SelectionHandles component; inline text editing opens on double-click
// (wired by the host).
import { pointInRect } from '../lib/core/geometry'
import type { OverlayObject, Point } from '../lib/core/types'
import type { ToolBehavior, ToolContext } from './types'

function hitTest(ctx: ToolContext, p: Point): OverlayObject | null {
  const overlays = ctx.session.getState().overlaysByPage[ctx.pageId] ?? []
  const hits = overlays.filter((o) => pointInRect(p, o.rect))
  if (hits.length === 0) return null
  return hits.reduce((top, o) => (o.zIndex >= top.zIndex ? o : top))
}

interface MoveData {
  overlayId: string
  origin: Point
  originalRect: { x: number; y: number; width: number; height: number }
}

export const selectTool: ToolBehavior = {
  onPointerDown(ctx, e, g) {
    const hit = hitTest(ctx, e.pdfPoint)
    ctx.ui.setSelection(hit?.id ?? null)
    if (hit) {
      g.start = e.pdfPoint
      g.data = { overlayId: hit.id, origin: e.pdfPoint, originalRect: { ...hit.rect } } satisfies MoveData
    } else {
      g.start = null
      g.data = undefined
    }
    g.draft = null
  },

  onPointerMove(ctx, e, g) {
    const data = g.data as MoveData | undefined
    if (!g.start || !data) return
    const overlays = ctx.session.getState().overlaysByPage[ctx.pageId] ?? []
    const overlay = overlays.find((o) => o.id === data.overlayId)
    if (!overlay) return
    const dx = e.pdfPoint.x - data.origin.x
    const dy = e.pdfPoint.y - data.origin.y
    g.draft = {
      ...overlay,
      rect: { ...data.originalRect, x: data.originalRect.x + dx, y: data.originalRect.y + dy },
    }
  },

  onPointerUp(ctx, _e, g) {
    const data = g.data as MoveData | undefined
    if (g.draft && data) {
      ctx.session.updateOverlay(ctx.pageId, data.overlayId, { rect: g.draft.rect })
    }
    g.start = null
    g.draft = null
    g.data = undefined
  },
}
