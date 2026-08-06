// Framework-free. The one RGB→CSS conversion, shared by DOM renderers,
// canvas painters, and inspectors.
import type { RGBColor } from './types'

export function rgbaCss(c: RGBColor, alpha = 1): string {
  const to255 = (v: number) => Math.round(v * 255)
  return alpha >= 1
    ? `rgb(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)})`
    : `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${alpha})`
}
