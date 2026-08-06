// Renders a PageState into a canvas element, cancelling any in-flight render
// when the page, rotation, or scale changes.
import { useEffect, useRef } from 'react'
import type { DocumentSessionState, PageState } from '../lib/core/types'
import { getPageProxy, renderPageToCanvas } from '../lib/render/pdfjsLoader'

export function usePageRender(
  state: DocumentSessionState,
  page: PageState | null,
  scale: number,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Sources are append-only, so reading the latest state from a ref is safe —
  // and it keeps unrelated dispatches (overlay edits) from re-rendering the canvas.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !page) return
    let cancelled = false
    let cancelRender: (() => void) | null = null

    void (async () => {
      try {
        const proxy = await getPageProxy(stateRef.current, page)
        if (cancelled || !canvasRef.current) return
        const result = renderPageToCanvas(proxy, page, canvasRef.current, scale)
        cancelRender = result.cancel
        await result.done
      } catch (err) {
        if (!cancelled) console.error('Page render failed', err)
      }
    })()

    return () => {
      cancelled = true
      cancelRender?.()
    }
    // Deliberately narrow deps: render is driven by page identity, rotation and scale.
  }, [page?.id, page?.rotation, page?.baseRotation, scale])

  return canvasRef
}
