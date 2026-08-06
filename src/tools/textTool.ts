// Framework-free. Click places a text box and immediately opens inline editing.
import { TEXT_DEFAULTS } from '../config/constants'
import { newId } from '../lib/core/ids'
import type { TextOverlay } from '../lib/core/types'
import { nextZ } from './boxTools'
import type { ToolBehavior } from './types'

const DEFAULT_WIDTH = 220
const DEFAULT_HEIGHT = 40

export const textTool: ToolBehavior = {
  onPointerUp(ctx, e) {
    const pageW = ctx.mapper.geometry.baseWidth
    const pageH = ctx.mapper.geometry.baseHeight
    const overlay: TextOverlay = {
      id: newId(),
      pageId: ctx.pageId,
      type: 'text',
      rect: {
        x: Math.max(0, Math.min(e.pdfPoint.x, pageW - DEFAULT_WIDTH)),
        y: Math.max(0, Math.min(e.pdfPoint.y - DEFAULT_HEIGHT, pageH - DEFAULT_HEIGHT)),
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      },
      zIndex: nextZ(ctx),
      text: '',
      fontSize: TEXT_DEFAULTS.fontSize,
      color: { ...TEXT_DEFAULTS.color },
      align: 'left',
      bold: false,
      lineHeight: TEXT_DEFAULTS.lineHeight,
    }
    ctx.session.addOverlay(overlay)
    ctx.ui.setSelection(overlay.id)
    ctx.ui.beginTextEdit(overlay.id)
  },
}
