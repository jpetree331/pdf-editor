// Framework-free. THE single place screen↔PDF-point conversion happens.
// Everything that maps between the rendered page (CSS px, top-left origin,
// y down, rotated) and PDF space (points, bottom-left origin, y up, unrotated)
// goes through this class. Nothing else in the codebase does its own trig.
//
// Screen-space convention matches a pdf.js viewport created with
// rotation = totalRotation(page) and the same scale.
import type { Point, Rect, Rotation } from '../types'
import { type Matrix2D, applyToPoint, invert } from './matrix'

export interface PageGeometry {
  /** MediaBox size in the page's unrotated space (PDF points). */
  baseWidth: number
  baseHeight: number
  /** Total display rotation: source /Rotate + session rotation. */
  rotation: Rotation
}

/** Screen size of the rendered page at a given scale (w/h swap for 90/270). */
export function viewportSize(
  geometry: PageGeometry,
  scale: number,
): { width: number; height: number } {
  const rotated = geometry.rotation === 90 || geometry.rotation === 270
  return {
    width: (rotated ? geometry.baseHeight : geometry.baseWidth) * scale,
    height: (rotated ? geometry.baseWidth : geometry.baseHeight) * scale,
  }
}

/** toScreen matrix for a clockwise display rotation, derived from corner fixtures:
 *    r=0:   u =  s·x,        v = s·(H − y)
 *    r=90:  u =  s·y,        v = s·x
 *    r=180: u =  s·(W − x),  v = s·y
 *    r=270: u =  s·(H − y),  v = s·(W − x)
 */
function toScreenMatrix(g: PageGeometry, s: number): Matrix2D {
  const W = g.baseWidth
  const H = g.baseHeight
  switch (g.rotation) {
    case 0:
      return [s, 0, 0, -s, 0, s * H]
    case 90:
      return [0, s, s, 0, 0, 0]
    case 180:
      return [-s, 0, 0, s, s * W, 0]
    case 270:
      return [0, -s, -s, 0, s * H, s * W]
  }
}

export class CoordinateMapper {
  readonly geometry: PageGeometry
  readonly scale: number
  private readonly toScreen: Matrix2D
  private readonly toPdf: Matrix2D

  constructor(geometry: PageGeometry, scale: number) {
    this.geometry = geometry
    this.scale = scale
    this.toScreen = toScreenMatrix(geometry, scale)
    this.toPdf = invert(this.toScreen)
  }

  viewportSize(): { width: number; height: number } {
    return viewportSize(this.geometry, this.scale)
  }

  pdfToScreen(p: Point): Point {
    return applyToPoint(this.toScreen, p)
  }

  screenToPdf(p: Point): Point {
    return applyToPoint(this.toPdf, p)
  }

  /** Transform all four corners and re-derive the axis-aligned rect. */
  pdfRectToScreen(r: Rect): Rect {
    return transformRect(this.toScreen, r)
  }

  screenRectToPdf(r: Rect): Rect {
    return transformRect(this.toPdf, r)
  }
}

function transformRect(m: Matrix2D, r: Rect): Rect {
  const corners = [
    applyToPoint(m, { x: r.x, y: r.y }),
    applyToPoint(m, { x: r.x + r.width, y: r.y }),
    applyToPoint(m, { x: r.x, y: r.y + r.height }),
    applyToPoint(m, { x: r.x + r.width, y: r.y + r.height }),
  ]
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}
