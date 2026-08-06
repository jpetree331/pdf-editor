// Landing state: drop or pick PDFs. Dropping several combines them in order.
import { useCallback, useRef, useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { Icon } from '../common/Icon'
import './HomePage.css'

const FEATURES: Array<[string, string]> = [
  ['merge', 'Merge, split & reorder'],
  ['signature', 'Fill & sign'],
  ['redact', 'Erase & redact'],
  ['crop', 'Rotate & crop'],
  ['compress', 'Compress'],
  ['convert', 'Convert to Word, Excel & images'],
]

export function HomePage() {
  const { openFiles, loadError, busyLoading } = useEditor()
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      void openFiles([...e.dataTransfer.files])
    },
    [openFiles],
  )

  return (
    <div className="home">
      <div className="home-inner">
        <h1 className="home-title">PDF Editor</h1>
        <p className="home-sub">
          Everything happens in your browser — your files never leave this computer.
        </p>

        <div
          className={`dropzone${dragOver ? ' dropzone-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <Icon name="file" size={40} />
          <div className="dropzone-label">
            {busyLoading ? 'Opening…' : 'Drop a PDF here, or click to browse'}
          </div>
          <div className="dropzone-hint">Drop several PDFs to combine them in order</div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void openFiles([...e.target.files])
              e.target.value = ''
            }}
          />
        </div>

        {loadError && <div className="home-error">{loadError}</div>}

        <ul className="home-features">
          {FEATURES.map(([icon, label]) => (
            <li key={label}>
              <Icon name={icon} size={16} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
