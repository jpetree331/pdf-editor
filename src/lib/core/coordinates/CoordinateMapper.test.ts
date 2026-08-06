import { describe, expect, it } from 'vitest'
import { CoordinateMapper, type PageGeometry } from './CoordinateMapper'
import type { Point, Rotation } from '../types'

const W = 612
const H = 792
const ROTATIONS: Rotation[] = [0, 90, 180, 270]

function geo(rotation: Rotation): PageGeometry {
  return { baseWidth: W, baseHeight: H, rotation }
}

describe('CoordinateMapper golden fixtures', () => {
  // PDF-space corners: BL(0,0) BR(W,0) TR(W,H) TL(0,H); screen y is down.
  const fixtures: Record<Rotation, Array<[Point, Point]>> = {
    0: [
      [{ x: 0, y: H }, { x: 0, y: 0 }],        // TL -> screen origin
      [{ x: W, y: H }, { x: W, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: H }],
      [{ x: W, y: 0 }, { x: W, y: H }],
    ],
    90: [
      [{ x: 0, y: 0 }, { x: 0, y: 0 }],        // BL -> screen origin
      [{ x: 0, y: H }, { x: H, y: 0 }],
      [{ x: W, y: 0 }, { x: 0, y: W }],
      [{ x: W, y: H }, { x: H, y: W }],
    ],
    180: [
      [{ x: W, y: 0 }, { x: 0, y: 0 }],        // BR -> screen origin
      [{ x: 0, y: 0 }, { x: W, y: 0 }],
      [{ x: W, y: H }, { x: 0, y: H }],
      [{ x: 0, y: H }, { x: W, y: H }],
    ],
    270: [
      [{ x: W, y: H }, { x: 0, y: 0 }],        // TR -> screen origin
      [{ x: W, y: 0 }, { x: H, y: 0 }],
      [{ x: 0, y: H }, { x: 0, y: W }],
      [{ x: 0, y: 0 }, { x: H, y: W }],
    ],
  }

  for (const rotation of ROTATIONS) {
    it(`maps corners correctly at rotation ${rotation}`, () => {
      const mapper = new CoordinateMapper(geo(rotation), 1)
      for (const [pdf, screen] of fixtures[rotation]) {
        const got = mapper.pdfToScreen(pdf)
        expect(got.x).toBeCloseTo(screen.x, 6)
        expect(got.y).toBeCloseTo(screen.y, 6)
      }
    })
  }

  it('swaps viewport dimensions for 90/270', () => {
    expect(new CoordinateMapper(geo(0), 1).viewportSize()).toEqual({ width: W, height: H })
    expect(new CoordinateMapper(geo(90), 1).viewportSize()).toEqual({ width: H, height: W })
    expect(new CoordinateMapper(geo(270), 2).viewportSize()).toEqual({ width: H * 2, height: W * 2 })
  })

  it('applies scale', () => {
    const mapper = new CoordinateMapper(geo(0), 1.5)
    expect(mapper.pdfToScreen({ x: 100, y: H })).toEqual({ x: 150, y: 0 })
  })
})

describe('CoordinateMapper round trips', () => {
  const points: Point[] = [
    { x: 0, y: 0 },
    { x: W, y: H },
    { x: 123.4, y: 567.8 },
    { x: W / 2, y: H / 2 },
  ]
  const scales = [0.5, 1, 1.75]

  for (const rotation of ROTATIONS) {
    for (const scale of scales) {
      it(`round-trips points at rotation ${rotation}, scale ${scale}`, () => {
        const mapper = new CoordinateMapper(geo(rotation), scale)
        for (const p of points) {
          const back = mapper.screenToPdf(mapper.pdfToScreen(p))
          expect(back.x).toBeCloseTo(p.x, 6)
          expect(back.y).toBeCloseTo(p.y, 6)
        }
      })
    }
  }

  for (const rotation of ROTATIONS) {
    it(`round-trips rects at rotation ${rotation}`, () => {
      const mapper = new CoordinateMapper(geo(rotation), 1.25)
      const rect = { x: 50, y: 60, width: 200, height: 80 }
      const back = mapper.screenRectToPdf(mapper.pdfRectToScreen(rect))
      expect(back.x).toBeCloseTo(rect.x, 6)
      expect(back.y).toBeCloseTo(rect.y, 6)
      expect(back.width).toBeCloseTo(rect.width, 6)
      expect(back.height).toBeCloseTo(rect.height, 6)
    })
  }

  it('preserves rect area under rotation (axis-aligned in both spaces)', () => {
    const mapper = new CoordinateMapper(geo(90), 1)
    const screen = mapper.pdfRectToScreen({ x: 10, y: 20, width: 100, height: 40 })
    // 90° rotation swaps width/height.
    expect(screen.width).toBeCloseTo(40, 6)
    expect(screen.height).toBeCloseTo(100, 6)
  })
})
