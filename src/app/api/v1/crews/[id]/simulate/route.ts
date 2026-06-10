import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

const schema = z.object({
  message: z.string().min(1, 'Mensagem não pode ser vazia').max(2000),
  mode: z.enum(['SIMULATE', 'WHATSAPP_REAL']),
  toPhone: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([
      getSession(request),
      params,
      request.json(),
    ])

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    if (parsed.data.mode === 'WHATSAPP_REAL' && !parsed.data.toPhone) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'toPhone é obrigatório no modo WHATSAPP_REAL' },
        { status: 422 },
      )
    }

    const isAdmin = session.role === 'TENANT_ADMIN' || session.role === 'PLATFORM_ADMIN'

    const result = await di.simulateCrewMessage.execute({
      tenantId: session.tenantId!,
      crewId: id,
      message: parsed.data.message,
      mode: parsed.data.mode,
      toPhone: parsed.data.toPhone,
      isAdmin,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
