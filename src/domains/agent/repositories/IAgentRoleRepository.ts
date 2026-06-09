import type { AgentRole, CreateAgentRoleData } from '../entities/AgentRole'

export interface IAgentRoleRepository {
  findById(id: string): Promise<AgentRole | null>
  findByName(name: string, tenantId: string | null): Promise<AgentRole | null>
  list(tenantId: string): Promise<AgentRole[]>
  create(data: CreateAgentRoleData): Promise<AgentRole>
}
