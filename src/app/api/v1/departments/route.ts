import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

const createSchema = z.object({
  name:        z.string().min(2).max(100),
  description: z.string().max(500).optional(),
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

    const dept = await di.createDepartment.execute({ tenantId: session.tenantId!, ...parsed.data })
    return Response.json(dept, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const depts   = await di.listDepartments.execute({ tenantId: session.tenantId! })
    return Response.json(depts, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
