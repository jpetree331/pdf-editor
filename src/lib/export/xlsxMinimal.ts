// Framework-free. Minimal hand-rolled XLSX writer (inline strings only) —
// a .xlsx is just zipped OOXML, and for text-grid output this beats hauling
// in a heavyweight spreadsheet library with Node Buffer baggage.
import { strToU8, zipSync } from 'fflate'
import type { XlsxSheet } from '../workers/protocol'

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
}

function columnRef(index: number): string {
  let ref = ''
  let n = index
  while (n >= 0) {
    ref = String.fromCharCode(65 + (n % 26)) + ref
    n = Math.floor(n / 26) - 1
  }
  return ref
}

function sheetXml(rows: string[][]): string {
  const rowsXml = rows
    .map((cells, r) => {
      const cellsXml = cells
        .map((value, c) => {
          if (value.length === 0) return ''
          return `<c r="${columnRef(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cellsXml}</row>`
    })
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData></worksheet>`
  )
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [['']] }]
  const files: Record<string, Uint8Array> = {}

  files['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      safeSheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      `</Types>`,
  )

  files['_rels/.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  )

  const sheetEntries = safeSheets
    .map((sheet, i) => {
      const name = xmlEscape(sheet.name.slice(0, 31) || `Sheet${i + 1}`)
      return `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
    })
    .join('')
  files['xl/workbook.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${sheetEntries}</sheets></workbook>`,
  )

  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      safeSheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `</Relationships>`,
  )

  safeSheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet.rows))
  })

  return zipSync(files)
}
