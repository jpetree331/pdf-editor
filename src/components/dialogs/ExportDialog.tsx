import { useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { pageHasRedaction } from '../../lib/core/types'
import { Button, Modal } from '../common/primitives'
import { Icon } from '../common/Icon'
import type { Jobs } from './DialogHost'

export function ExportDialog({ jobs }: { jobs: Jobs }) {
  const { session, setDialog } = useEditor()
  const state = useSessionState(session)
  const [name, setName] = useState(state.meta.title || 'document')
  const redactedCount = state.pages.filter((p) => pageHasRedaction(state, p.id)).length
  const hasErase = state.pages.some((p) =>
    (state.overlaysByPage[p.id] ?? []).some((o) => o.type === 'erase'),
  )

  return (
    <Modal title="Download PDF" onClose={() => setDialog(null)}>
      <label className="dlg-label">
        File name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {redactedCount > 0 && (
        <p className="dlg-note dlg-note-warn">
          <Icon name="warning" size={14} /> {redactedCount} page{redactedCount > 1 ? 's' : ''} with
          redactions will be flattened to images so the content underneath is truly removed.
        </p>
      )}
      {hasErase && (
        <p className="dlg-note">
          Erase boxes cover content but do not remove it from the file. Anything sensitive should
          use Redact instead.
        </p>
      )}

      <div className="dlg-actions">
        <Button variant="ghost" onClick={() => setDialog(null)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void jobs.exportPdf(name)}>
          Download
        </Button>
      </div>
    </Modal>
  )
}
