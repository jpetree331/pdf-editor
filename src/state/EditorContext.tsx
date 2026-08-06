// The single React context for the editor: the active session plus all
// UI-only state (tool, selection, zoom, dialogs). Document state itself lives
// in PdfDocumentSession — read it via useSessionState().
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { PdfDocumentSession, PdfLoadError } from '../lib/core/PdfDocumentSession'
import { disposeAllProxies } from '../lib/render/pdfjsLoader'
import type { OverlayId, PageId } from '../lib/core/types'
import type { CanvasToolId } from '../config/tools'
import type { PendingPlacement } from '../tools/types'
import { ZOOM_DEFAULT } from '../config/constants'

export type DialogId =
  | 'export'
  | 'compress'
  | 'convert'
  | 'signature'
  | 'split'
  | 'extract'
  | null

export interface EditorContextValue {
  session: PdfDocumentSession | null
  loadError: string | null
  busyLoading: boolean
  openFiles: (files: File[]) => Promise<void>
  closeSession: () => void

  activeToolId: CanvasToolId
  setActiveTool: (id: CanvasToolId) => void

  currentPageId: PageId | null
  setCurrentPage: (id: PageId) => void

  selectedOverlayId: OverlayId | null
  setSelectedOverlay: (id: OverlayId | null) => void

  editingTextId: OverlayId | null
  setEditingTextId: (id: OverlayId | null) => void

  pendingPlacement: PendingPlacement | null
  setPendingPlacement: (p: PendingPlacement | null) => void

  zoom: number
  /** React state setter — functional form is safe for rapid wheel bursts. */
  setZoom: Dispatch<SetStateAction<number>>

  dialog: DialogId
  setDialog: (d: DialogId) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PdfDocumentSession | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyLoading, setBusyLoading] = useState(false)
  const [activeToolId, setActiveToolId] = useState<CanvasToolId>('select')
  const [currentPageId, setCurrentPage] = useState<PageId | null>(null)
  const [selectedOverlayId, setSelectedOverlay] = useState<OverlayId | null>(null)
  const [editingTextId, setEditingTextId] = useState<OverlayId | null>(null)
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null)
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [dialog, setDialog] = useState<DialogId>(null)
  const sessionRef = useRef<PdfDocumentSession | null>(null)

  const openFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    if (pdfs.length === 0) {
      setLoadError('Drop a PDF file (or several — they will be combined in order).')
      return
    }
    setBusyLoading(true)
    setLoadError(null)
    try {
      const loaded = await Promise.all(
        pdfs.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), fileName: f.name })),
      )
      const next = await PdfDocumentSession.fromFiles(loaded)
      if (sessionRef.current) void disposeAllProxies()
      sessionRef.current = next
      setSession(next)
      setCurrentPage(next.getState().pages[0]?.id ?? null)
      setSelectedOverlay(null)
      setActiveToolId('select')
      setZoom(ZOOM_DEFAULT)
    } catch (err) {
      setLoadError(
        err instanceof PdfLoadError ? err.message : 'Something went wrong opening that file.',
      )
    } finally {
      setBusyLoading(false)
    }
  }, [])

  const closeSession = useCallback(() => {
    void disposeAllProxies()
    sessionRef.current = null
    setSession(null)
    setCurrentPage(null)
    setSelectedOverlay(null)
    setPendingPlacement(null)
    setEditingTextId(null)
    setDialog(null)
  }, [])

  const setActiveTool = useCallback((id: CanvasToolId) => {
    setActiveToolId(id)
    if (id !== 'select') setEditingTextId(null)
  }, [])

  const value = useMemo<EditorContextValue>(
    () => ({
      session,
      loadError,
      busyLoading,
      openFiles,
      closeSession,
      activeToolId,
      setActiveTool,
      currentPageId,
      setCurrentPage,
      selectedOverlayId,
      setSelectedOverlay,
      editingTextId,
      setEditingTextId,
      pendingPlacement,
      setPendingPlacement,
      zoom,
      setZoom,
      dialog,
      setDialog,
    }),
    [
      session,
      loadError,
      busyLoading,
      openFiles,
      closeSession,
      activeToolId,
      setActiveTool,
      currentPageId,
      selectedOverlayId,
      editingTextId,
      pendingPlacement,
      zoom,
      dialog,
    ],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider')
  return ctx
}
