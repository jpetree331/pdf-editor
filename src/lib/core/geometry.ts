// Framework-free. Pure rect/point math shared by tools, renderers, and bakers.
import type { Point, Rect } from './types'

/** Normalize a rect that may have negative width/height (drag in any direction). */
export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export function clampRectToPage(rect: Rect, pageWidth: number, pageHeight: number): Rect {
  const x = Math.max(0, Math.min(rect.x, pageWidth))
  const y = Math.max(0, Math.min(rect.y, pageHeight))
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width, pageWidth - x)),
    height: Math.max(0, Math.min(rect.height, pageHeight - y)),
  }
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

/** Fit a natural size inside a box, preserving aspect ratio (contain). */
export function containSize(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
): { width: number; height: number } {
  const scale = Math.min(boxW / naturalW, boxH / naturalH)
  return { width: naturalW * scale, height: naturalH * scale }
}
