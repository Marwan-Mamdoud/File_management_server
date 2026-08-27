import {
  capExtractedContent,
  type ExtractionResult,
  type Extractor,
} from '../extraction.types.js'

export class TextExtractor implements Extractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (buffer.length === 0) {
      return { content: null, metadata: {} }
    }

    const text = buffer.toString('utf8')
    // POSIX-style line count: a trailing newline does not start a new line.
    const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text
    const lineCount = withoutTrailingNewline === '' ? 0 : withoutTrailingNewline.split('\n').length

    return {
      content: text.trim().length > 0 ? capExtractedContent(text) : null,
      metadata: { charCount: text.length, lineCount },
    }
  }
}

export const textExtractor = new TextExtractor()
