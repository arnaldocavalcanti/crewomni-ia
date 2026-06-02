import { randomUUID } from 'crypto'
import type { Agent, AgentStatus, CreateAgentData } from '@/domains/agent/entities/Agent'
import { AgentStatus as AS } from '@/domains/agent/entities/Agent'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'

const store = new Map<string, Agent>()

export class InMemoryAgentRepository implements IAgentRepository {
  async findById(id: string, tenantId: string): Promise<Agent | null> {
    const agent = store.get(id)
    return agent?.tenantId === tenantId ? agent : null
  }

  async findByName(name: string, tenantId: string): Promise<Agent | null> {
    return Array.from(store.values()).find(
      (a) => a.name === name && a.tenantId === tenantId
    ) ?? null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Agent | null> {
    return Array.from(store.values()).find(
      (a) => a.slug === slug && a.tenantId === tenantId
    ) ?? null
  }

  async countActive(tenantId: string): Promise<number> {
    return Array.from(store.values()).filter(
      (a) => a.tenantId === tenantId && a.status === AS.ACTIVE
    ).length
  }

  async listByTenant(tenantId: string): Promise<Agent[]> {
    return Array.from(store.values()).filter((a) => a.tenantId === tenantId)
  }

  async create(data: CreateAgentData): Promise<Agent> {
    const agent: Agent = {
      id: randomUUID(),
      tenantId: data.tenantId,
      name: data.name,
      slug: data.slug,
      type: data.type,
      description: data.description ?? null,
      status: AS.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    store.set(agent.id, agent)
    return agent
  }

  async updateStatus(id: string, tenantId: string, status: AgentStatus): Promise<void> {
    const agent = store.get(id)
    if (agent && agent.tenantId === tenantId) {
      store.set(id, { ...agent, status, updatedAt: new Date() })
    }
  }
}
