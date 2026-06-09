import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'
import { EmailDispatcher } from '@/infrastructure/channel/EmailDispatcher'

const schema = z.object({
  to: z.string().email('Endereço de destino inválido'),
})

/**
 * POST /api/v1/channels/:id/test
 *
 * Sends a test message through the channel identified by :id.
 * Currently supports EMAIL channels (SendGrid).
 *
 * Body: { "to": "recipient@example.com" }
 * Response 200: { success: true, providerId?: string }
 * Response 422: validation error
 * Response 400: channel misconfigured / missing credentials
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    const { id } = await params

    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      )
    }

    // Load channels for this tenant and find the one matching :id
    const configs = await di.channelConfigRepo.findByTenantId(session.tenantId!)
    const channel = configs.find((c) => c.id === id)

    if (!channel) {
      return Response.json(
        { code: 'CHANNEL_NOT_FOUND', message: 'Canal não encontrado' },
        { status: 404 }
      )
    }

    if (channel.provider !== 'EMAIL') {
      return Response.json(
        { code: 'UNSUPPORTED_PROVIDER', message: `Teste disponível apenas para canal EMAIL (este é ${channel.provider})` },
        { status: 400 }
      )
    }

    if (!channel.sendgridApiKey || !channel.fromAddress) {
      return Response.json(
        { code: 'MISSING_CREDENTIALS', message: 'Canal EMAIL sem chave SendGrid ou endereço de origem configurado' },
        { status: 400 }
      )
    }

    const dispatcher = new EmailDispatcher(di.channelConfigRepo)
    const result = await dispatcher.send({
      tenantId: session.tenantId!,
      to: parsed.data.to,
      text: `🚀 Teste de integração CrewOmni\n\nSe você recebeu este email, o canal "${channel.fromName || channel.fromAddress}" está configurado corretamente.\n\nEnviado em: ${new Date().toISOString()}`,
      metadata: {
        subject: 'Teste de canal CrewOmni',
      },
    })

    if (!result.success) {
      return Response.json(
        { code: 'DISPATCH_FAILED', message: result.error || 'Falha ao enviar email de teste' },
        { status: 400 }
      )
    }

    return Response.json(
      { success: true, providerId: result.providerId, message: `Email de teste enviado para ${parsed.data.to}` },
      { status: 200 }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
