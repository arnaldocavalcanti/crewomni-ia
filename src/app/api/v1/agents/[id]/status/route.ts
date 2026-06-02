import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { AgentStatus } from '@/domains/agent/entities/Agent'

const schema = z.object({
  status: z.enum([AgentStatus.ACTIVE, AgentStatus.ARCHIVED]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([getSession(request), params, request.json()])
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    await di.updateAgentStatus.execute({
      agentId: id,
      tenantId: session.tenantId!,
      status: parsed.data.status,
      requestedByRole: session.role,
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
