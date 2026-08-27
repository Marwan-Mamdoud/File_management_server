import type { ExtractionResult, Extractor } from './extraction.types.js'
import { pdfExtractor } from './extractors/pdf.extractor.js'
import { docxExtractor } from './extractors/docx.extractor.js'
import { spreadsheetExtractor } from './extractors/spreadsheet.extractor.js'
import { textExtractor } from './extractors/text.extractor.js'
import { imageExtractor } from './extractors/image.extractor.js'

const MIME_EXTRACTORS: Record<string, Extractor> = {
  'application/pdf': pdfExtractor,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': docxExtractor,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': spreadsheetExtractor,
  'application/vnd.ms-excel': spreadsheetExtractor,
  'text/csv': spreadsheetExtractor,
  'text/plain': textExtractor,
}

// Unsupported types resolve gracefully with no content (brief rule 4) — they
// map to extractionStatus COMPLETED with nothing to extract. Supported but
// corrupt files reject; the upload flow maps that to extractionStatus FAILED.
export async function extractFile(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const extractor = MIME_EXTRACTORS[mimeType] ?? (mimeType.startsWith('image/') ? imageExtractor : undefined)

  if (!extractor) {
    return { content: null, metadata: {} }
  }

  return extractor.extract(buffer)
}
