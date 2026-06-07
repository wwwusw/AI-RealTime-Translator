import { protocol } from 'electron'
import { open, stat } from 'node:fs/promises'

const MEDIA_PROTOCOL_SCHEME = 'local-media'

/*
 * When the media player requests "bytes=0-" (the whole file), we cap the
 * response to this many bytes so we never read a multi-hundred-MB file in
 * one go.  The player receives a 206 with the real file size in
 * Content-Range and issues proper bounded range requests for the rest.
 */
const INITIAL_CHUNK_CAP = 8 * 1024 * 1024 // 8 MB

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.m4a': 'audio/mp4',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/mp4',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.ts': 'video/mp2t'
}

const getMimeType = (filePath: string): string => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

const decodeFilePath = (url: string): string => {
  const marker = `${MEDIA_PROTOCOL_SCHEME}://_/`
  const encoded = url.slice(url.indexOf(marker) + marker.length)
  return decodeURIComponent(encoded)
}

type ByteRange = { start: number; end: number }

const parseRangeHeader = (
  header: string | null,
  fileSize: number
): ByteRange | null => {
  if (!header) return null

  // Multiple range syntax (`bytes=0-1023,2048-4095`) is not supported
  const match = header.match(/bytes=(\d+)-(\d*)/)
  if (!match) return null

  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : fileSize - 1

  if (start >= fileSize || end >= fileSize || start > end) return null

  return { start, end }
}

const clampRange = (
  range: ByteRange | null,
  fileSize: number
): ByteRange => {
  // No range → first chunk
  if (!range) return { start: 0, end: Math.min(INITIAL_CHUNK_CAP, fileSize) - 1 }

  const length = range.end - range.start + 1

  // Explicit finite range → serve as-is
  if (length <= INITIAL_CHUNK_CAP) return range

  // Open-ended or huge range (bytes=0-) → cap
  return { start: range.start, end: range.start + INITIAL_CHUNK_CAP - 1 }
}

const readRange = async (
  filePath: string,
  start: number,
  end: number
): Promise<Buffer> => {
  const length = end - start + 1
  const buffer = Buffer.alloc(length)
  const handle = await open(filePath, 'r')
  try {
    await handle.read(buffer, 0, length, start)
  } finally {
    await handle.close()
  }
  return buffer
}

export const registerMediaProtocol = () => {
  protocol.handle(MEDIA_PROTOCOL_SCHEME, async (request) => {
    try {
      const filePath = decodeFilePath(request.url)
      const fileStat = await stat(filePath)
      if (!fileStat.isFile()) {
        return new Response('Not a file', { status: 404 })
      }

      const fileSize = fileStat.size
      const mimeType = getMimeType(filePath)
      const requestedRange = parseRangeHeader(
        request.headers.get('Range'),
        fileSize
      )
      const range = clampRange(requestedRange, fileSize)

      const buffer = await readRange(filePath, range.start, range.end)
      const length = range.end - range.start + 1

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`
      }

      // 206 whenever we return a range (even if the client didn't ask for
      // one — the cap may have shortened an open-ended request)
      const status = requestedRange || range.start > 0 ? 206 : 200

      return new Response(buffer, { status, headers })
    } catch {
      return new Response('Media file not found', { status: 404 })
    }
  })
}
