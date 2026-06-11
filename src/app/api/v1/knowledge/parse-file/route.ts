import { type NextRequest } from 'next/server'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'
import { errorResponse } from '@/shared/utils/apiResponse'

if (typeof globalThis.DOMMatrix === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).DOMMatrix = class DOMMatrix {}
}

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

    if (!['txt', 'pdf', 'csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      return Response.json(
        { code: 'UNSUPPORTED_FILE', message: 'Apenas arquivos .txt, .pdf, .csv, .xls e .xlsx são suportados' },
        { status: 422 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let content = ''

    if (ext === 'txt') {
      content = buffer.toString('utf-8')
    } else if (ext === 'pdf') {
      // Dynamic import avoids issues with Next.js module resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfModule = await import('pdf-parse') as any
      const pdfParse = pdfModule.default ?? pdfModule
      const result = await pdfParse(buffer)
      content = result.text
    } else {
      // CSV, XLSX, XLS
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetsContent: string[] = []

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 })
        if (rows.length > 0) {
          const headers = rows[0]
          const markdownRows = [
            `### Aba: ${sheetName}`,
            `| ${headers.map((h) => String(h ?? '')).join(' | ')} |`,
            `| ${headers.map(() => '---').join(' | ')} |`,
          ]
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            if (row && row.length > 0) {
              const paddedRow = headers.map((_, idx) =>
                row[idx] !== undefined && row[idx] !== null ? String(row[idx]).replace(/\r?\n/g, ' ') : '',
              )
              markdownRows.push(`| ${paddedRow.join(' | ')} |`)
            }
          }
          sheetsContent.push(markdownRows.join('\n'))
        }
      }
      content = sheetsContent.join('\n\n')
    }

    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim()

    return Response.json({ title, content: content.trim() }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
