// Framework-free (no React): tools are behavior modules the canvas host
// dispatches to by table lookup. Ephemeral gesture state lives in a plain
// object owned by the host and passed to every handler.
import type { CoordinateMapper } from '../lib/core/coordinates/CoordinateMapper'
import type { PdfDocumentSession } from '../lib/core/PdfDocumentSession'
import type { ImageRef, OverlayId, OverlayObject, PageId, Point, Rect } from '../lib/core/types'

export interface PendingPlacement {
  type: 'image' | 'signature'
  imageData: ImageRef
}

/** The UI capabilities a tool may use, implemented by the React host. */
export interface ToolUIPort {
  getSelection(): OverlayId | null
  setSelection(overlayId: OverlayId | null): void
  getPendingPlacement(): PendingPlacement | null
  clearPendingPlacement(): void
  /** Open inline text editing for a text overlay. */
  beginTextEdit(overlayId: OverlayId): void
}

export interface ToolContext {
  session: PdfDocumentSession
  pageId: PageId
  mapper: CoordinateMapper
  ui: ToolUIPort
}

export interface ToolPointerEvent {
  /** In the page's unrotated PDF-point space (bottom-left origin). */
  pdfPoint: Point
  /** CSS px relative to the rendered page's top-left. */
  screenPoint: Point
  shiftKey: boolean
}

/** Mutable scratch owned by the host for the duration of one gesture. */
export interface GestureState {
  start: Point | null
  draft: OverlayObject | null
  /** Crop marquee rect (PDF space) while dragging the crop tool. */
  marquee?: Rect | null
  data?: unknown
}

export interface ToolBehavior {
  onPointerDown?(ctx: ToolContext, e: ToolPointerEvent, g: GestureState): void
  onPointerMove?(ctx: ToolContext, e: ToolPointerEvent, g: GestureState): void
  onPointerUp?(ctx: ToolContext, e: ToolPointerEvent, g: GestureState): void
}
