import { CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS, MIN_CHUNK_CHARS } from '@/shared/constants'

type ChunkOptions = {
  chunkSize?: number
  overlap?: number
  minChunk?: number
}

export function chunkText(text: string, options?: ChunkOptions): string[] {
  const chunkSize = options?.chunkSize ?? CHUNK_SIZE_CHARS
  const overlap = options?.overlap ?? CHUNK_OVERLAP_CHARS
  const minChunk = options?.minChunk ?? MIN_CHUNK_CHARS

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (normalized.length <= chunkSize) {
    return normalized.trim().length >= minChunk ? [normalized.trim()] : []
  }

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    let end = start + chunkSize

    if (end < normalized.length) {
      // Try to break at paragraph boundary
      const paragraphBreak = normalized.lastIndexOf('\n\n', end)
      if (paragraphBreak > start + minChunk) {
        end = paragraphBreak
      } else {
        // Try line break
        const lineBreak = normalized.lastIndexOf('\n', end)
        if (lineBreak > start + minChunk) {
          end = lineBreak
        } else {
          // Try space
          const spaceBreak = normalized.lastIndexOf(' ', end)
          if (spaceBreak > start + minChunk) {
            end = spaceBreak
          }
        }
      }
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk.length >= minChunk) {
      chunks.push(chunk)
    }

    start = end - overlap
    if (start >= normalized.length) break
  }

  return chunks
}
