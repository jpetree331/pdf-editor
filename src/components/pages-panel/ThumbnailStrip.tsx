// Page thumbnails: click to jump, drag to reorder, hover for rotate/delete.
import { useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { usePageRender } from '../../hooks/usePageRender'
import type { DocumentSessionState, PageState } from '../../lib/core/types'
import { totalRotation, pageHasRedaction } from '../../lib/core/types'
import { IconButton } from '../common/primitives'
import './ThumbnailStrip.css'

const THUMB_WIDTH = 108

function Thumbnail({
  state,
  page,
  index,
  active,
  onDropAt,
}: {
  state: DocumentSessionState
  page: PageState
  index: number
  active: boolean
  onDropAt: (draggedId: string, targetIndex: number, before: boolean) => void
}) {
  const { session, setCurrentPage } = useEditor()
  const [dropEdge, setDropEdge] = useState<'top' | 'bottom' | null>(null)
  const rotated = totalRotation(page) === 90 || totalRotation(page) === 270
  const pageW = rotated ? page.baseSize.height : page.baseSize.width
  const scale = THUMB_WIDTH / pageW
  const canvasRef = usePageRender(state, page, scale)

  return (
    <div
      className={`thumb${active ? ' thumb-active' : ''}${
        dropEdge ? ` thumb-drop-${dropEdge}` : ''
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/page-id', page.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('text/page-id')) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        setDropEdge(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom')
      }}
      onDragLeave={() => setDropEdge(null)}
      onDrop={(e) => {
        e.preventDefault()
        const draggedId = e.dataTransfer.getData('text/page-id')
        if (draggedId) onDropAt(draggedId, index, dropEdge !== 'bottom')
        setDropEdge(null)
      }}
      onClick={() => setCurrentPage(page.id)}
    >
      <div className="thumb-canvas-wrap">
        <canvas ref={canvasRef} />
        {pageHasRedaction(state, page.id) && (
          <span className="thumb-flag" title="This page will be flattened to remove redacted content">
            REDACT
          </span>
        )}
      </div>
      <div className="thumb-footer">
        <span className="thumb-number">{index + 1}</span>
        <span className="thumb-actions">
          <IconButton
            icon="rotateLeft"
            label="Rotate left"
            size={14}
            onClick={() => session?.rotatePage(page.id, -90)}
          />
          <IconButton
            icon="rotateRight"
            label="Rotate right"
            size={14}
            onClick={() => session?.rotatePage(page.id, 90)}
          />
          <IconButton
            icon="trash"
            label="Delete page"
            size={14}
            disabled={state.pages.length <= 1}
            onClick={() => session?.deletePages([page.id])}
          />
        </span>
      </div>
    </div>
  )
}

export function ThumbnailStrip() {
  const { session, currentPageId } = useEditor()
  const state = useSessionState(session)

  const onDropAt = (draggedId: string, targetIndex: number, before: boolean) => {
    if (!session) return
    const ids = state.pages.map((p) => p.id)
    const from = ids.indexOf(draggedId)
    if (from < 0) return
    ids.splice(from, 1)
    let to = targetIndex + (before ? 0 : 1)
    if (from < to) to -= 1
    ids.splice(to, 0, draggedId)
    session.reorderPages(ids)
  }

  return (
    <aside className="thumb-strip" aria-label="Pages">
      {state.pages.map((page, i) => (
        <Thumbnail
          key={page.id}
          state={state}
          page={page}
          index={i}
          active={page.id === currentPageId}
          onDropAt={onDropAt}
        />
      ))}
    </aside>
  )
}
