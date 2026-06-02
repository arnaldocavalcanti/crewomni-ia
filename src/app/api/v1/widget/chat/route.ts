import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { AppError } from '@/shared/errors/AppError'
import { AgentStatus } from '@/domains/agent/entities/Agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      tenantSlug: string
      agentSlug: string
      message: string
      conversationId?: string
      externalUserId?: string
    }

    const { tenantSlug, agentSlug, message, conversationId, externalUserId } = body

    if (!tenantSlug || !agentSlug) {
      throw new AppError('VALIDATION_ERROR', 'Os campos tenantSlug e agentSlug são obrigatórios.')
    }

    // Resolve tenant by public slug (ADR 002)
    const tenantContext = await di.resolveTenantContext.execute({
      strategy: 'PUBLIC_SLUG',
      slug: tenantSlug,
      requestDomain: request.headers.get('origin') ?? '',
    })

    // Find and validate agent by slug
    const agent = await di.getAgentBySlug.execute({
      slug: agentSlug,
      tenantId: tenantContext.tenantId,
    })

    if (!agent || agent.status !== AgentStatus.ACTIVE) {
      throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado.')
    }

    // Send message via conversation domain
    const result = await di.sendMessage.execute({
      tenantId: tenantContext.tenantId,
      agentId: agent.id,
      message,
      conversationId,
      externalUserId,
    })

    // Return public output — never expose model, tokensUsed or internal IDs
    return Response.json({
      conversationId: result.conversationId,
      reply: result.reply,
      isNewConversation: result.isNewConversation,
    }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
