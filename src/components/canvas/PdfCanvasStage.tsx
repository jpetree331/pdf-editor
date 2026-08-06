// The workspace canvas: renders the current page, maps pointer events into
// PDF space, and dispatches them to the active tool by registry lookup.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { ZOOM_MAX, ZOOM_MIN, ZOOM_WHEEL_FACTOR } from '../../config/constants'
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
    setZoom,
  } = editor
  const state = useSessionState(session)
  const page = state.pages.find((p) => p.id === currentPageId) ?? state.pages[0] ?? null
  const pageIndex = page ? state.pages.findIndex((p) => p.id === page.id) : -1

  const canvasRef = usePageRender(state, page, zoom)
  const pageElRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureState>({ start: null, draft: null })
  const [liveDraft, setLiveDraft] = useState<OverlayObject | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  // Where on the page the cursor sat when a wheel-zoom fired, so the layout
  // effect below can keep that point under the cursor after the re-render.
  const zoomAnchorRef = useRef<{
    fx: number
    fy: number
    clientX: number
    clientY: number
  } | null>(null)

  // Ctrl+wheel (and trackpad pinch, which browsers report the same way)
  // zooms toward the cursor. Native non-passive listener — React's onWheel
  // can't preventDefault the browser's own page zoom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const pageEl = pageElRef.current
      if (pageEl) {
        const r = pageEl.getBoundingClientRect()
        zoomAnchorRef.current = {
          fx: (e.clientX - r.left) / r.width,
          fy: (e.clientY - r.top) / r.height,
          clientX: e.clientX,
          clientY: e.clientY,
        }
      }
      const factor = e.deltaY < 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR
      // Functional update: rapid wheel bursts arrive faster than re-renders,
      // so each tick must compound on the latest zoom, not the rendered one.
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom])

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const pageEl = pageElRef.current
    const el = scrollRef.current
    if (!anchor || !pageEl || !el) return
    zoomAnchorRef.current = null
    const r = pageEl.getBoundingClientRect()
    el.scrollBy({
      left: r.left + anchor.fx * r.width - anchor.clientX,
      top: r.top + anchor.fy * r.height - anchor.clientY,
    })
  }, [zoom])

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
      <div className="stage-scroll" ref={scrollRef}>
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
