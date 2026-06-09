import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])

    const result = await di.acceptHumanHandoff.execute({
      conversationId: id,
      tenantId: session.tenantId!,
      operatorId: session.userId,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
