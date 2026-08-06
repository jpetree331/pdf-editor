// Framework-free. Assisted text editing: click a line of the document's own
// text and it becomes editable — the app covers the original with a fitted
// erase box and drops a pre-filled, size-matched text box on top, already in
// edit mode. The replacement renders in Helvetica (close match, not the
// original font); the covered text remains in the file (erase semantics —
// Redact is the tool for removal).
import { TEXT_DEFAULTS, ERASE_DEFAULT_FILL } from '../config/constants'
import { newId } from '../lib/core/ids'
import { clampRectToPage } from '../lib/core/geometry'
import type { EraseOverlay, PageState, Point, Rect, TextOverlay } from '../lib/core/types'
import type { DocumentSessionState } from '../lib/core/types'
import { extractPageText, type ExtractedLine, type ExtractedPage } from '../lib/render/textExtract'
import { nextZ } from './boxTools'
import type { ToolBehavior, ToolContext } from './types'

/** How far (pt) a click may miss a line's box and still hit it. */
const HIT_TOLERANCE = 3
/** Cover padding (pt) so antialiased glyph edges don't peek out. */
const COVER_PAD = 2

// Source page text is immutable, so extraction is cached for the session.
const extractionCache = new Map<string, Promise<ExtractedPage>>()

function cachedExtract(state: DocumentSessionState, page: PageState): Promise<ExtractedPage> {
  const key = `${page.sourceId}:${page.sourcePageIndex}`
  let cached = extractionCache.get(key)
  if (!cached) {
    cached = extractPageText(state, page)
    extractionCache.set(key, cached)
  }
  return cached
}

/** A line's bounding box, converted from raw user space to view-box space. */
function lineBox(line: ExtractedLine, page: PageState): Rect {
  const minX = Math.min(...line.items.map((i) => i.x))
  const maxX = Math.max(...line.items.map((i) => i.x + i.width))
  return {
    x: minX - page.baseOrigin.x,
    // Baseline sits ~1/4 em above the descender line.
    y: line.y - line.fontSize * 0.25 - page.baseOrigin.y,
    width: maxX - minX,
    height: line.fontSize * 1.15,
  }
}

function hit(point: Point, box: Rect): boolean {
  return (
    point.x >= box.x - HIT_TOLERANCE &&
    point.x <= box.x + box.width + HIT_TOLERANCE &&
    point.y >= box.y - HIT_TOLERANCE &&
    point.y <= box.y + box.height + HIT_TOLERANCE
  )
}

async function editLineAt(ctx: ToolContext, point: Point): Promise<void> {
  const page = ctx.session.getPage(ctx.pageId)
  if (!page) return
  const extracted = await cachedExtract(ctx.session.getState(), page)
  if (!extracted.hasText) return

  const line = extracted.lines.find((l) => hit(point, lineBox(l, page)))
  if (!line) return

  const pageW = ctx.mapper.geometry.baseWidth
  const pageH = ctx.mapper.geometry.baseHeight
  const box = lineBox(line, page)
  const fontSize = Math.max(6, Math.min(72, Math.round(line.fontSize)))

  const cover: EraseOverlay = {
    id: newId(),
    pageId: ctx.pageId,
    type: 'erase',
    rect: clampRectToPage(
      {
        x: box.x - COVER_PAD,
        y: box.y - COVER_PAD,
        width: box.width + COVER_PAD * 2,
        height: box.height + COVER_PAD * 2,
      },
      pageW,
      pageH,
    ),
    zIndex: nextZ(ctx),
    fillColor: { ...ERASE_DEFAULT_FILL },
  }

  // Position the replacement so its first baseline lands on the original
  // baseline (bake draws the first line at rect.top − 0.75em).
  const textHeight = fontSize * 1.3
  const baselineY = line.y - page.baseOrigin.y
  const replacement: TextOverlay = {
    id: newId(),
    pageId: ctx.pageId,
    type: 'text',
    rect: clampRectToPage(
      {
        x: box.x,
        y: baselineY + fontSize * 0.75 - textHeight,
        // Room to type more than the original line without instant wrapping.
        width: Math.max(box.width, pageW - box.x - 12),
        height: textHeight,
      },
      pageW,
      pageH,
    ),
    zIndex: cover.zIndex + 1,
    text: line.text,
    fontSize,
    color: { ...TEXT_DEFAULTS.color },
    align: 'left',
    bold: false,
    lineHeight: TEXT_DEFAULTS.lineHeight,
  }

  ctx.session.addOverlays([cover, replacement], 'Edit text')
  ctx.ui.setSelection(replacement.id)
  ctx.ui.beginTextEdit(replacement.id)
}

export const editTextTool: ToolBehavior = {
  onPointerUp(ctx, e) {
    void editLineAt(ctx, e.pdfPoint)
  },
}
