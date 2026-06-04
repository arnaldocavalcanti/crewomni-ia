import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

const addSchema = z.object({
  agentId:    z.string().uuid(),
  role:       z.nativeEnum(CrewMemberRole),
  order:      z.number().int().min(0),
  isRequired: z.boolean().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([getSession(request), params, request.json()])
    const parsed = addSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const member = await di.addAgentToCrew.execute({ tenantId: session.tenantId!, crewId: id, ...parsed.data })
    return Response.json(member, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    const members = await di.listCrewMembers.execute({ crewId: id, tenantId: session.tenantId! })
    return Response.json(members, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
