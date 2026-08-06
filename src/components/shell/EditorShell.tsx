// The editor workspace: toolbar, tool rail, thumbnails, canvas, inspector.
import { useEffect } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { TopToolbar } from './TopToolbar'
import { ToolRail } from './ToolRail'
import { ThumbnailStrip } from '../pages-panel/ThumbnailStrip'
import { PdfCanvasStage } from '../canvas/PdfCanvasStage'
import { Inspector } from '../inspector/Inspector'
import { DialogHost } from '../dialogs/DialogHost'
import './EditorShell.css'

export function EditorShell() {
  const editor = useEditor()
  const { session, currentPageId, setCurrentPage, selectedOverlayId, setSelectedOverlay, editingTextId } = editor
  const state = useSessionState(session)

  // Keep the current page valid when pages are deleted/reordered.
  useEffect(() => {
    if (state.pages.length === 0) return
    if (!currentPageId || !state.pages.some((p) => p.id === currentPageId)) {
      setCurrentPage(state.pages[0].id)
    }
  }, [state.pages, currentPageId, setCurrentPage])

  // Global keyboard shortcuts.
  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) session.redo()
        else session.undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        session.redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        if (selectedOverlayId && currentPageId && !editingTextId) {
          e.preventDefault()
          session.removeOverlay(currentPageId, selectedOverlayId)
          setSelectedOverlay(null)
        }
      } else if (e.key === 'Escape' && !typing) {
        setSelectedOverlay(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, selectedOverlayId, currentPageId, editingTextId, setSelectedOverlay])

  if (!session) return null

  return (
    <div className="shell">
      <TopToolbar />
      <div className="shell-main">
        <ToolRail />
        <ThumbnailStrip />
        <PdfCanvasStage />
        <Inspector />
      </div>
      <DialogHost />
    </div>
  )
}
