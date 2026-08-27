import * as XLSX from 'xlsx'
import {
  capExtractedContent,
  type ExtractionResult,
  type Extractor,
} from '../extraction.types.js'

export class SpreadsheetExtractor implements Extractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (buffer.length === 0) {
      return { content: null, metadata: {} }
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const parts: string[] = []
    const rowCounts: Record<string, number> = {}

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name]

      if (!sheet) {
        continue
      }

      parts.push(`# ${name}`, XLSX.utils.sheet_to_csv(sheet))

      const ref = sheet['!ref']
      if (ref) {
        const range = XLSX.utils.decode_range(ref)
        rowCounts[name] = range.e.r - range.s.r + 1
      } else {
        rowCounts[name] = 0
      }
    }

    const joined = parts.join('\n')

    return {
      content: joined.trim().length > 0 ? capExtractedContent(joined) : null,
      metadata: { sheetNames: workbook.SheetNames, rowCounts },
    }
  }
}

export const spreadsheetExtractor = new SpreadsheetExtractor()
