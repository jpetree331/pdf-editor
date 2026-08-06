// Framework-free. Shared drag-a-box behavior: highlight, erase, and redact
// differ only in the overlay they mint; crop differs in committing a crop
// instead of an overlay. The divergence between erase (cosmetic cover) and
// redact (true removal) lives entirely in the export pipeline — the tools and
// canvas code are identical by design.
import { HIGHLIGHT_COLOR, ERASE_DEFAULT_FILL } from '../config/constants'
import { newId } from '../lib/core/ids'
import { clampRectToPage, normalizeRect } from '../lib/core/geometry'
import type { OverlayObject, Rect } from '../lib/core/types'
import type { GestureState, ToolBehavior, ToolContext, ToolPointerEvent } from './types'

const MIN_BOX = 4 // PDF points; ignore accidental micro-drags

function dragRect(ctx: ToolContext, e: ToolPointerEvent, g: GestureState): Rect | null {
  if (!g.start) return null
  const rect = normalizeRect(g.start, e.pdfPoint)
  return clampRectToPage(rect, ctx.mapper.geometry.baseWidth, ctx.mapper.geometry.baseHeight)
}

function makeBoxTool(mint: (ctx: ToolContext, rect: Rect) => OverlayObject): ToolBehavior {
  return {
    onPointerDown(_ctx, e, g) {
      g.start = e.pdfPoint
      g.draft = null
    },
    onPointerMove(ctx, e, g) {
      const rect = dragRect(ctx, e, g)
      if (rect) g.draft = mint(ctx, rect)
    },
    onPointerUp(ctx, e, g) {
      const rect = dragRect(ctx, e, g)
      g.start = null
      g.draft = null
      if (!rect || rect.width < MIN_BOX || rect.height < MIN_BOX) return
      const overlay = mint(ctx, rect)
      ctx.session.addOverlay(overlay)
      ctx.ui.setSelection(overlay.id)
    },
  }
}

export const highlightTool: ToolBehavior = makeBoxTool((ctx, rect) => ({
  id: newId(),
  pageId: ctx.pageId,
  type: 'highlight',
  rect,
  zIndex: nextZ(ctx),
  color: { ...HIGHLIGHT_COLOR },
}))

export const eraseTool: ToolBehavior = makeBoxTool((ctx, rect) => ({
  id: newId(),
  pageId: ctx.pageId,
  type: 'erase',
  rect,
  zIndex: nextZ(ctx),
  fillColor: { ...ERASE_DEFAULT_FILL },
}))

export const redactTool: ToolBehavior = makeBoxTool((ctx, rect) => ({
  id: newId(),
  pageId: ctx.pageId,
  type: 'redact',
  rect,
  zIndex: nextZ(ctx),
}))

export const cropTool: ToolBehavior = {
  onPointerDown(_ctx, e, g) {
    g.start = e.pdfPoint
    g.marquee = null
  },
  onPointerMove(ctx, e, g) {
    g.marquee = dragRect(ctx, e, g)
  },
  onPointerUp(ctx, e, g) {
    const rect = dragRect(ctx, e, g)
    g.start = null
    g.marquee = null
    if (!rect || rect.width < 36 || rect.height < 36) return // refuse absurd crops
    ctx.session.setCrop(ctx.pageId, rect)
  },
}

export function nextZ(ctx: ToolContext): number {
  const overlays = ctx.session.getState().overlaysByPage[ctx.pageId] ?? []
  return overlays.reduce((max, o) => Math.max(max, o.zIndex), 0) + 1
}
