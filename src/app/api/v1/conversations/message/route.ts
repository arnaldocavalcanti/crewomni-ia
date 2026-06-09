import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function POST(request: NextRequest) {
  try {
    const [session, body] = await Promise.all([getSession(request), request.json()])

    const { conversationId, agentId, message, externalUserId } = body as {
      conversationId?: string
      agentId: string
      message: string
      externalUserId?: string
    }

    const result = await di.sendMessage.execute({
      tenantId: session.tenantId!,
      agentId,
      message,
      conversationId,
      externalUserId,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
