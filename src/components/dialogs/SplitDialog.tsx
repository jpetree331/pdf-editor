import { useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { parsePageRanges } from '../../lib/pageRanges'
import { Button, Modal } from '../common/primitives'
import type { Jobs } from './DialogHost'

export function SplitDialog({ jobs }: { jobs: Jobs }) {
  const { session, setDialog } = useEditor()
  const state = useSessionState(session)
  const pageCount = state.pages.length
  const [mode, setMode] = useState<'every' | 'ranges'>('every')
  const [every, setEvery] = useState(1)
  const [ranges, setRanges] = useState('')
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    let parts: number[][]
    if (mode === 'every') {
      const n = Math.max(1, Math.floor(every))
      parts = []
      for (let i = 0; i < pageCount; i += n) {
        parts.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, k) => i + k))
      }
      if (parts.length < 2) {
        setError('That would produce a single file — nothing to split.')
        return
      }
    } else {
      const groups = ranges.split(';').map((s) => s.trim()).filter(Boolean)
      if (groups.length === 0) {
        setError('Enter ranges like "1-3; 4-6; 7-10".')
        return
      }
      const parsed = groups.map((g) => parsePageRanges(g, pageCount))
      if (parsed.some((p) => p === null)) {
        setError(`Ranges must be between 1 and ${pageCount}, like "1-3; 4-6".`)
        return
      }
      parts = parsed as number[][]
    }
    setError(null)
    void jobs.splitParts(parts)
  }

  return (
    <Modal title={`Split ${pageCount} pages`} onClose={() => setDialog(null)}>
      <label className="dlg-choice">
        <input type="radio" name="split-mode" checked={mode === 'every'} onChange={() => setMode('every')} />
        <span>
          <strong>Every N pages</strong>
          <input
            className="dlg-inline-number"
            type="number"
            min={1}
            max={Math.max(1, pageCount - 1)}
            value={every}
            onChange={(e) => setEvery(Number(e.target.value))}
            onFocus={() => setMode('every')}
          />
        </span>
      </label>
      <label className="dlg-choice">
        <input type="radio" name="split-mode" checked={mode === 'ranges'} onChange={() => setMode('ranges')} />
        <span>
          <strong>Custom parts</strong>
          <small>Separate parts with semicolons, e.g. “1-3; 4-6; 7-{pageCount}”.</small>
          <input
            value={ranges}
            placeholder="1-3; 4-6"
            onChange={(e) => setRanges(e.target.value)}
            onFocus={() => setMode('ranges')}
          />
        </span>
      </label>

      {error && <p className="dlg-note dlg-note-warn">{error}</p>}
      <p className="dlg-note">The parts download together as a ZIP.</p>

      <div className="dlg-actions">
        <Button variant="ghost" onClick={() => setDialog(null)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={start}>
          Split &amp; download
        </Button>
      </div>
    </Modal>
  )
}
