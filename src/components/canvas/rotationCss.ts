// CSS transform that displays an unrotated PDF-space box inside its rotated
// screen-space container. Derivation mirrors CoordinateMapper's corner
// mapping; the container is the axis-aligned screen rect from the mapper.
import type { Rotation } from '../../lib/core/types'
import type { CSSProperties } from 'react'

export function rotatedContentStyle(
  rotation: Rotation,
  innerWidthPx: number,
  innerHeightPx: number,
): CSSProperties {
  const base: CSSProperties = {
    width: innerWidthPx,
    height: innerHeightPx,
    transformOrigin: 'top left',
  }
  switch (rotation) {
    case 0:
      return { width: innerWidthPx, height: innerHeightPx }
    case 90:
      return { ...base, transform: `translateX(${innerHeightPx}px) rotate(90deg)` }
    case 180:
      return {
        width: innerWidthPx,
        height: innerHeightPx,
        transform: 'rotate(180deg)',
      }
    case 270:
      return { ...base, transform: `translateY(${innerWidthPx}px) rotate(270deg)` }
  }
}
