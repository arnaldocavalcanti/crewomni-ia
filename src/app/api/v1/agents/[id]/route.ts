import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    const agent = await di.getAgent.execute({ agentId: id, tenantId: session.tenantId! })

    if (!agent) {
      return Response.json({ code: 'AGENT_NOT_FOUND', message: 'Agente não encontrado' }, { status: 404 })
    }

    return Response.json(agent, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([getSession(request), params, request.json()])
    const agent = await di.updateAgent.execute({ agentId: id, tenantId: session.tenantId!, data: body })
    return Response.json(agent, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
