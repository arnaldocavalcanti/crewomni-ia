import type { IAgentRoleRepository } from '../repositories/IAgentRoleRepository'
import type { AgentRole } from '../entities/AgentRole'

type ListAgentRolesInput = {
  tenantId: string
}

export class ListAgentRoles {
  constructor(private roleRepo: IAgentRoleRepository) {}

  async execute(input: ListAgentRolesInput): Promise<AgentRole[]> {
    return this.roleRepo.list(input.tenantId)
  }
}
