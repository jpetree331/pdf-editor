import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { bakeDocument, wrapText, type RasterizedPage } from './bakePipeline'
import { buildXlsx } from './xlsxMinimal'
import { parsePageRanges } from '../pageRanges'
import type {
  DocumentSessionState,
  PageState,
  TextOverlay,
} from '../core/types'
import { BLANK_SOURCE } from '../core/types'

async function makeSourcePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792])
    page.drawText(`Source page ${i + 1}`, { x: 50, y: 700, size: 14, font })
  }
  return doc.save()
}

function pageState(id: string, sourceId: string, index: number, extra?: Partial<PageState>): PageState {
  return {
    id,
    sourceId,
    sourcePageIndex: index,
    rotation: 0,
    baseRotation: 0,
    cropBox: null,
    baseSize: { width: 612, height: 792 },
    baseOrigin: { x: 0, y: 0 },
    ...extra,
  }
}

async function makeState(): Promise<DocumentSessionState> {
  const bytes = await makeSourcePdf(3)
  return {
    sources: { s1: { id: 's1', fileName: 'a.pdf', bytes, pageCount: 3 } },
    pages: [pageState('p1', 's1', 0), pageState('p2', 's1', 1), pageState('p3', 's1', 2)],
    overlaysByPage: {},
    meta: { title: 'test-doc' },
  }
}

describe('bakeDocument', () => {
  it('bakes a plain document and preserves page count', async () => {
    const state = await makeState()
    const bytes = await bakeDocument({ state, rasterized: {} })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(3)
  })

  it('respects reorder, rotation, crop, and blank pages', async () => {
    const state = await makeState()
    state.pages = [
      { ...state.pages[2], rotation: 90 },
      pageState('blank1', BLANK_SOURCE, 0),
      { ...state.pages[0], cropBox: { x: 50, y: 50, width: 400, height: 500 } },
    ]
    const bytes = await bakeDocument({ state, rasterized: {} })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(3)
    expect(result.getPage(0).getRotation().angle).toBe(90)
    const crop = result.getPage(2).getCropBox()
    expect(crop.width).toBe(400)
    expect(crop.height).toBe(500)
  })

  it('draws text, highlight, and erase overlays on the vector path', async () => {
    const state = await makeState()
    const text: TextOverlay = {
      id: 'o1',
      pageId: 'p1',
      type: 'text',
      rect: { x: 50, y: 600, width: 200, height: 60 },
      zIndex: 1,
      text: 'Hello from the editor — with wrapping text that is long enough to wrap.',
      fontSize: 12,
      color: { r: 0, g: 0, b: 0 },
      align: 'left',
      bold: false,
      lineHeight: 1.3,
    }
    state.overlaysByPage['p1'] = [
      text,
      {
        id: 'o2',
        pageId: 'p1',
        type: 'highlight',
        rect: { x: 50, y: 690, width: 150, height: 20 },
        zIndex: 2,
        color: { r: 1, g: 0.85, b: 0.2 },
      },
      {
        id: 'o3',
        pageId: 'p1',
        type: 'erase',
        rect: { x: 50, y: 660, width: 150, height: 20 },
        zIndex: 3,
        fillColor: { r: 1, g: 1, b: 1 },
      },
    ]
    const bytes = await bakeDocument({ state, rasterized: {} })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(3)
  })

  it('replaces rasterized pages with images and never vector-bakes redactions', async () => {
    const state = await makeState()
    state.overlaysByPage['p2'] = [
      { id: 'r1', pageId: 'p2', type: 'redact', rect: { x: 0, y: 0, width: 100, height: 100 }, zIndex: 1 },
    ]
    // A 1x1 white JPEG.
    const jpeg = Uint8Array.from(
      atob(
        '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
      ),
      (c) => c.charCodeAt(0),
    )
    const rasterized: Record<string, RasterizedPage> = {
      p2: { jpeg, widthPt: 612, heightPt: 792 },
    }
    const bytes = await bakeDocument({ state, rasterized })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(3)

    // Without the raster, the redacted page must be refused, not silently covered.
    await expect(bakeDocument({ state, rasterized: {} })).rejects.toThrow(/redact/i)
  })

  it('offsets session crop by the page view-box origin', async () => {
    const state = await makeState()
    state.pages = [
      {
        ...state.pages[0],
        baseOrigin: { x: 20, y: 30 },
        baseSize: { width: 572, height: 742 },
        cropBox: { x: 10, y: 10, width: 100, height: 100 },
      },
    ]
    const bytes = await bakeDocument({ state, rasterized: {} })
    const result = await PDFDocument.load(bytes)
    const crop = result.getPage(0).getCropBox()
    expect(crop.x).toBe(30)
    expect(crop.y).toBe(40)
    expect(crop.width).toBe(100)
    expect(crop.height).toBe(100)
  })

  it('extracts a subset in state order', async () => {
    const state = await makeState()
    const bytes = await bakeDocument({ state, rasterized: {}, pageIds: ['p3', 'p1'] })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(2)
  })

  it('refuses an empty selection', async () => {
    const state = await makeState()
    await expect(bakeDocument({ state, rasterized: {}, pageIds: ['nope'] })).rejects.toThrow()
  })
})

describe('wrapText', () => {
  it('wraps long lines and respects explicit newlines', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const lines = wrapText(font, 'one two three four five six seven\nnext', 12, 60)
    expect(lines.length).toBeGreaterThan(2)
    expect(lines[lines.length - 1]).toBe('next')
  })
})

describe('buildXlsx', () => {
  it('produces a valid zip with workbook parts and escaped cells', () => {
    const bytes = buildXlsx([
      { name: 'Page 1', rows: [['Region', 'Q1 & Q2'], ['North <cell>', '1,200']] },
    ])
    const files = unzipSync(bytes)
    expect(Object.keys(files)).toContain('xl/workbook.xml')
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml')
    const sheet = new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('Q1 &amp; Q2')
    expect(sheet).toContain('North &lt;cell&gt;')
  })
})

describe('parsePageRanges', () => {
  it('parses mixed ranges', () => {
    expect(parsePageRanges('1-3, 5', 10)).toEqual([0, 1, 2, 4])
  })
  it('rejects out-of-bounds and garbage', () => {
    expect(parsePageRanges('0-2', 10)).toBeNull()
    expect(parsePageRanges('9-11', 10)).toBeNull()
    expect(parsePageRanges('a-b', 10)).toBeNull()
    expect(parsePageRanges('', 10)).toBeNull()
  })
})
