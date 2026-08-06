// Browser-only (pdf.js). Positional text extraction with line/paragraph/cell
// clustering — the honest, best-effort input for Word/Excel conversion.
// Complex layouts degrade gracefully; scanned pages report hasText: false.
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { DocumentSessionState, PageState } from '../core/types'
import { getPageProxy } from './pdfjsLoader'
import type { DocxPageInput, DocxParagraph } from '../workers/protocol'

interface PositionedItem {
  x: number
  y: number
  text: string
  fontSize: number
  width: number
}

export interface ExtractedLine {
  y: number
  fontSize: number
  items: PositionedItem[]
  text: string
}

export interface ExtractedPage {
  hasText: boolean
  lines: ExtractedLine[]
}

export async function extractPageText(
  state: DocumentSessionState,
  page: PageState,
): Promise<ExtractedPage> {
  const proxy = await getPageProxy(state, page)
  if (!proxy) return { hasText: false, lines: [] }

  const content = await proxy.getTextContent()
  const items: PositionedItem[] = []
  for (const raw of content.items) {
    const item = raw as TextItem
    if (typeof item.str !== 'string' || item.str.trim().length === 0) continue
    const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 10
    items.push({
      x: item.transform[4],
      y: item.transform[5],
      text: item.str,
      fontSize,
      width: item.width,
    })
  }
  if (items.length === 0) return { hasText: false, lines: [] }

  // Cluster into lines by baseline y (tolerance scales with font size).
  items.sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: ExtractedLine[] = []
  for (const item of items) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(line.y - item.y) <= Math.max(2, line.fontSize * 0.4)) {
      line.items.push(item)
    } else {
      lines.push({ y: item.y, fontSize: item.fontSize, items: [item], text: '' })
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    line.fontSize = Math.max(...line.items.map((i) => i.fontSize))
    line.text = line.items
      .map((item, i) => {
        if (i === 0) return item.text
        const prev = line.items[i - 1]
        const gap = item.x - (prev.x + prev.width)
        return (gap > item.fontSize * 0.25 ? ' ' : '') + item.text
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return { hasText: true, lines: lines.filter((l) => l.text.length > 0) }
}

/** Merge lines into paragraphs: a gap much larger than the line height breaks. */
export function linesToParagraphs(lines: ExtractedLine[]): DocxParagraph[] {
  const paragraphs: DocxParagraph[] = []
  let current: string[] = []
  let currentSize = 0

  const flush = () => {
    if (current.length > 0) {
      paragraphs.push({ text: current.join(' '), fontSize: currentSize })
      current = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = lines[i - 1]
    const sizeChanged = currentSize > 0 && Math.abs(line.fontSize - currentSize) > 1.5
    const bigGap = prev ? prev.y - line.y > Math.max(prev.fontSize, line.fontSize) * 1.8 : false
    if (sizeChanged || bigGap) flush()
    currentSize = Math.max(currentSize, line.fontSize)
    current.push(line.text)
  }
  flush()
  return paragraphs
}

/** Split each line into cells on large horizontal gaps — rough table recovery. */
export function linesToRows(lines: ExtractedLine[]): string[][] {
  return lines.map((line) => {
    const cells: string[] = []
    let cell = ''
    for (let i = 0; i < line.items.length; i++) {
      const item = line.items[i]
      if (i > 0) {
        const prev = line.items[i - 1]
        const gap = item.x - (prev.x + prev.width)
        if (gap > Math.max(line.fontSize * 1.4, 12)) {
          cells.push(cell.trim())
          cell = ''
        } else if (gap > item.fontSize * 0.25) {
          cell += ' '
        }
      }
      cell += item.text
    }
    cells.push(cell.trim())
    return cells
  })
}

export function pageToDocxInput(extracted: ExtractedPage): Pick<DocxPageInput, 'paragraphs'> {
  return { paragraphs: linesToParagraphs(extracted.lines) }
}
