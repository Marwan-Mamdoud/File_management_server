import { PDFParse } from 'pdf-parse'
import {
  capExtractedContent,
  type ExtractionResult,
  type Extractor,
} from '../extraction.types.js'

export class PdfExtractor implements Extractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (buffer.length === 0) {
      return { content: null, metadata: {} }
    }

    const parser = new PDFParse({ data: new Uint8Array(buffer) })

    try {
      const result = await parser.getText()

      return {
        content: result.text.trim().length > 0 ? capExtractedContent(result.text) : null,
        metadata: { pageCount: result.total },
      }
    } finally {
      await parser.destroy()
    }
  }
}

export const pdfExtractor = new PdfExtractor()
