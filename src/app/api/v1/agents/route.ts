import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { AgentType } from '@/domains/agent/entities/Agent'

const createSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  }),
  type: z.nativeEnum(AgentType),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(10),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const result = await di.createAgent.execute({
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
    const agents = await di.listAgents.execute({ tenantId: session.tenantId! })
    return Response.json(agents, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
