// The export worker: hosts the pdf-lib bake so large saves never block the UI.
// Compression is a bake too (standard = object-stream save; aggressive mode's
// rasterization happens on the main thread, where canvas lives).
import { bakeDocument } from '../lib/export/bakePipeline'
import type { ExportWorkerRequest, WorkerResponse } from '../lib/workers/protocol'

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = async (e: MessageEvent<ExportWorkerRequest>) => {
  const req = e.data
  try {
    const bytes = await bakeDocument(
      { state: req.state, rasterized: req.rasterized, pageIds: req.pageIds },
      (fraction) => post({ id: req.id, kind: 'PROGRESS', fraction }),
    )
    post({ id: req.id, kind: 'RESULT', bytes }, [bytes.buffer])
  } catch (err) {
    post({ id: req.id, kind: 'ERROR', message: err instanceof Error ? err.message : String(err) })
  }
}
