import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { UserRole } from '@/domains/auth/entities/User'
import { AgentStatus } from '../entities/Agent'
import type { IAgentRepository } from '../repositories/IAgentRepository'

const ALLOWED_ROLES = [UserRole.TENANT_ADMIN, UserRole.TENANT_OPERATOR]

type UpdateAgentStatusInput = {
  agentId: string
  tenantId: string
  status: AgentStatus
  requestedByRole: UserRole
}

export class UpdateAgentStatus {
  constructor(
    private agentRepo: IAgentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: UpdateAgentStatusInput): Promise<void> {
    if (!ALLOWED_ROLES.includes(input.requestedByRole)) {
      throw new AppError('FORBIDDEN', 'Sem permissão para alterar status do agente')
    }

    const agent = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado')

    await this.agentRepo.updateStatus(input.agentId, input.tenantId, input.status)

    await this.auditLogger.log({
      action: 'agent.status.updated',
      tenantId: input.tenantId,
      resourceId: input.agentId,
      resourceType: 'agent',
      metadata: { previousStatus: agent.status, newStatus: input.status },
    })
  }
}
