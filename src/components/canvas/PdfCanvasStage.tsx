// The workspace canvas: renders the current page, maps pointer events into
// PDF space, and dispatches them to the active tool by registry lookup.
import { useCallback, useMemo, useRef, useState } from 'react'
import { useEditor } from '../../state/EditorContext'
import { useSessionState } from '../../hooks/useSessionState'
import { usePageRender } from '../../hooks/usePageRender'
import { CoordinateMapper } from '../../lib/core/coordinates/CoordinateMapper'
import { totalRotation, type OverlayObject, type Rect } from '../../lib/core/types'
import { TOOL_REGISTRY } from '../../config/tools'
import type { GestureState, ToolContext, ToolPointerEvent } from '../../tools/types'
import { OverlayLayer } from './OverlayLayer'
import { SelectionHandles } from './SelectionHandles'
import { IconButton } from '../common/primitives'
import './PdfCanvasStage.css'

export function PdfCanvasStage() {
  const editor = useEditor()
  const {
    session,
    currentPageId,
    setCurrentPage,
    activeToolId,
    selectedOverlayId,
    setSelectedOverlay,
    pendingPlacement,
    setPendingPlacement,
    setEditingTextId,
    zoom,
  } = editor
  const state = useSessionState(session)
  const page = state.pages.find((p) => p.id === currentPageId) ?? state.pages[0] ?? null
  const pageIndex = page ? state.pages.findIndex((p) => p.id === page.id) : -1

  const canvasRef = usePageRender(state, page, zoom)
  const pageElRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureState>({ start: null, draft: null })
  const [liveDraft, setLiveDraft] = useState<OverlayObject | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)

  const mapper = useMemo(() => {
    if (!page) return null
    return new CoordinateMapper(
      {
        baseWidth: page.baseSize.width,
        baseHeight: page.baseSize.height,
        rotation: totalRotation(page),
      },
      zoom,
    )
  }, [page, zoom])

  const toolCtx = useMemo<ToolContext | null>(() => {
    if (!session || !page || !mapper) return null
    return {
      session,
      pageId: page.id,
      mapper,
      ui: {
        getSelection: () => selectedOverlayId,
        setSelection: setSelectedOverlay,
        getPendingPlacement: () => pendingPlacement,
        clearPendingPlacement: () => setPendingPlacement(null),
        beginTextEdit: setEditingTextId,
      },
    }
  }, [
    session,
    page,
    mapper,
    selectedOverlayId,
    setSelectedOverlay,
    pendingPlacement,
    setPendingPlacement,
    setEditingTextId,
  ])

  const toToolEvent = useCallback(
    (e: React.PointerEvent): ToolPointerEvent | null => {
      if (!mapper || !pageElRef.current) return null
      const rect = pageElRef.current.getBoundingClientRect()
      const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      return { screenPoint, pdfPoint: mapper.screenToPdf(screenPoint), shiftKey: e.shiftKey }
    },
    [mapper],
  )

  const afterToolCall = useCallback(() => {
    setLiveDraft(gestureRef.current.draft)
    setMarquee(gestureRef.current.marquee ?? null)
  }, [])

  const behavior = TOOL_REGISTRY[activeToolId].behavior

  if (!session || !page || !mapper) return <div className="stage" />
  const viewport = mapper.viewportSize()

  return (
    <div className="stage">
      <div className="stage-scroll">
        <div
          ref={pageElRef}
          className="stage-page"
          style={{ width: viewport.width, height: viewport.height, cursor: TOOL_REGISTRY[activeToolId].cursor }}
          onPointerDown={(e) => {
            if (e.button !== 0 || !toolCtx) return
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // Synthetic or already-released pointers can't be captured — fine.
            }
            const ev = toToolEvent(e)
            if (ev) behavior.onPointerDown?.(toolCtx, ev, gestureRef.current)
            afterToolCall()
          }}
          onPointerMove={(e) => {
            if (!toolCtx || (!gestureRef.current.start && !gestureRef.current.draft)) return
            const ev = toToolEvent(e)
            if (ev) behavior.onPointerMove?.(toolCtx, ev, gestureRef.current)
            afterToolCall()
          }}
          onPointerUp={(e) => {
            if (!toolCtx) return
            const ev = toToolEvent(e)
            if (ev) behavior.onPointerUp?.(toolCtx, ev, gestureRef.current)
            afterToolCall()
          }}
        >
          <canvas ref={canvasRef} className="stage-canvas" />
          <OverlayLayer page={page} mapper={mapper} liveDraft={liveDraft} />
          <CropShade cropBox={page.cropBox} mapper={mapper} viewport={viewport} />
          {marquee && <Marquee rect={marquee} mapper={mapper} />}
          {selectedOverlayId &&
            (() => {
              const overlay = (state.overlaysByPage[page.id] ?? []).find(
                (o) => o.id === selectedOverlayId,
              )
              if (!overlay) return null
              return (
                <SelectionHandles
                  overlay={liveDraft?.id === overlay.id ? liveDraft : overlay}
                  mapper={mapper}
                  pageEl={pageElRef.current}
                  onDraft={setLiveDraft}
                  onCommit={(rect) => session.updateOverlay(page.id, overlay.id, { rect })}
                />
              )
            })()}
        </div>
      </div>

      <div className="stage-nav">
        <IconButton
          icon="chevronLeft"
          label="Previous page"
          disabled={pageIndex <= 0}
          onClick={() => setCurrentPage(state.pages[pageIndex - 1].id)}
        />
        <span>
          {pageIndex + 1} / {state.pages.length}
        </span>
        <IconButton
          icon="chevronRight"
          label="Next page"
          disabled={pageIndex >= state.pages.length - 1}
          onClick={() => setCurrentPage(state.pages[pageIndex + 1].id)}
        />
      </div>
    </div>
  )
}

function CropShade({
  cropBox,
  mapper,
  viewport,
}: {
  cropBox: Rect | null
  mapper: CoordinateMapper
  viewport: { width: number; height: number }
}) {
  if (!cropBox) return null
  const c = mapper.pdfRectToScreen(cropBox)
  return (
    <>
      <div className="crop-shade" style={{ left: 0, top: 0, width: viewport.width, height: c.y }} />
      <div
        className="crop-shade"
        style={{ left: 0, top: c.y + c.height, width: viewport.width, height: viewport.height - c.y - c.height }}
      />
      <div className="crop-shade" style={{ left: 0, top: c.y, width: c.x, height: c.height }} />
      <div
        className="crop-shade"
        style={{ left: c.x + c.width, top: c.y, width: viewport.width - c.x - c.width, height: c.height }}
      />
      <div
        className="crop-border"
        style={{ left: c.x, top: c.y, width: c.width, height: c.height }}
      />
    </>
  )
}

function Marquee({ rect, mapper }: { rect: Rect; mapper: CoordinateMapper }) {
  const s = mapper.pdfRectToScreen(rect)
  return (
    <div
      className="crop-marquee"
      style={{ left: s.x, top: s.y, width: s.width, height: s.height }}
    />
  )
}
