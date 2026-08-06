import { useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { Button, Modal } from '../common/primitives'
import type { Jobs } from './DialogHost'

export function ConvertDialog({ jobs }: { jobs: Jobs }) {
  const { setDialog } = useEditor()
  const [imageFormat, setImageFormat] = useState<'image/png' | 'image/jpeg'>('image/png')

  return (
    <Modal title="Convert" onClose={() => setDialog(null)} wide>
      <div className="dlg-convert-grid">
        <div className="dlg-convert-card">
          <h3>Word (.docx)</h3>
          <p>
            Extracts the text with layout heuristics. Simple documents convert well; complex
            layouts lose formatting. Scanned pages are embedded as images.
          </p>
          <Button variant="primary" onClick={() => void jobs.convertDocx()}>
            Convert to Word
          </Button>
        </div>

        <div className="dlg-convert-card">
          <h3>Excel (.xlsx)</h3>
          <p>
            Rebuilds rows and columns from text positions — one sheet per page. Best for pages
            that actually contain tables.
          </p>
          <Button variant="primary" onClick={() => void jobs.convertXlsx()}>
            Convert to Excel
          </Button>
        </div>

        <div className="dlg-convert-card">
          <h3>Images</h3>
          <p>Renders each page as an image, including your edits. Multiple pages arrive as a ZIP.</p>
          <label className="dlg-label">
            Format
            <select
              value={imageFormat}
              onChange={(e) => setImageFormat(e.target.value as typeof imageFormat)}
            >
              <option value="image/png">PNG (sharp, larger)</option>
              <option value="image/jpeg">JPEG (smaller)</option>
            </select>
          </label>
          <Button variant="primary" onClick={() => void jobs.convertImages(imageFormat)}>
            Convert to images
          </Button>
        </div>
      </div>
    </Modal>
  )
}
