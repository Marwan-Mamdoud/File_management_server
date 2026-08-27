import mammoth from 'mammoth'
import {
  capExtractedContent,
  type ExtractionResult,
  type Extractor,
} from '../extraction.types.js'

export class DocxExtractor implements Extractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (buffer.length === 0) {
      return { content: null, metadata: {} }
    }

    const result = await mammoth.extractRawText({ buffer })
    const text = result.value

    return {
      content: text.trim().length > 0 ? capExtractedContent(text) : null,
      metadata: { charCount: text.length },
    }
  }
}

export const docxExtractor = new DocxExtractor()
