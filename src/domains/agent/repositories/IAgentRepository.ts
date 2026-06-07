import type { Agent, AgentStatus, CreateAgentData, UpdateAgentData } from '../entities/Agent'

export interface IAgentRepository {
  findById(id: string, tenantId: string): Promise<Agent | null>
  findByName(name: string, tenantId: string): Promise<Agent | null>
  findBySlug(slug: string, tenantId: string): Promise<Agent | null>
  countActive(tenantId: string): Promise<number>
  listByTenant(tenantId: string): Promise<Agent[]>
  create(data: CreateAgentData): Promise<Agent>
  updateStatus(id: string, tenantId: string, status: AgentStatus): Promise<void>
  update(id: string, tenantId: string, data: UpdateAgentData): Promise<Agent>
}
