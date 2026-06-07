import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { AppError } from '@/shared/errors/AppError'
import { AgentStatus } from '@/domains/agent/entities/Agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      tenantSlug: string
      agentSlug?: string
      crewSlug?: string
      message: string
      conversationId?: string
      externalUserId?: string
    }

    const { tenantSlug, agentSlug, crewSlug, message, conversationId, externalUserId } = body

    if (!tenantSlug || (!agentSlug && !crewSlug)) {
      throw new AppError('VALIDATION_ERROR', 'É obrigatório informar o tenantSlug e um agentSlug ou crewSlug.')
    }

    // Resolve tenant by public slug (ADR 002)
    const tenantContext = await di.resolveTenantContext.execute({
      strategy: 'PUBLIC_SLUG',
      slug: tenantSlug,
      requestDomain: request.headers.get('origin') ?? '',
    })

    let targetAgentSlug = agentSlug
    let crewId: string | undefined

    // Roteamento via Crew
    if (!targetAgentSlug && crewSlug) {
      const crew = await di.getCrewBySlug.execute({
        slug: crewSlug,
        tenantId: tenantContext.tenantId,
      })
      const director = crew.members.find((m) => m.role === 'DIRECTOR')
      if (!director) {
        throw new AppError('CREW_HAS_NO_DIRECTOR', 'A equipe informada não possui um Diretor para iniciar o atendimento.')
      }
      
      const agent = await di.getAgent.execute({ agentId: director.agentId, tenantId: tenantContext.tenantId })
      if (!agent) {
        throw new AppError('AGENT_NOT_FOUND', 'Agente do diretor não encontrado.')
      }
      targetAgentSlug = agent.slug
      crewId = crew.id
    }

    // Find and validate agent by slug
    const agent = await di.getAgentBySlug.execute({
      slug: targetAgentSlug!,
      tenantId: tenantContext.tenantId,
    })

    if (!agent || agent.status !== AgentStatus.ACTIVE) {
      throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado.')
    }

    // Send message via conversation domain
    const result = await di.sendMessage.execute({
      tenantId: tenantContext.tenantId,
      agentId: agent.id,
      crewId,
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
