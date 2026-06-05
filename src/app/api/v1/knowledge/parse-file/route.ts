import { type NextRequest } from 'next/server'
import { getSession } from '@/shared/guards/withSession'
import { errorResponse } from '@/shared/utils/apiResponse'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    await getSession(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ code: 'VALIDATION_ERROR', message: 'Nenhum arquivo enviado' }, { status: 422 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ code: 'FILE_TOO_LARGE', message: 'Arquivo muito grande. Máximo: 10 MB' }, { status: 422 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (!['txt', 'pdf'].includes(ext ?? '')) {
      return Response.json({ code: 'UNSUPPORTED_FILE', message: 'Apenas arquivos .txt e .pdf são suportados' }, { status: 422 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let content = ''

    if (ext === 'txt') {
      content = buffer.toString('utf-8')
    } else {
      // Dynamic import avoids issues with Next.js module resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfModule = await import('pdf-parse') as any
      const pdfParse = pdfModule.default ?? pdfModule
      const result = await pdfParse(buffer)
      content = result.text
    }

    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim()

    return Response.json({ title, content: content.trim() }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
