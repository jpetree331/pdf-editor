import { useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { RASTER_DPI_PRESETS } from '../../config/constants'
import { Button, Modal } from '../common/primitives'
import type { Jobs } from './DialogHost'

export function CompressDialog({ jobs }: { jobs: Jobs }) {
  const { setDialog } = useEditor()
  const [mode, setMode] = useState<'standard' | 'aggressive'>('standard')
  const [presetIndex, setPresetIndex] = useState(1)

  return (
    <Modal title="Compress PDF" onClose={() => setDialog(null)}>
      <label className="dlg-choice">
        <input
          type="radio"
          name="compress-mode"
          checked={mode === 'standard'}
          onChange={() => setMode('standard')}
        />
        <span>
          <strong>Rebuild &amp; optimize</strong>
          <small>Repacks the file with compressed structure. Text stays selectable. Modest savings.</small>
        </span>
      </label>
      <label className="dlg-choice">
        <input
          type="radio"
          name="compress-mode"
          checked={mode === 'aggressive'}
          onChange={() => setMode('aggressive')}
        />
        <span>
          <strong>Aggressive (image-based)</strong>
          <small>
            Re-renders every page as a compressed image. Much smaller files — but text is no longer
            selectable or searchable.
          </small>
        </span>
      </label>

      {mode === 'aggressive' && (
        <label className="dlg-label">
          Quality
          <select value={presetIndex} onChange={(e) => setPresetIndex(Number(e.target.value))}>
            {RASTER_DPI_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="dlg-actions">
        <Button variant="ghost" onClick={() => setDialog(null)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const preset = RASTER_DPI_PRESETS[presetIndex]
            void jobs.compress(
              mode === 'standard' ? null : { dpi: preset.dpi, quality: preset.jpegQuality },
            )
          }}
        >
          Compress &amp; download
        </Button>
      </div>
    </Modal>
  )
}
