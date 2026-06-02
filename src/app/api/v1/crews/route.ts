import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

const createSchema = z.object({
  departmentId: z.string().uuid(),
  name:         z.string().min(2).max(100),
  description:  z.string().max(500).optional(),
  objective:    z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const body    = await request.json()
    const parsed  = createSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const crew = await di.createCrew.execute({ tenantId: session.tenantId!, ...parsed.data })
    return Response.json(crew, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session      = await getSession(request)
    const departmentId = request.nextUrl.searchParams.get('departmentId') ?? undefined
    const crews        = await di.listCrews.execute({ tenantId: session.tenantId!, departmentId })
    return Response.json(crews, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
