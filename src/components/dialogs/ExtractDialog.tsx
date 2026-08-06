import { useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { parsePageRanges } from '../../lib/pageRanges'
import { Button, Modal } from '../common/primitives'
import type { Jobs } from './DialogHost'

export function ExtractDialog({ jobs }: { jobs: Jobs }) {
  const { session, setDialog, currentPageId } = useEditor()
  const state = useSessionState(session)
  const pageCount = state.pages.length
  const currentIndex = state.pages.findIndex((p) => p.id === currentPageId)
  const [ranges, setRanges] = useState(currentIndex >= 0 ? String(currentIndex + 1) : '1')
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    const indexes = parsePageRanges(ranges, pageCount)
    if (!indexes || indexes.length === 0) {
      setError(`Enter pages between 1 and ${pageCount}, like "1-3, 5".`)
      return
    }
    setError(null)
    void jobs.extractPages(indexes)
  }

  return (
    <Modal title="Extract pages" onClose={() => setDialog(null)}>
      <label className="dlg-label">
        Pages to extract
        <input value={ranges} placeholder="e.g. 1-3, 5" onChange={(e) => setRanges(e.target.value)} />
      </label>
      <p className="dlg-note">
        The selected pages download as a new PDF. The open document is not changed.
      </p>
      {error && <p className="dlg-note dlg-note-warn">{error}</p>}

      <div className="dlg-actions">
        <Button variant="ghost" onClick={() => setDialog(null)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={start}>
          Extract &amp; download
        </Button>
      </div>
    </Modal>
  )
}
