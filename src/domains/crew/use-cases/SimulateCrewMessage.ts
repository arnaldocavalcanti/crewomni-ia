import { AppError } from '@/shared/errors/AppError'
import { AgentStatus } from '@/domains/agent/entities/Agent'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { SendMessage } from '@/domains/conversation/use-cases/SendMessage'
import type { IConversationLifecycleRepository } from '@/domains/conversation-lifecycle/repositories/IConversationLifecycleRepository'
import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'
import type { TestSessionResult, FlowPathEntry, HandoffEntry } from '../entities/TestSessionResult'
import { estimateCost } from '@/domains/observability/entities/AgentExecutionTrace'

type SimulateInput = {
  tenantId: string
  crewId: string
  message: string
  mode: 'SIMULATE' | 'WHATSAPP_REAL'
  toPhone?: string
  isAdmin?: boolean
  conversationId?: string
}

export class SimulateCrewMessage {
  constructor(
    private crewRepo: ICrewRepository,
    private crewMemberRepo: ICrewMemberRepository,
    private agentRepo: IAgentRepository,
    private sendMessage: SendMessage,
    private lifecycleRepo: IConversationLifecycleRepository,
    private channelConfigRepo: IChannelConfigRepository,
  ) {}

  async execute(input: SimulateInput): Promise<TestSessionResult> {
    const crew = await this.crewRepo.findById(input.crewId, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    const members = await this.crewMemberRepo.findAllByCrew(input.crewId, input.tenantId)
    if (!members || members.length === 0) {
      throw new AppError('CREW_HAS_NO_MEMBERS', 'A Crew não tem agentes configurados')
    }

    if (input.mode === 'WHATSAPP_REAL') {
      const channels = (await this.channelConfigRepo.findByTenantId(input.tenantId)) ?? []
      const waChannel = channels.find((c) => c.provider === 'WHATSAPP')
      if (!waChannel) {
        throw new AppError('WHATSAPP_CHANNEL_NOT_CONFIGURED', 'Nenhum canal WhatsApp configurado para este tenant')
      }
    }

    const director = members.find((m) => m.role === 'DIRECTOR') ?? members[0]

    const directorAgentCheck = await this.agentRepo.findById(director.agentId, input.tenantId)
    if (!directorAgentCheck) {
      throw new AppError('AGENT_NOT_FOUND', 'O agente diretor da crew não foi encontrado.')
    }
    if (directorAgentCheck.status !== AgentStatus.ACTIVE) {
      throw new AppError(
        'DIRECTOR_NOT_ACTIVE',
        `O agente diretor "${directorAgentCheck.name}" está como Rascunho. Ative-o antes de testar a crew.`,
      )
    }

    const startTime = Date.now()

    let result = await this.sendMessage.execute({
      tenantId: input.tenantId,
      agentId: director.agentId,
      message: input.message,
      crewId: input.crewId,
      conversationId: input.conversationId,
    })

    // After a transfer, invoke the new agent proactively so it can greet the user.
    // We pass a synthetic context message (not the user's original message) so the
    // newly assigned agent is not confused by re-receiving unrelated user input.
    // skipUserMessage=true prevents this synthetic message from being persisted.
    const PROACTIVE_CONTEXT = '[SISTEMA] Você foi designado para continuar este atendimento. Continue de onde a conversa parou.'
    const MAX_TRANSFER_DEPTH = 3
    let depth = 0
    let previousAgentId = director.agentId
    while (result.agentId !== previousAgentId && depth < MAX_TRANSFER_DEPTH) {
      previousAgentId = result.agentId
      result = await this.sendMessage.execute({
        tenantId: input.tenantId,
        agentId: result.agentId,
        message: PROACTIVE_CONTEXT,
        crewId: input.crewId,
        conversationId: result.conversationId,
        skipUserMessage: true,
      })
      depth++
    }

    const durationMs = Date.now() - startTime

    const agentDetails = await Promise.all(
      members.map((m) => this.agentRepo.findById(m.agentId, input.tenantId))
    )
    const agentMap = new Map(
      agentDetails
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => [a.id, a])
    )

    const lifecycleEvents = await this.lifecycleRepo.findByConversationId(
      result.conversationId,
      input.tenantId,
    )

    const handoffs: HandoffEntry[] = lifecycleEvents
      .filter((e) => (e as any).metadata?.type === 'TRANSFER' || (e.reason && e.reason.startsWith('TRANSFER:')))
      .map((e) => {
        let fromAgentId = ''
        let toAgentId = ''
        let reason: string | undefined = undefined

        if (e.reason && e.reason.startsWith('TRANSFER:')) {
          const parts = e.reason.split(':')
          fromAgentId = parts[1] || ''
          toAgentId = parts[2] || ''
        } else {
          const meta = (e as any).metadata
          fromAgentId = meta.fromAgentId as string
          toAgentId = meta.toAgentId as string
          reason = meta.reason as string | undefined
        }

        const from = agentMap.get(fromAgentId)
        const to = agentMap.get(toAgentId)
        return {
          fromAgentId,
          fromAgentName: from?.name ?? 'Agente desconhecido',
          toAgentId,
          toAgentName: to?.name ?? 'Agente desconhecido',
          reason,
        }
      })

    const directorAgent = agentMap.get(director.agentId)
    const flowPath: FlowPathEntry[] = []
    const activeAgentId = result.agentId || director.agentId
    const activeAgent = agentMap.get(activeAgentId)
    const activeMember = members.find((m) => m.agentId === activeAgentId)
    flowPath.push({
      agentId: activeAgentId,
      agentName: activeAgent?.name ?? 'Agente',
      agentType: (activeAgent as any)?.type ?? 'UNKNOWN',
      role: (activeMember?.role ?? director.role) as 'DIRECTOR' | 'MEMBER' | 'OBSERVER',
      action: handoffs.length > 0 ? 'TRANSFERRED' : 'RESPONDED',
      responseSnippet: handoffs.length === 0 ? result.reply.slice(0, 120) : undefined,
      durationMs,
    })

    for (const handoff of handoffs) {
      const toMember = members.find((m) => m.agentId === handoff.toAgentId)
      const toAgent = agentMap.get(handoff.toAgentId)
      flowPath.push({
        agentId: handoff.toAgentId,
        agentName: handoff.toAgentName,
        agentType: (toAgent as any)?.type ?? 'UNKNOWN',
        role: (toMember?.role ?? 'MEMBER') as 'DIRECTOR' | 'MEMBER' | 'OBSERVER',
        action: 'WAITING',
        durationMs: 0,
      })
    }

    // Update last agent in flowPath to RESPONDED
    const lastIdx = flowPath.length - 1
    if (lastIdx >= 0) {
      flowPath[lastIdx].action = 'RESPONDED'
      flowPath[lastIdx].responseSnippet = result.reply.slice(0, 120)
    }

    const inputTokens = Math.floor((result.tokensUsed ?? 0) * 0.8)
    const outputTokens = Math.floor((result.tokensUsed ?? 0) * 0.2)

    const trace = {
      model: result.model ?? 'gpt-4o-mini',
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(result.model ?? 'gpt-4o-mini', inputTokens, outputTokens),
      durationMs,
      memoryBlocksUsed: ['buffer'],
      chunksUsed: [],
      steps: input.isAdmin
        ? [
            { step: 'CREW_VALIDATION', durationMs: 5, detail: `Crew: ${crew.name}` },
            { step: 'MEMBER_RESOLUTION', durationMs: 3, detail: `Director: ${directorAgent?.name}` },
            { step: 'LLM_CALL', durationMs: Math.max(0, durationMs - 10), detail: `Model: ${result.model}` },
          ]
        : undefined,
    }

    return {
      conversationId: result.conversationId,
      reply: result.reply,
      flowPath,
      handoffs,
      trace,
    }
  }
}
