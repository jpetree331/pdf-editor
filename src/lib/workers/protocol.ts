// Framework-free. Typed message protocol between the main thread and workers.
// Every request carries a correlation id; responses are PROGRESS*, then one
// RESULT or ERROR.
import type { DocumentSessionState, PageId } from '../core/types'
import type { RasterizedPage } from '../export/bakePipeline'

export interface BakeRequest {
  id: string
  kind: 'BAKE'
  state: DocumentSessionState
  rasterized: Record<PageId, RasterizedPage>
  pageIds?: PageId[]
}
export type ExportWorkerRequest = BakeRequest

export interface DocxParagraph {
  text: string
  fontSize: number
}
export interface DocxPageInput {
  paragraphs: DocxParagraph[]
  /** Fallback for pages with no text layer (scans): embed the page image. */
  image?: { bytes: Uint8Array; widthPt: number; heightPt: number }
}
export interface DocxRequest {
  id: string
  kind: 'DOCX'
  title: string
  pages: DocxPageInput[]
}

export interface XlsxSheet {
  name: string
  rows: string[][]
}
export interface XlsxRequest {
  id: string
  kind: 'XLSX'
  sheets: XlsxSheet[]
}
export type ConvertWorkerRequest = DocxRequest | XlsxRequest

export type WorkerResponse =
  | { id: string; kind: 'PROGRESS'; fraction: number }
  | { id: string; kind: 'RESULT'; bytes: Uint8Array }
  | { id: string; kind: 'ERROR'; message: string }
