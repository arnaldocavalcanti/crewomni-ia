import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { AppError } from '@/shared/errors/AppError'
import { AgentStatus } from '@/domains/agent/entities/Agent'

const DEFAULT_WELCOME = 'Olá! Como posso ajudar?'
const DEFAULT_COLOR = '#6366f1'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantSlug = searchParams.get('tenant')
    const agentSlug = searchParams.get('agent')
    const crewSlug = searchParams.get('crew')

    if (!tenantSlug || (!agentSlug && !crewSlug)) {
      throw new AppError('VALIDATION_ERROR', 'É obrigatório informar o tenant e um agent ou crew.')
    }

    // Resolve tenant by public slug (ADR 002)
    const tenantContext = await di.resolveTenantContext.execute({
      strategy: 'PUBLIC_SLUG',
      slug: tenantSlug,
      requestDomain: request.headers.get('origin') ?? '',
    })

    let targetAgentSlug = agentSlug

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
    }

    // Find agent by slug within tenant
    const agent = await di.getAgentBySlug.execute({
      slug: targetAgentSlug!,
      tenantId: tenantContext.tenantId,
    })

    if (!agent || agent.status !== AgentStatus.ACTIVE) {
      throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado.')
    }

    // Return public config — never expose systemPrompt, tenantId, or internal IDs
    return Response.json({
      agentName: agent.name,
      agentType: agent.type,
      welcomeMessage: DEFAULT_WELCOME,
      primaryColor: DEFAULT_COLOR,
    }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
