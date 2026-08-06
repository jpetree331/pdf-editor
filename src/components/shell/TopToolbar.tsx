// Top chrome: document identity, undo/redo, page ops, zoom, and export.
import { useRef } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { Button, IconButton } from '../common/primitives'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../config/constants'
import './TopToolbar.css'

export function TopToolbar() {
  const editor = useEditor()
  const { session, zoom, setZoom, setDialog, closeSession, currentPageId } = editor
  const state = useSessionState(session)
  const insertInputRef = useRef<HTMLInputElement>(null)

  if (!session) return null
  const pageIndex = state.pages.findIndex((p) => p.id === currentPageId)

  return (
    <header className="toolbar">
      <div className="toolbar-group toolbar-identity">
        <IconButton icon="close" label="Close document" onClick={closeSession} />
        <span className="toolbar-title" title={state.meta.title}>
          {state.meta.title || 'Untitled'}
        </span>
        <span className="toolbar-pagecount">
          Page {pageIndex + 1} of {state.pages.length}
        </span>
      </div>

      <div className="toolbar-group">
        <IconButton
          icon="undo"
          label="Undo (Ctrl+Z)"
          onClick={() => session.undo()}
          disabled={!session.canUndo()}
        />
        <IconButton
          icon="redo"
          label="Redo (Ctrl+Y)"
          onClick={() => session.redo()}
          disabled={!session.canRedo()}
        />
      </div>

      <div className="toolbar-group">
        <IconButton
          icon="plus"
          label="Insert blank page after this one"
          onClick={() => session.insertBlankPage(Math.max(0, pageIndex))}
        />
        <IconButton
          icon="merge"
          label="Insert another PDF after this page"
          onClick={() => insertInputRef.current?.click()}
        />
        <input
          ref={insertInputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            const bytes = new Uint8Array(await file.arrayBuffer())
            await session.insertPagesFromFile(bytes, file.name, Math.max(0, pageIndex))
          }}
        />
        <IconButton icon="extract" label="Extract pages" onClick={() => setDialog('extract')} />
        <IconButton icon="split" label="Split into parts" onClick={() => setDialog('split')} />
        <IconButton icon="compress" label="Compress" onClick={() => setDialog('compress')} />
        <IconButton
          icon="convert"
          label="Convert to Word / Excel / images"
          onClick={() => setDialog('convert')}
        />
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <IconButton
          icon="zoomOut"
          label="Zoom out"
          onClick={() => setZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
        />
        <span className="toolbar-zoom">{Math.round(zoom * 100)}%</span>
        <IconButton
          icon="zoomIn"
          label="Zoom in"
          onClick={() => setZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
        />
      </div>

      <div className="toolbar-group">
        <Button variant="primary" onClick={() => setDialog('export')}>
          Download
        </Button>
      </div>
    </header>
  )
}
