// Framework-free: no React imports anywhere under src/lib (enforced by ESLint).
// This module defines the entire document model. Nothing here touches PDF bytes;
// the model is a virtual page list + overlay lists layered over immutable sources.

export type PageId = string
export type OverlayId = string
export type SourceId = string
export type Rotation = 0 | 90 | 180 | 270

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
/** Channels 0..1, matching pdf-lib's rgb(). */
export interface RGBColor { r: number; g: number; b: number }

/** Sentinel sourceId for inserted blank pages. */
export const BLANK_SOURCE: SourceId = 'blank'

/** A loaded PDF file. Bytes are immutable after load and live outside undo history. */
export interface SourceDocument {
  id: SourceId
  fileName: string
  bytes: Uint8Array
  pageCount: number
}

/**
 * One entry in the virtual page list. Array order in DocumentSessionState.pages
 * IS the document order — reorder/merge/extract are pure array operations.
 */
export interface PageState {
  id: PageId
  sourceId: SourceId
  sourcePageIndex: number
  /** Rotation added in this session, on top of the source page's own /Rotate. */
  rotation: Rotation
  /** The source page's own /Rotate value, captured at load. */
  baseRotation: Rotation
  /** Crop in unrotated PDF-point space (bottom-left origin); null = full page. */
  cropBox: Rect | null
  /** MediaBox size in the page's unrotated space. */
  baseSize: { width: number; height: number }
}

/** Total display rotation for a page (source /Rotate + session rotation). */
export function totalRotation(page: PageState): Rotation {
  return ((page.baseRotation + page.rotation) % 360) as Rotation
}

// ---------------------------------------------------------------------------
// Overlays. All rects are authored in the page's own UNROTATED PDF-point space
// (bottom-left origin) — the same space pdf-lib draws in. CoordinateMapper is
// the only place screen↔PDF conversion happens.
// ---------------------------------------------------------------------------

interface BaseOverlay {
  id: OverlayId
  pageId: PageId
  rect: Rect
  zIndex: number
}

export type ImageMime = 'image/png' | 'image/jpeg'

export interface ImageRef {
  bytes: Uint8Array
  mime: ImageMime
  /** Natural pixel size, for aspect-preserving placement. */
  widthPx: number
  heightPx: number
}

export interface TextOverlay extends BaseOverlay {
  type: 'text'
  text: string
  fontSize: number
  color: RGBColor
  align: 'left' | 'center' | 'right'
  bold: boolean
  /** Line height as a multiple of fontSize. */
  lineHeight: number
}

export interface ImageOverlay extends BaseOverlay {
  type: 'image'
  imageData: ImageRef
}

/** Signatures are rasterized to PNG at capture; baking is identical to images. */
export interface SignatureOverlay extends BaseOverlay {
  type: 'signature'
  imageData: ImageRef
}

export interface HighlightOverlay extends BaseOverlay {
  type: 'highlight'
  color: RGBColor
}

/**
 * Cosmetic cover box. Underlying page content REMAINS in the exported PDF
 * beneath an opaque rectangle — "hide, not destroy".
 */
export interface EraseOverlay extends BaseOverlay {
  type: 'erase'
  fillColor: RGBColor
}

/**
 * True redaction marker. Any page carrying one of these is rasterized at
 * export, with the box fused into the pixels — underlying text is destroyed.
 */
export interface RedactOverlay extends BaseOverlay {
  type: 'redact'
}

export type OverlayObject =
  | TextOverlay
  | ImageOverlay
  | SignatureOverlay
  | HighlightOverlay
  | EraseOverlay
  | RedactOverlay

export type OverlayType = OverlayObject['type']

export interface DocumentSessionState {
  sources: Record<SourceId, SourceDocument>
  pages: PageState[]
  overlaysByPage: Record<PageId, OverlayObject[]>
  meta: { title: string }
}

export function overlaysForPage(state: DocumentSessionState, pageId: PageId): OverlayObject[] {
  return state.overlaysByPage[pageId] ?? []
}

export function pageHasRedaction(state: DocumentSessionState, pageId: PageId): boolean {
  return overlaysForPage(state, pageId).some((o) => o.type === 'redact')
}
