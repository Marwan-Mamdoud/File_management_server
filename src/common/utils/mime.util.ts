import { fileTypeFromBuffer } from 'file-type'

export type MimeDetectionMethod = 'magic-bytes' | 'ole2-signature' | 'text-sniffing'

export interface DetectedMime {
  mime: string
  method: MimeDetectionMethod
}

// Legacy BIFF .xls (like legacy .doc) lives in an OLE2 compound container.
const OLE2_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

function decodeUtf8Strict(buffer: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return null
  }
}

// Best-effort CSV guess (CSV has no magic bytes): comma in the first line.
function looksLikeCsv(buffer: Buffer): boolean {
  const firstNewline = buffer.indexOf('\n')
  const headerLine = (firstNewline === -1 ? buffer : buffer.subarray(0, firstNewline)).toString('utf8')
  return headerLine.includes(',')
}

// Derives the real mime type from content only — the client-reported type is
// used solely as a tie-breaker hint for undetectable formats (per brief rule 3).
// Returns null when nothing can be safely derived (unknown binary).
export async function detectMimeType(buffer: Buffer, claimedMime: string): Promise<DetectedMime | null> {
  const detected = await fileTypeFromBuffer(buffer)

  // file-type reports OLE2 compound containers (legacy .xls/.doc) as generic
  // application/x-cfb — disambiguate below instead of rejecting outright.
  if (detected && detected.mime !== 'application/x-cfb') {
    return { mime: detected.mime, method: 'magic-bytes' }
  }

  if (buffer.subarray(0, OLE2_SIGNATURE.length).equals(OLE2_SIGNATURE)) {
    if (claimedMime === 'application/vnd.ms-excel') {
      return { mime: 'application/vnd.ms-excel', method: 'ole2-signature' }
    }
    // Other OLE2 containers (.doc/.ppt) stay unsupported/undetectable by design.
    return null
  }

  if (decodeUtf8Strict(buffer) === null) {
    return null
  }

  if (claimedMime === 'text/csv' && looksLikeCsv(buffer)) {
    return { mime: 'text/csv', method: 'text-sniffing' }
  }

  return { mime: 'text/plain', method: 'text-sniffing' }
}
