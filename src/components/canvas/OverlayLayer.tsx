// Renders every overlay on the current page as positioned DOM, dispatching by
// overlay.type through a renderer table — no switch statements in components.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { CoordinateMapper } from '../../lib/core/coordinates/CoordinateMapper'
import type {
  EraseOverlay,
  HighlightOverlay,
  ImageOverlay,
  OverlayObject,
  RGBColor,
  SignatureOverlay,
  TextOverlay,
} from '../../lib/core/types'
import { totalRotation, type PageState } from '../../lib/core/types'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { bytesToBlob } from '../../lib/fileIO'
import { rotatedContentStyle } from './rotationCss'
import './OverlayLayer.css'

function cssColor(c: RGBColor, alpha = 1): string {
  const to255 = (v: number) => Math.round(v * 255)
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${alpha})`
}

function useImageUrl(bytes: Uint8Array, mime: string): string {
  const url = useMemo(() => URL.createObjectURL(bytesToBlob(bytes, mime)), [bytes, mime])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return url
}

interface RendererProps<T extends OverlayObject> {
  overlay: T
  mapper: CoordinateMapper
  page: PageState
}

function TextView({ overlay, mapper, page }: RendererProps<TextOverlay>) {
  const { editingTextId, setEditingTextId, session } = useEditor()
  const scale = mapper.scale
  const inner = rotatedContentStyle(
    totalRotation(page),
    overlay.rect.width * scale,
    overlay.rect.height * scale,
  )
  const textStyle: CSSProperties = {
    ...inner,
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: overlay.fontSize * scale,
    lineHeight: overlay.lineHeight,
    color: cssColor(overlay.color),
    textAlign: overlay.align,
    fontWeight: overlay.bold ? 700 : 400,
  }

  const editing = editingTextId === overlay.id
  const [value, setValue] = useState(overlay.text)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      setValue(overlay.text)
      taRef.current?.focus()
      taRef.current?.select()
    }
    // Deliberately runs only when editing toggles on.
  }, [editing])

  if (editing) {
    return (
      <textarea
        ref={taRef}
        className="ov-text-edit"
        style={textStyle}
        value={value}
        placeholder="Type here"
        onChange={(e) => setValue(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') taRef.current?.blur()
        }}
        onBlur={() => {
          setEditingTextId(null)
          const text = value.trimEnd()
          if (text.length === 0) session?.removeOverlay(overlay.pageId, overlay.id)
          else if (text !== overlay.text)
            session?.updateOverlay(overlay.pageId, overlay.id, { text })
        }}
      />
    )
  }
  return (
    <div className="ov-text" style={textStyle}>
      {overlay.text || <span className="ov-text-placeholder">Double-click to edit</span>}
    </div>
  )
}

function ImageLikeView({ overlay, mapper, page }: RendererProps<ImageOverlay | SignatureOverlay>) {
  const url = useImageUrl(overlay.imageData.bytes, overlay.imageData.mime)
  const scale = mapper.scale
  const inner = rotatedContentStyle(
    totalRotation(page),
    overlay.rect.width * scale,
    overlay.rect.height * scale,
  )
  return <img className="ov-image" style={inner} src={url} alt="" draggable={false} />
}

function HighlightView({ overlay }: RendererProps<HighlightOverlay>) {
  return <div className="ov-highlight" style={{ background: cssColor(overlay.color, 0.45) }} />
}

function EraseView({ overlay }: RendererProps<EraseOverlay>) {
  return <div className="ov-erase" style={{ background: cssColor(overlay.fillColor) }} />
}

function RedactView() {
  return <div className="ov-redact" />
}

const RENDERERS: {
  [K in OverlayObject['type']]: (props: RendererProps<never>) => JSX.Element
} = {
  text: TextView as never,
  image: ImageLikeView as never,
  signature: ImageLikeView as never,
  highlight: HighlightView as never,
  erase: EraseView as never,
  redact: RedactView as never,
}

export function OverlayLayer({
  page,
  mapper,
  liveDraft,
}: {
  page: PageState
  mapper: CoordinateMapper
  /** In-progress move/resize/creation preview; replaces the overlay with its id. */
  liveDraft: OverlayObject | null
}) {
  const { session, selectedOverlayId, setSelectedOverlay, activeToolId, setEditingTextId } =
    useEditor()
  const state = useSessionState(session)
  const overlays = state.overlaysByPage[page.id] ?? []

  const display: OverlayObject[] = [...overlays]
    .filter((o) => o.id !== liveDraft?.id)
    .concat(liveDraft ? [liveDraft] : [])
    .sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="overlay-layer">
      {display.map((overlay) => {
        const screen = mapper.pdfRectToScreen(overlay.rect)
        const Renderer = RENDERERS[overlay.type]
        const selected = overlay.id === selectedOverlayId
        return (
          <div
            key={overlay.id}
            className={`ov${selected ? ' ov-selected' : ''}`}
            style={{
              left: screen.x,
              top: screen.y,
              width: screen.width,
              height: screen.height,
            }}
            onDoubleClick={() => {
              if (overlay.type === 'text' && activeToolId === 'select') {
                setSelectedOverlay(overlay.id)
                setEditingTextId(overlay.id)
              }
            }}
          >
            <Renderer overlay={overlay as never} mapper={mapper} page={page} />
          </div>
        )
      })}
    </div>
  )
}
