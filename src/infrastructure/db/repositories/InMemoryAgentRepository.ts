import { randomUUID } from 'crypto'
import type { Agent, AgentStatus, CreateAgentData, UpdateAgentData } from '@/domains/agent/entities/Agent'
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
      category: data.category,
      roleId: data.roleId,
      operationalFunction: data.operationalFunction,
      description: data.description ?? null,
      status: AS.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),

      departmentId: data.departmentId ?? null,
      directorId: data.directorId ?? null,
      mainChannel: data.mainChannel ?? null,
      toneOfVoice: data.toneOfVoice ?? null,
      communicationStyle: data.communicationStyle ?? null,
      autonomyLevel: data.autonomyLevel ?? null,
      responsibilities: data.responsibilities ?? [],

      permissionReadKB: data.permissionReadKB ?? true,
      permissionSendWhatsapp: data.permissionSendWhatsapp ?? false,
      permissionSendEmail: data.permissionSendEmail ?? false,
      permissionExecuteTool: data.permissionExecuteTool ?? false,
      permissionCallHuman: data.permissionCallHuman ?? false,
      permissionCreateTask: data.permissionCreateTask ?? false,
      permissionReadHistory: data.permissionReadHistory ?? false,
      permissionReadCommercial: data.permissionReadCommercial ?? false,

      outputFormat: data.outputFormat ?? null,
      expectedExamples: data.expectedExamples ?? null,
      specificRules: data.specificRules ?? null,
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

  async update(id: string, tenantId: string, data: UpdateAgentData): Promise<Agent> {
    const agent = store.get(id)
    if (!agent || agent.tenantId !== tenantId) throw new Error('Agent not found')
    const updated: Agent = { ...agent, ...data, updatedAt: new Date() }
    store.set(id, updated)
    return updated
  }
}
