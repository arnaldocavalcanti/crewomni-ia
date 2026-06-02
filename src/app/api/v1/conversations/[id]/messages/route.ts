import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])

    const result = await di.getConversationMessages.execute({
      conversationId: id,
      tenantId: session.tenantId!,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
