// Framework-free. Lazy worker singletons + a generic promise/progress bridge
// over the typed protocol. Correlation is by request id, so overlapping jobs
// on one worker stay untangled.
import type { WorkerResponse } from './protocol'

let exportWorker: Worker | null = null
let convertWorker: Worker | null = null

export function getExportWorker(): Worker {
  if (!exportWorker) {
    exportWorker = new Worker(new URL('../../workers/export.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return exportWorker
}

export function getConvertWorker(): Worker {
  if (!convertWorker) {
    convertWorker = new Worker(new URL('../../workers/convert.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return convertWorker
}

export function postJob<Req extends { id: string }>(
  worker: Worker,
  request: Req,
  onProgress?: (fraction: number) => void,
  transfer: Transferable[] = [],
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.id !== request.id) return
      if (msg.kind === 'PROGRESS') {
        onProgress?.(msg.fraction)
        return
      }
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (msg.kind === 'RESULT') resolve(msg.bytes)
      else reject(new Error(msg.message))
    }
    const onError = (e: ErrorEvent) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(new Error(e.message || 'Worker failed'))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(request, transfer)
  })
}
