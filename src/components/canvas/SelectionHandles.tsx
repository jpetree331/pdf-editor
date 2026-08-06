// Corner resize handles for the selected overlay. All math happens in PDF
// space via the mapper, so resizing behaves identically on rotated pages.
import { useRef } from 'react'
import type { CoordinateMapper } from '../../lib/core/coordinates/CoordinateMapper'
import type { OverlayObject, Point, Rect } from '../../lib/core/types'
import { normalizeRect, clampRectToPage } from '../../lib/core/geometry'
import './SelectionHandles.css'

const MIN_SIZE = 8 // PDF points

type Corner = 'nw' | 'ne' | 'sw' | 'se'
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

/** The PDF-space anchor is the corner opposite the dragged screen handle. */
function oppositeCornerPdf(rect: Rect, mapper: CoordinateMapper, corner: Corner): Point {
  const screen = mapper.pdfRectToScreen(rect)
  const sx = corner.includes('w') ? screen.x + screen.width : screen.x
  const sy = corner.includes('n') ? screen.y + screen.height : screen.y
  return mapper.screenToPdf({ x: sx, y: sy })
}

export function SelectionHandles({
  overlay,
  mapper,
  pageEl,
  onDraft,
  onCommit,
}: {
  overlay: OverlayObject
  mapper: CoordinateMapper
  /** The positioned page container, for pointer coordinates. */
  pageEl: HTMLElement | null
  onDraft: (draft: OverlayObject | null) => void
  onCommit: (rect: Rect) => void
}) {
  const dragRef = useRef<{ anchor: Point; latest: Rect | null } | null>(null)
  const screen = mapper.pdfRectToScreen(overlay.rect)

  const toPagePoint = (e: PointerEvent | React.PointerEvent): Point => {
    const rect = pageEl?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const startResize = (corner: Corner) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const anchor = oppositeCornerPdf(overlay.rect, mapper, corner)
    dragRef.current = { anchor, latest: null }

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const pdfPoint = mapper.screenToPdf(toPagePoint(ev))
      let rect = normalizeRect(drag.anchor, pdfPoint)
      rect = clampRectToPage(rect, mapper.geometry.baseWidth, mapper.geometry.baseHeight)
      if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return
      drag.latest = rect
      onDraft({ ...overlay, rect })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const latest = dragRef.current?.latest
      dragRef.current = null
      onDraft(null)
      if (latest) onCommit(latest)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="sel-box"
      style={{ left: screen.x, top: screen.y, width: screen.width, height: screen.height }}
    >
      {CORNERS.map((corner) => (
        <div
          key={corner}
          className={`sel-handle sel-${corner}`}
          onPointerDown={startResize(corner)}
        />
      ))}
    </div>
  )
}
