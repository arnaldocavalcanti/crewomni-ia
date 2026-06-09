import { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { AppError } from '@/shared/errors/AppError'
import { IAuditLogger } from '@/shared/types/IAuditLogger'

export type GetCrewMetricsInput = {
  tenantId: string
  crewId: string
}

export type GetCrewMetricsOutput = {
  totalConversations: number
  activeConversations: number
  totalMessages: number
  messagesByAgent: {
    agentId: string
    count: number
  }[]
}

export class GetCrewMetrics {
  constructor(
    private crewRepo: ICrewRepository,
    private conversationRepo: IConversationRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: GetCrewMetricsInput): Promise<GetCrewMetricsOutput> {
    const { tenantId, crewId } = input

    // 1. Validar se a Crew existe e pertence ao tenant
    const crew = await this.crewRepo.findById(crewId, tenantId)
    if (!crew) {
      throw new AppError('CREW_NOT_FOUND', 'Equipe não encontrada')
    }

    // 2. Buscar as contagens agregadas via repositório de conversas
    const { total, active } = await this.conversationRepo.countConversationsByCrew(crewId, tenantId)
    const messagesByAgent = await this.conversationRepo.countMessagesByCrewAndAgent(crewId, tenantId)

    // 3. Somar totalMessages a partir de messagesByAgent
    const totalMessages = messagesByAgent.reduce((acc, curr) => acc + curr.count, 0)

    // 4. Audit
    this.auditLogger.log({
      action: 'CREW_METRICS_FETCHED',
      tenantId,
      resourceId: crewId,
    })

    return {
      totalConversations: total,
      activeConversations: active,
      totalMessages,
      messagesByAgent,
    }
  }
}
