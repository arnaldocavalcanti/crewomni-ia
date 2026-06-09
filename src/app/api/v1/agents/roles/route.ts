import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

const createRoleSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const roles = await di.listAgentRoles.execute({ tenantId: session.tenantId! })
    return Response.json(roles, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const body = await request.json()
    const parsed = createRoleSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const role = await di.createAgentRole.execute({
      tenantId: session.tenantId!,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description ?? undefined,
      requestedByRole: session.role,
    })

    return Response.json(role, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
