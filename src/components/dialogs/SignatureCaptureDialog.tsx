// Capture a signature by drawing, typing, or uploading. The result is always
// a transparent PNG staged for placement — baking is identical to images.
import { useEffect, useRef, useState } from 'react'
import '@fontsource/dancing-script/700.css'
import { useEditor } from '../../state/EditorContext'
import type { ImageRef } from '../../lib/core/types'
import { Button, Modal } from '../common/primitives'
import { fileToImageRef } from '../inspector/Inspector'

const PAD_W = 560
const PAD_H = 200
const SIGNATURE_FONT = '700 72px "Dancing Script", cursive'

async function canvasToImageRef(canvas: HTMLCanvasElement): Promise<ImageRef> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save signature'))), 'image/png'),
  )
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: 'image/png',
    widthPx: canvas.width,
    heightPx: canvas.height,
  }
}

type Tab = 'draw' | 'type' | 'upload'

export function SignatureCaptureDialog() {
  const { setDialog, setPendingPlacement, setActiveTool } = useEditor()
  const [tab, setTab] = useState<Tab>('draw')
  const [typed, setTyped] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || tab !== 'draw') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a2a6b'
  }, [tab])

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * PAD_H,
    }
  }

  const finish = (imageData: ImageRef) => {
    setPendingPlacement({ type: 'signature', imageData })
    setActiveTool('signature')
    setDialog(null)
  }

  const useDrawn = async () => {
    if (!canvasRef.current || !hasInk) return
    finish(await canvasToImageRef(canvasRef.current))
  }

  const useTyped = async () => {
    const text = typed.trim()
    if (!text) return
    await document.fonts.load(SIGNATURE_FONT)
    const measure = document.createElement('canvas').getContext('2d')!
    measure.font = SIGNATURE_FONT
    const width = Math.ceil(measure.measureText(text).width) + 48
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = 130
    const ctx = canvas.getContext('2d')!
    ctx.font = SIGNATURE_FONT
    ctx.fillStyle = '#1a2a6b'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 24, 68)
    finish(await canvasToImageRef(canvas))
  }

  return (
    <Modal title="Create your signature" onClose={() => setDialog(null)} wide>
      <div className="sig-tabs">
        {(['draw', 'type', 'upload'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`sig-tab${tab === t ? ' sig-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'draw' ? 'Draw' : t === 'type' ? 'Type' : 'Upload'}
          </button>
        ))}
      </div>

      {tab === 'draw' && (
        <>
          <canvas
            ref={canvasRef}
            className="sig-pad"
            width={PAD_W}
            height={PAD_H}
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                // Synthetic or already-released pointers can't be captured — fine.
              }
              drawingRef.current = true
              const ctx = e.currentTarget.getContext('2d')!
              const p = pos(e)
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current) return
              const ctx = e.currentTarget.getContext('2d')!
              const p = pos(e)
              ctx.lineTo(p.x, p.y)
              ctx.stroke()
              setHasInk(true)
            }}
            onPointerUp={() => (drawingRef.current = false)}
          />
          <div className="dlg-actions">
            <Button
              variant="ghost"
              onClick={() => {
                canvasRef.current
                  ?.getContext('2d')
                  ?.clearRect(0, 0, PAD_W, PAD_H)
                setHasInk(false)
              }}
            >
              Clear
            </Button>
            <Button variant="primary" disabled={!hasInk} onClick={() => void useDrawn()}>
              Use signature
            </Button>
          </div>
        </>
      )}

      {tab === 'type' && (
        <>
          <input
            value={typed}
            placeholder="Type your name"
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
          <div className="sig-preview">{typed || 'Your name'}</div>
          <div className="dlg-actions">
            <Button variant="primary" disabled={!typed.trim()} onClick={() => void useTyped()}>
              Use signature
            </Button>
          </div>
        </>
      )}

      {tab === 'upload' && (
        <>
          <p className="dlg-note">
            Upload a PNG (transparent background works best) or JPEG of your signature.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                finish(await fileToImageRef(file))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not read that image.')
              }
            }}
          />
          {error && <p className="dlg-note dlg-note-warn">{error}</p>}
        </>
      )}
    </Modal>
  )
}
