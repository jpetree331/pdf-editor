// Framework-free. Every document mutation is a plain, serializable command
// object. Undo is applying a computed inverse command — no snapshots, no
// closures. RESTORE_PAGES exists only as the inverse of REMOVE_PAGES (it
// carries positional information a plain insert doesn't need).
import type {
  OverlayId,
  OverlayObject,
  PageId,
  PageState,
  Rect,
  Rotation,
  SourceDocument,
} from '../types'

export type CommandPayload =
  | { kind: 'ADD_OVERLAY'; overlay: OverlayObject }
  | {
      kind: 'UPDATE_OVERLAY'
      pageId: PageId
      overlayId: OverlayId
      patch: Partial<OverlayObject>
    }
  | { kind: 'REMOVE_OVERLAY'; pageId: PageId; overlayId: OverlayId }
  | { kind: 'REORDER_PAGES'; order: PageId[] }
  | { kind: 'ROTATE_PAGE'; pageId: PageId; rotation: Rotation }
  | { kind: 'SET_CROP'; pageId: PageId; cropBox: Rect | null }
  | {
      kind: 'INSERT_PAGES'
      index: number
      pages: PageState[]
      /** Sources not yet resident in state (byte payloads enter history at most once). */
      newSources: SourceDocument[]
    }
  | { kind: 'REMOVE_PAGES'; pageIds: PageId[] }
  | { kind: 'RESTORE_PAGES'; entries: Array<{ index: number; page: PageState }> }

export interface HistoryEntry {
  id: string
  label: string
  forward: CommandPayload
  inverse: CommandPayload
}
