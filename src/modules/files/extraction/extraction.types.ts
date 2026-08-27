export interface ExtractionResult {
  content: string | null
  metadata: Record<string, unknown>
}

export interface Extractor {
  extract(buffer: Buffer): Promise<ExtractionResult>
}

// Assumption: extractedContent lives in a Postgres TEXT column; the cap keeps
// rows bounded even for large text-like uploads (user-approved: 100k chars).
export const MAX_EXTRACTED_CONTENT_CHARS = 100_000

export function capExtractedContent(content: string): string {
  return content.length > MAX_EXTRACTED_CONTENT_CHARS
    ? content.slice(0, MAX_EXTRACTED_CONTENT_CHARS)
    : content
}
