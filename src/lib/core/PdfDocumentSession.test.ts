import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { PdfDocumentSession, PdfLoadError } from './PdfDocumentSession'
import { BLANK_SOURCE } from './types'

async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792])
  return doc.save()
}

describe('PdfDocumentSession', () => {
  it('loads a PDF and exposes its pages', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(3), fileName: 'test.pdf' },
    ])
    const state = session.getState()
    expect(state.pages).toHaveLength(3)
    expect(state.meta.title).toBe('test')
    expect(state.pages[0].baseSize).toEqual({ width: 612, height: 792 })
  })

  it('merges multiple files in order', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(2), fileName: 'a.pdf' },
      { bytes: await makePdf(3), fileName: 'b.pdf' },
    ])
    const state = session.getState()
    expect(state.pages).toHaveLength(5)
    expect(Object.keys(state.sources)).toHaveLength(2)
  })

  it('rejects non-PDF bytes with a friendly error', async () => {
    await expect(
      PdfDocumentSession.fromFiles([{ bytes: new Uint8Array([1, 2, 3]), fileName: 'x.pdf' }]),
    ).rejects.toBeInstanceOf(PdfLoadError)
  })

  it('uses the native CropBox∩MediaBox as the page frame', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([612, 792])
    page.setCropBox(20, 30, 572, 742)
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await doc.save(), fileName: 'cropped.pdf' },
    ])
    const loaded = session.getState().pages[0]
    expect(loaded.baseSize).toEqual({ width: 572, height: 742 })
    expect(loaded.baseOrigin).toEqual({ x: 20, y: 30 })
  })

  it('rotate accumulates and undoes', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(1), fileName: 'a.pdf' },
    ])
    const pageId = session.getState().pages[0].id
    session.rotatePage(pageId, 90)
    session.rotatePage(pageId, 90)
    expect(session.getPage(pageId)?.rotation).toBe(180)
    session.undo()
    expect(session.getPage(pageId)?.rotation).toBe(90)
    session.redo()
    expect(session.getPage(pageId)?.rotation).toBe(180)
  })

  it('never deletes the last page', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(1), fileName: 'a.pdf' },
    ])
    session.deletePages([session.getState().pages[0].id])
    expect(session.getState().pages).toHaveLength(1)
  })

  it('inserts a blank page matching the neighbor size', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(1), fileName: 'a.pdf' },
    ])
    session.insertBlankPage(0)
    const state = session.getState()
    expect(state.pages).toHaveLength(2)
    expect(state.pages[1].sourceId).toBe(BLANK_SOURCE)
    expect(state.pages[1].baseSize).toEqual({ width: 612, height: 792 })
  })

  it('inserts pages from another file and undoes cleanly', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(2), fileName: 'a.pdf' },
    ])
    await session.insertPagesFromFile(await makePdf(2), 'b.pdf', 0)
    expect(session.getState().pages).toHaveLength(4)
    session.undo()
    expect(session.getState().pages).toHaveLength(2)
  })

  it('notifies subscribers on dispatch', async () => {
    const session = await PdfDocumentSession.fromFiles([
      { bytes: await makePdf(1), fileName: 'a.pdf' },
    ])
    let calls = 0
    const unsub = session.subscribe(() => calls++)
    session.rotatePage(session.getState().pages[0].id, 90)
    expect(calls).toBe(1)
    unsub()
    session.undo()
    expect(calls).toBe(1)
  })
})
