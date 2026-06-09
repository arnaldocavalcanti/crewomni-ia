import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

const createSchema = z.object({
  provider: z.enum(['WHATSAPP', 'EMAIL']),
  phoneNumberId: z.string().optional().nullable(),
  accessToken: z.string().optional().nullable(),
  webhookSecret: z.string().optional().nullable(),
  fromAddress: z.string().email().optional().nullable(),
  fromName: z.string().optional().nullable(),
  sendgridApiKey: z.string().optional().nullable(),
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

    const result = await di.createChannelConfig.execute({
      tenantId: session.tenantId!,
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
    const channels = await di.listChannelConfigs.execute({ tenantId: session.tenantId! })
    return Response.json(channels, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
