import sharp from 'sharp'
import type { ExtractionResult, Extractor } from '../extraction.types.js'

// Images carry no text payload — dimensions/format only.
export class ImageExtractor implements Extractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (buffer.length === 0) {
      return { content: null, metadata: {} }
    }

    const { format, width, height } = await sharp(buffer).metadata()

    return {
      content: null,
      metadata: {
        format: format ?? null,
        width: width ?? null,
        height: height ?? null,
      },
    }
  }
}

export const imageExtractor = new ImageExtractor()
