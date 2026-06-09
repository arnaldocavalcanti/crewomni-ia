import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { YoutubeTranscript } from 'youtube-transcript'
import { getSession } from '@/shared/guards/withSession'
import { errorResponse } from '@/shared/utils/apiResponse'
import { AppError } from '@/shared/errors/AppError'

const schema = z.object({
  url: z.string().min(1),
})

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v')
  } catch {
    // bare video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url
  }
  return null
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    )
    if (!res.ok) return videoId
    const data = await res.json()
    return data.title ?? videoId
  } catch {
    return videoId
  }
}

export async function POST(request: NextRequest) {
  try {
    await getSession(request)

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ code: 'VALIDATION_ERROR', message: 'URL inválida' }, { status: 422 })
    }

    const videoId = extractVideoId(parsed.data.url)
    if (!videoId) {
      return Response.json({ code: 'INVALID_URL', message: 'URL do YouTube inválida' }, { status: 422 })
    }

    let segments: { text: string }[]
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'pt' })
        .catch(() => YoutubeTranscript.fetchTranscript(videoId))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('disabled') || msg.includes('Disabled')) {
        throw new AppError('TRANSCRIPT_DISABLED', 'Este vídeo não tem transcrição/legenda disponível.')
      }
      if (msg.includes('unavailable') || msg.includes('Unavailable')) {
        throw new AppError('VIDEO_UNAVAILABLE', 'Vídeo não encontrado ou privado.')
      }
      throw new AppError('TRANSCRIPT_ERROR', 'Não foi possível obter a transcrição. Verifique se o vídeo tem legendas ativadas.')
    }

    if (!segments.length) {
      throw new AppError('TRANSCRIPT_EMPTY', 'A transcrição deste vídeo está vazia.')
    }

    // Join segments, normalize whitespace
    const content = segments
      .map(s => s.text.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const title = await fetchVideoTitle(videoId)

    return Response.json({ title, content, videoId }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
