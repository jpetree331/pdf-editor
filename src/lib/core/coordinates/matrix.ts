// Framework-free. Minimal affine 2D matrix, PDF-style column layout:
//   u = a*x + c*y + e
//   v = b*x + d*y + f
import type { Point } from '../types'

export type Matrix2D = [number, number, number, number, number, number]

export function invert(m: Matrix2D): Matrix2D {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  if (det === 0) throw new Error('Matrix is not invertible')
  const ia = d / det
  const ib = -b / det
  const ic = -c / det
  const id = a / det
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)]
}

export function applyToPoint(m: Matrix2D, p: Point): Point {
  const [a, b, c, d, e, f] = m
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }
}
