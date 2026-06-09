import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { requirePlatformAdmin } from '@/shared/guards/withSession'

const schema = z.object({
  messagesPerMonth: z.number().int().positive().optional(),
  tokensPerMonth: z.number().int().positive().optional(),
  costPerMonthUsd: z.number().positive().optional(),
  messagesPerMinute: z.number().int().positive().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apenas Platform Admins podem alterar os limites de um tenant
    await requirePlatformAdmin(request)

    const { id: tenantId } = await params

    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    await di.updateUsageLimit.execute({
      tenantId,
      ...parsed.data,
    })

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
