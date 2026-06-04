import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

const updateSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  status:      z.nativeEnum(DepartmentStatus).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    const dept = await di.getDepartment.execute({ id, tenantId: session.tenantId! })
    return Response.json(dept, { status: 200 })
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
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const dept = await di.updateDepartment.execute({ id, tenantId: session.tenantId!, ...parsed.data })
    return Response.json(dept, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    await di.deleteDepartment.execute({ id, tenantId: session.tenantId! })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
