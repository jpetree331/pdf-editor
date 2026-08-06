// The convert worker: builds .docx / .xlsx off the main thread. Inputs are
// pre-extracted (text clustering and any rasterization happen on the main
// thread, where pdf.js and canvas live); this worker only assembles files —
// which also keeps the docx library out of the main bundle.
import { Document, ImageRun, Packer, PageBreak, Paragraph, TextRun } from 'docx'
import { buildXlsx } from '../lib/export/xlsxMinimal'
import type { ConvertWorkerRequest, DocxRequest, WorkerResponse } from '../lib/workers/protocol'

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

async function buildDocx(req: DocxRequest): Promise<Uint8Array> {
  const children: Paragraph[] = []
  req.pages.forEach((page, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }))
    if (page.image) {
      // 96 dpi CSS pixels in Word-land; PDF points are 72 dpi.
      const width = Math.round((page.image.widthPt / 72) * 96)
      const height = Math.round((page.image.heightPt / 72) * 96)
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: page.image.bytes,
              type: 'jpg',
              transformation: { width: Math.min(width, 620), height: Math.round(height * Math.min(1, 620 / width)) },
            }),
          ],
        }),
      )
    }
    for (const para of page.paragraphs) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: para.text,
              // docx sizes are half-points.
              size: Math.round(Math.max(8, Math.min(72, para.fontSize)) * 2),
            }),
          ],
          spacing: { after: 120 },
        }),
      )
    }
  })

  const doc = new Document({
    title: req.title,
    sections: [{ children }],
  })
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

self.onmessage = async (e: MessageEvent<ConvertWorkerRequest>) => {
  const req = e.data
  try {
    const bytes = req.kind === 'DOCX' ? await buildDocx(req) : buildXlsx(req.sheets)
    post({ id: req.id, kind: 'RESULT', bytes }, [bytes.buffer])
  } catch (err) {
    post({ id: req.id, kind: 'ERROR', message: err instanceof Error ? err.message : String(err) })
  }
}
