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

    if (!tenantSlug || !agentSlug) {
      throw new AppError('VALIDATION_ERROR', 'Os parâmetros tenant e agent são obrigatórios.')
    }

    // Resolve tenant by public slug (ADR 002)
    const tenantContext = await di.resolveTenantContext.execute({
      strategy: 'PUBLIC_SLUG',
      slug: tenantSlug,
      requestDomain: request.headers.get('origin') ?? '',
    })

    // Find agent by slug within tenant
    const agent = await di.getAgentBySlug.execute({
      slug: agentSlug,
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
