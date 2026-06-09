import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([
      getSession(request),
      params,
      request.json(),
    ])

    const { message, conversationHistory } = body as {
      message: unknown
      conversationHistory?: unknown
    }

    const result = await di.buildRAGContext.execute({
      tenantId: session.tenantId!,
      agentId: id,
      message: message as string,
      conversationHistory: conversationHistory as { role: 'user' | 'assistant'; content: string }[] | undefined,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
