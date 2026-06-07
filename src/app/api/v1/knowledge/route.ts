import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { KnowledgeLayer } from '@/domains/knowledge/entities/KnowledgeDocument'

const ingestSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(50),
  layer: z.enum([KnowledgeLayer.TENANT, KnowledgeLayer.AGENT]),
  agentId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const body = await request.json()
    const parsed = ingestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const result = await di.ingestDocument.execute({
      tenantId: session.tenantId!,
      requestedByRole: session.role,
      ...parsed.data,
    })

    return Response.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId') ?? undefined
    const documents = await di.listDocuments.execute({ tenantId: session.tenantId!, agentId })
    return Response.json({ documents }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
