// Main-thread orchestration for every heavy operation: pre-rasterize where
// canvas is needed, hand assembly to workers, download the result. One hook,
// one progress surface.
import { useCallback, useState } from 'react'
import { zipSync } from 'fflate'
import { useEditor } from '../state/EditorContext'
import { newId } from '../lib/core/ids'
import type { DocumentSessionState, PageId, PageState } from '../lib/core/types'
import { pageHasRedaction } from '../lib/core/types'
import type { RasterizedPage } from '../lib/export/bakePipeline'
import { rasterizePage } from '../lib/render/rasterizePage'
import { extractPageText, linesToRows, pageToDocxInput } from '../lib/render/textExtract'
import { getConvertWorker, getExportWorker, postJob } from '../lib/workers/workerClient'
import type { DocxPageInput, XlsxSheet } from '../lib/workers/protocol'
import { downloadBytes } from '../lib/fileIO'
import {
  IMAGE_EXPORT_DPI,
  REDACTION_DPI,
  REDACTION_JPEG_QUALITY,
} from '../config/constants'

export interface JobProgress {
  message: string
  fraction: number | null
}

interface RasterPlan {
  pages: PageState[]
  dpi: number
  quality: number
}

export function useJobs() {
  const { session, setDialog } = useEditor()
  const [job, setJob] = useState<JobProgress | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)

  const run = useCallback(
    async (work: () => Promise<void>) => {
      if (!session) return
      setJobError(null)
      try {
        await work()
        setDialog(null)
      } catch (err) {
        setJobError(err instanceof Error ? err.message : String(err))
      } finally {
        setJob(null)
      }
    },
    [session, setDialog],
  )

  const rasterizeSet = useCallback(
    async (state: DocumentSessionState, plan: RasterPlan, label: string) => {
      const rasterized: Record<PageId, RasterizedPage> = {}
      for (let i = 0; i < plan.pages.length; i++) {
        setJob({ message: label, fraction: plan.pages.length > 1 ? i / plan.pages.length : null })
        const page = plan.pages[i]
        const raster = await rasterizePage(state, page, {
          dpi: plan.dpi,
          quality: plan.quality,
          format: 'image/jpeg',
        })
        rasterized[page.id] = {
          jpeg: raster.bytes,
          widthPt: raster.widthPt,
          heightPt: raster.heightPt,
        }
      }
      return rasterized
    },
    [],
  )

  /** Bake a PDF: rasterizes redacted pages (or all, for aggressive compress). */
  const bake = useCallback(
    async (options: {
      pageIds?: PageId[]
      aggressive?: { dpi: number; quality: number } | null
      progressLabel: string
    }): Promise<Uint8Array> => {
      if (!session) throw new Error('No document open')
      const state = session.getState()
      const included = options.pageIds
        ? state.pages.filter((p) => options.pageIds!.includes(p.id))
        : state.pages

      const toRaster = options.aggressive
        ? included
        : included.filter((p) => pageHasRedaction(state, p.id))
      const rasterized = await rasterizeSet(
        state,
        {
          pages: toRaster,
          dpi: options.aggressive?.dpi ?? REDACTION_DPI,
          quality: options.aggressive?.quality ?? REDACTION_JPEG_QUALITY,
        },
        options.aggressive ? 'Rendering pages…' : 'Flattening redacted pages…',
      )

      setJob({ message: options.progressLabel, fraction: 0 })
      return postJob(
        getExportWorker(),
        {
          id: newId(),
          kind: 'BAKE' as const,
          state,
          rasterized,
          pageIds: options.pageIds,
        },
        (fraction) => setJob({ message: options.progressLabel, fraction }),
        Object.values(rasterized).map((r) => r.jpeg.buffer),
      )
    },
    [session, rasterizeSet],
  )

  const baseName = useCallback((): string => {
    return session?.getState().meta.title.trim() || 'document'
  }, [session])

  const exportPdf = useCallback(
    (fileName?: string) =>
      run(async () => {
        const bytes = await bake({ progressLabel: 'Building PDF…' })
        downloadBytes(bytes, `${fileName?.trim() || baseName()}.pdf`, 'application/pdf')
      }),
    [run, bake, baseName],
  )

  const compress = useCallback(
    (aggressive: { dpi: number; quality: number } | null) =>
      run(async () => {
        const bytes = await bake({ aggressive, progressLabel: 'Compressing…' })
        downloadBytes(bytes, `${baseName()}-compressed.pdf`, 'application/pdf')
      }),
    [run, bake, baseName],
  )

  const extractPages = useCallback(
    (indexes: number[]) =>
      run(async () => {
        if (!session) return
        const state = session.getState()
        const pageIds = indexes.map((i) => state.pages[i]?.id).filter(Boolean)
        const bytes = await bake({ pageIds, progressLabel: 'Extracting pages…' })
        downloadBytes(bytes, `${baseName()}-extract.pdf`, 'application/pdf')
      }),
    [run, bake, session, baseName],
  )

  const splitParts = useCallback(
    (parts: number[][]) =>
      run(async () => {
        if (!session) return
        const state = session.getState()
        const files: Record<string, Uint8Array> = {}
        for (let i = 0; i < parts.length; i++) {
          const pageIds = parts[i].map((n) => state.pages[n]?.id).filter(Boolean)
          if (pageIds.length === 0) continue
          const bytes = await bake({
            pageIds,
            progressLabel: `Building part ${i + 1} of ${parts.length}…`,
          })
          files[`${baseName()}-part${i + 1}.pdf`] = bytes
        }
        setJob({ message: 'Zipping…', fraction: null })
        downloadBytes(zipSync(files), `${baseName()}-split.zip`, 'application/zip')
      }),
    [run, bake, session, baseName],
  )

  const convertImages = useCallback(
    (format: 'image/png' | 'image/jpeg') =>
      run(async () => {
        if (!session) return
        const state = session.getState()
        const ext = format === 'image/png' ? 'png' : 'jpg'
        const outputs: Record<string, Uint8Array> = {}
        for (let i = 0; i < state.pages.length; i++) {
          setJob({ message: 'Rendering pages…', fraction: i / state.pages.length })
          const raster = await rasterizePage(state, state.pages[i], {
            dpi: IMAGE_EXPORT_DPI,
            quality: 0.9,
            format,
          })
          outputs[`${baseName()}-page${String(i + 1).padStart(2, '0')}.${ext}`] = raster.bytes
        }
        const names = Object.keys(outputs)
        if (names.length === 1) {
          downloadBytes(outputs[names[0]], names[0], format)
        } else {
          setJob({ message: 'Zipping…', fraction: null })
          downloadBytes(zipSync(outputs), `${baseName()}-images.zip`, 'application/zip')
        }
      }),
    [run, session, baseName],
  )

  const convertDocx = useCallback(
    () =>
      run(async () => {
        if (!session) return
        const state = session.getState()
        const pages: DocxPageInput[] = []
        for (let i = 0; i < state.pages.length; i++) {
          setJob({ message: 'Reading text…', fraction: i / state.pages.length })
          const page = state.pages[i]
          const extracted = await extractPageText(state, page)
          if (extracted.hasText) {
            pages.push({ ...pageToDocxInput(extracted) })
          } else {
            // No text layer (likely a scan): embed the page as an image.
            const raster = await rasterizePage(state, page, {
              dpi: IMAGE_EXPORT_DPI,
              quality: 0.85,
              format: 'image/jpeg',
            })
            pages.push({
              paragraphs: [],
              image: { bytes: raster.bytes, widthPt: raster.widthPt, heightPt: raster.heightPt },
            })
          }
        }
        setJob({ message: 'Building Word document…', fraction: null })
        const bytes = await postJob(getConvertWorker(), {
          id: newId(),
          kind: 'DOCX' as const,
          title: baseName(),
          pages,
        })
        downloadBytes(
          bytes,
          `${baseName()}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
      }),
    [run, session, baseName],
  )

  const convertXlsx = useCallback(
    () =>
      run(async () => {
        if (!session) return
        const state = session.getState()
        const sheets: XlsxSheet[] = []
        for (let i = 0; i < state.pages.length; i++) {
          setJob({ message: 'Reading tables…', fraction: i / state.pages.length })
          const extracted = await extractPageText(state, state.pages[i])
          sheets.push({
            name: `Page ${i + 1}`,
            rows: extracted.hasText
              ? linesToRows(extracted.lines)
              : [['[No extractable text on this page — it may be a scanned image.]']],
          })
        }
        setJob({ message: 'Building spreadsheet…', fraction: null })
        const bytes = await postJob(getConvertWorker(), {
          id: newId(),
          kind: 'XLSX' as const,
          sheets,
        })
        downloadBytes(
          bytes,
          `${baseName()}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
      }),
    [run, session, baseName],
  )

  return {
    job,
    jobError,
    clearJobError: () => setJobError(null),
    exportPdf,
    compress,
    extractPages,
    splitParts,
    convertImages,
    convertDocx,
    convertXlsx,
  }
}
