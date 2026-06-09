import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    const body = await request.json()
    const { id: conversationId } = await params

    if (!body.content || typeof body.content !== 'string') {
      return Response.json({ error: 'Conteúdo da mensagem (content) é obrigatório e deve ser texto.' }, { status: 400 })
    }

    const result = await di.operatorReply.execute({
      tenantId: session.tenantId!,
      conversationId,
      operatorId: session.userId!,
      content: body.content,
    })

    return Response.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
