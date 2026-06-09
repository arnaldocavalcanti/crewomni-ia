import type { IAgentRepository } from '../repositories/IAgentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { UpdateAgentData, Agent } from '../entities/Agent'

type UpdateAgentInput = {
  agentId: string
  tenantId: string
  data: UpdateAgentData
}

export class UpdateAgent {
  constructor(
    private agentRepo: IAgentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: UpdateAgentInput): Promise<Agent> {
    const existing = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!existing) throw new Error('AGENT_NOT_FOUND')

    const updated = await this.agentRepo.update(input.agentId, input.tenantId, input.data)
    await this.auditLogger.log({ action: 'agent.update', tenantId: input.tenantId, resourceId: input.agentId, resourceType: 'agent', metadata: {} })
    return updated
  }
}
