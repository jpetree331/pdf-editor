// Framework-free. The facade the React shell talks to: owns state, history,
// and change notification. All mutation flows through dispatch() so every
// change is undoable. pdf-lib is used here only for structural reads at load
// time (page count, size, /Rotate) — never for rendering.
import { PDFDocument } from 'pdf-lib'
import type {
  DocumentSessionState,
  OverlayId,
  OverlayObject,
  PageId,
  PageState,
  Rect,
  Rotation,
  SourceDocument,
  SourceId,
} from './types'
import { BLANK_SOURCE } from './types'
import { newId } from './ids'
import type { CommandPayload, HistoryEntry } from './commands/commandTypes'
import { applyCommand } from './commands/reducer'
import { computeInverse } from './commands/inverse'
import { HistoryManager } from './commands/HistoryManager'

export class PdfLoadError extends Error {}

interface LoadedSource {
  source: SourceDocument
  pages: PageState[]
}

async function loadSource(bytes: Uint8Array, fileName: string): Promise<LoadedSource> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/encrypt/i.test(message)) {
      throw new PdfLoadError(
        `"${fileName}" is password-protected. Remove the password before editing it here.`,
      )
    }
    throw new PdfLoadError(`Could not read "${fileName}" — it may be corrupt or not a PDF.`)
  }
  const sourceId: SourceId = newId()
  const pages: PageState[] = doc.getPages().map((page, i) => {
    const { width, height } = page.getSize()
    return {
      id: newId(),
      sourceId,
      sourcePageIndex: i,
      rotation: 0,
      baseRotation: (((page.getRotation().angle % 360) + 360) % 360) as Rotation,
      cropBox: null,
      baseSize: { width, height },
    }
  })
  return {
    source: { id: sourceId, fileName, bytes, pageCount: pages.length },
    pages,
  }
}

export class PdfDocumentSession {
  private state: DocumentSessionState
  private history = new HistoryManager()
  private listeners = new Set<() => void>()

  private constructor(state: DocumentSessionState) {
    this.state = state
  }

  /** Build a session from one or more PDF files; multiple files merge in order. */
  static async fromFiles(files: Array<{ bytes: Uint8Array; fileName: string }>): Promise<PdfDocumentSession> {
    if (files.length === 0) throw new PdfLoadError('No files given.')
    const loaded = await Promise.all(files.map((f) => loadSource(f.bytes, f.fileName)))
    const sources: Record<SourceId, SourceDocument> = {}
    for (const l of loaded) sources[l.source.id] = l.source
    return new PdfDocumentSession({
      sources,
      pages: loaded.flatMap((l) => l.pages),
      overlaysByPage: {},
      meta: { title: files[0].fileName.replace(/\.pdf$/i, '') },
    })
  }

  // -- subscription (shaped for React's useSyncExternalStore) ---------------

  getState = (): DocumentSessionState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }

  // -- dispatch & history ---------------------------------------------------

  dispatch(payload: CommandPayload, label: string): void {
    const entry: HistoryEntry = {
      id: newId(),
      label,
      forward: payload,
      inverse: computeInverse(payload, this.state),
    }
    this.state = applyCommand(this.state, payload)
    this.history.push(entry)
    this.notify()
  }

  undo(): void {
    const entry = this.history.popForUndo()
    if (!entry) return
    this.state = applyCommand(this.state, entry.inverse)
    this.notify()
  }

  redo(): void {
    const entry = this.history.popForRedo()
    if (!entry) return
    this.state = applyCommand(this.state, entry.forward)
    this.notify()
  }

  canUndo(): boolean {
    return this.history.canUndo()
  }

  canRedo(): boolean {
    return this.history.canRedo()
  }

  // -- ergonomic wrappers ---------------------------------------------------

  addOverlay(overlay: OverlayObject): void {
    this.dispatch({ kind: 'ADD_OVERLAY', overlay }, `Add ${overlay.type}`)
  }

  updateOverlay(pageId: PageId, overlayId: OverlayId, patch: Partial<OverlayObject>): void {
    this.dispatch({ kind: 'UPDATE_OVERLAY', pageId, overlayId, patch }, 'Edit object')
  }

  removeOverlay(pageId: PageId, overlayId: OverlayId): void {
    this.dispatch({ kind: 'REMOVE_OVERLAY', pageId, overlayId }, 'Delete object')
  }

  reorderPages(order: PageId[]): void {
    this.dispatch({ kind: 'REORDER_PAGES', order }, 'Reorder pages')
  }

  rotatePage(pageId: PageId, delta: 90 | -90 | 180): void {
    const page = this.state.pages.find((p) => p.id === pageId)
    if (!page) return
    const rotation = (((page.rotation + delta) % 360) + 360) % 360
    this.dispatch({ kind: 'ROTATE_PAGE', pageId, rotation: rotation as Rotation }, 'Rotate page')
  }

  setCrop(pageId: PageId, cropBox: Rect | null): void {
    this.dispatch({ kind: 'SET_CROP', pageId, cropBox }, cropBox ? 'Crop page' : 'Clear crop')
  }

  deletePages(pageIds: PageId[]): void {
    if (this.state.pages.length <= pageIds.length) return // never delete the last page
    this.dispatch({ kind: 'REMOVE_PAGES', pageIds }, 'Delete pages')
  }

  insertBlankPage(afterIndex: number): void {
    const template = this.state.pages[Math.max(0, Math.min(afterIndex, this.state.pages.length - 1))]
    const page: PageState = {
      id: newId(),
      sourceId: BLANK_SOURCE,
      sourcePageIndex: 0,
      rotation: 0,
      baseRotation: 0,
      cropBox: null,
      baseSize: template ? { ...template.baseSize } : { width: 612, height: 792 },
    }
    this.dispatch(
      { kind: 'INSERT_PAGES', index: afterIndex + 1, pages: [page], newSources: [] },
      'Insert blank page',
    )
  }

  /** Insert all pages of another PDF file after the given index (end = pages.length - 1). */
  async insertPagesFromFile(bytes: Uint8Array, fileName: string, afterIndex: number): Promise<void> {
    const loaded = await loadSource(bytes, fileName)
    this.dispatch(
      {
        kind: 'INSERT_PAGES',
        index: afterIndex + 1,
        pages: loaded.pages,
        newSources: [loaded.source],
      },
      `Insert ${fileName}`,
    )
  }

  // -- reads ----------------------------------------------------------------

  getPage(pageId: PageId): PageState | undefined {
    return this.state.pages.find((p) => p.id === pageId)
  }

  pageIndex(pageId: PageId): number {
    return this.state.pages.findIndex((p) => p.id === pageId)
  }
}
