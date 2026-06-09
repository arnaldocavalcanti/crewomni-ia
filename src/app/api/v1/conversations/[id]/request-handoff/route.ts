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
      request.json().catch(() => ({})),
    ])

    const result = await di.requestHumanHandoff.execute({
      conversationId: id,
      tenantId: session.tenantId!,
      reason: body.reason || 'Solicitado pelo operador',
      triggeredBy: 'OPERATOR',
      triggeredById: session.userId,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
