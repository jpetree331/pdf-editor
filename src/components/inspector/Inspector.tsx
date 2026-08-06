// Right panel: active-tool hint, staging actions (image pick / signature),
// selected-object properties, and page properties.
import { useRef } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { TOOL_REGISTRY } from '../../config/tools'
import type { ImageRef, OverlayObject, RGBColor, TextOverlay } from '../../lib/core/types'
import { Button } from '../common/primitives'
import { Icon } from '../common/Icon'
import './Inspector.css'

const TEXT_COLORS: Array<[string, RGBColor]> = [
  ['Black', { r: 0.1, g: 0.1, b: 0.1 }],
  ['Red', { r: 0.8, g: 0.15, b: 0.1 }],
  ['Blue', { r: 0.1, g: 0.3, b: 0.8 }],
  ['Green', { r: 0.1, g: 0.5, b: 0.2 }],
  ['White', { r: 1, g: 1, b: 1 }],
]

const HIGHLIGHT_COLORS: Array<[string, RGBColor]> = [
  ['Yellow', { r: 1, g: 0.85, b: 0.2 }],
  ['Green', { r: 0.55, g: 0.9, b: 0.4 }],
  ['Blue', { r: 0.45, g: 0.75, b: 1 }],
  ['Pink', { r: 1, g: 0.6, b: 0.8 }],
]

function css(c: RGBColor): string {
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
}

export async function fileToImageRef(file: File): Promise<ImageRef> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  const bitmap = await createImageBitmap(new Blob([bytes.buffer as ArrayBuffer], { type: file.type }))
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    throw new Error('Use a PNG or JPEG image.')
  }
  return { bytes, mime, widthPx: size.width, heightPx: size.height }
}

export function Inspector() {
  const editor = useEditor()
  const {
    session,
    activeToolId,
    selectedOverlayId,
    currentPageId,
    setSelectedOverlay,
    pendingPlacement,
    setPendingPlacement,
    setDialog,
  } = editor
  const state = useSessionState(session)
  const imageInputRef = useRef<HTMLInputElement>(null)

  if (!session) return null
  const tool = TOOL_REGISTRY[activeToolId]
  const page = state.pages.find((p) => p.id === currentPageId)
  const overlay: OverlayObject | undefined = currentPageId
    ? (state.overlaysByPage[currentPageId] ?? []).find((o) => o.id === selectedOverlayId)
    : undefined

  return (
    <aside className="inspector">
      <section className="insp-section">
        <h3 className="insp-heading">{tool.label}</h3>
        <p className="insp-hint">{tool.hint}</p>

        {activeToolId === 'image' && (
          <>
            <Button onClick={() => imageInputRef.current?.click()}>
              {pendingPlacement?.type === 'image' ? 'Choose a different image…' : 'Choose image…'}
            </Button>
            {pendingPlacement?.type === 'image' && (
              <p className="insp-note">Now click on the page to place it.</p>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  setPendingPlacement({ type: 'image', imageData: await fileToImageRef(file) })
                } catch {
                  setPendingPlacement(null)
                }
              }}
            />
          </>
        )}

        {activeToolId === 'signature' && (
          <>
            <Button onClick={() => setDialog('signature')}>
              {pendingPlacement?.type === 'signature' ? 'Redo signature…' : 'Create signature…'}
            </Button>
            {pendingPlacement?.type === 'signature' && (
              <p className="insp-note">Now click on the page to place it.</p>
            )}
          </>
        )}

        {activeToolId === 'redact' && (
          <p className="insp-warning">
            <Icon name="warning" size={14} /> Redacted pages are flattened to images on export so
            the content underneath is truly removed. Text on those pages will no longer be
            selectable.
          </p>
        )}
        {activeToolId === 'erase' && (
          <p className="insp-warning">
            <Icon name="warning" size={14} /> Erase covers content but does not remove it from the
            file. Use Redact for anything sensitive.
          </p>
        )}
      </section>

      {overlay && (
        <section className="insp-section">
          <h3 className="insp-heading">Selected {overlay.type}</h3>
          {overlay.type === 'text' && <TextProps overlay={overlay} />}
          {overlay.type === 'highlight' && (
            <div className="insp-swatches">
              {HIGHLIGHT_COLORS.map(([name, color]) => (
                <button
                  key={name}
                  className="insp-swatch"
                  style={{ background: css(color) }}
                  title={name}
                  onClick={() =>
                    session.updateOverlay(overlay.pageId, overlay.id, { color })
                  }
                />
              ))}
            </div>
          )}
          <Button
            variant="danger"
            onClick={() => {
              session.removeOverlay(overlay.pageId, overlay.id)
              setSelectedOverlay(null)
            }}
          >
            Delete
          </Button>
        </section>
      )}

      {page && (
        <section className="insp-section">
          <h3 className="insp-heading">Page</h3>
          <div className="insp-row">
            <span>Size</span>
            <span>
              {Math.round(page.baseSize.width)} × {Math.round(page.baseSize.height)} pt
            </span>
          </div>
          {page.rotation !== 0 && (
            <div className="insp-row">
              <span>Rotation</span>
              <span>{page.rotation}°</span>
            </div>
          )}
          {page.cropBox && (
            <>
              <div className="insp-row">
                <span>Crop</span>
                <span>
                  {Math.round(page.cropBox.width)} × {Math.round(page.cropBox.height)} pt
                </span>
              </div>
              <Button variant="ghost" onClick={() => session.setCrop(page.id, null)}>
                Clear crop
              </Button>
            </>
          )}
        </section>
      )}
    </aside>
  )
}

function TextProps({ overlay }: { overlay: TextOverlay }) {
  const { session } = useEditor()
  if (!session) return null
  const patch = (p: Partial<TextOverlay>) => session.updateOverlay(overlay.pageId, overlay.id, p)

  return (
    <>
      <label className="insp-label">
        Size
        <input
          type="number"
          min={6}
          max={144}
          value={overlay.fontSize}
          onChange={(e) => patch({ fontSize: Math.max(6, Math.min(144, Number(e.target.value))) })}
        />
      </label>
      <div className="insp-row">
        <Button
          variant={overlay.bold ? 'primary' : 'default'}
          onClick={() => patch({ bold: !overlay.bold })}
        >
          Bold
        </Button>
        <select
          value={overlay.align}
          onChange={(e) => patch({ align: e.target.value as TextOverlay['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div className="insp-swatches">
        {TEXT_COLORS.map(([name, color]) => (
          <button
            key={name}
            className="insp-swatch"
            style={{ background: css(color) }}
            title={name}
            onClick={() => patch({ color })}
          />
        ))}
      </div>
    </>
  )
}
