// Framework-free. Minimal affine 2D matrix, PDF-style column layout:
//   u = a*x + c*y + e
//   v = b*x + d*y + f
import type { Point } from '../types'

export type Matrix2D = [number, number, number, number, number, number]

export const IDENTITY: Matrix2D = [1, 0, 0, 1, 0, 0]

export function multiply(m2: Matrix2D, m1: Matrix2D): Matrix2D {
  // Applies m1 first, then m2 (standard composition m2 ∘ m1).
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a2 * a1 + c2 * b1,
    b2 * a1 + d2 * b1,
    a2 * c1 + c2 * d1,
    b2 * c1 + d2 * d1,
    a2 * e1 + c2 * f1 + e2,
    b2 * e1 + d2 * f1 + f2,
  ]
}

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
