import { randomUUID } from 'crypto'
import type { AgentPromptVersion, CreatePromptVersionData } from '@/domains/agent/entities/AgentPromptVersion'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'

const store = new Map<string, AgentPromptVersion>()

export class InMemoryAgentPromptVersionRepository implements IAgentPromptVersionRepository {
  async findActiveByAgent(agentId: string, tenantId: string): Promise<AgentPromptVersion | null> {
    return Array.from(store.values()).find(
      (pv) => pv.agentId === agentId && pv.tenantId === tenantId && pv.status === PromptVersionStatus.ACTIVE
    ) ?? null
  }

  async getLatestVersion(agentId: string): Promise<number> {
    const versions = Array.from(store.values()).filter((pv) => pv.agentId === agentId)
    if (versions.length === 0) return 0
    return Math.max(...versions.map((pv) => pv.version))
  }

  async create(data: CreatePromptVersionData): Promise<AgentPromptVersion> {
    const pv: AgentPromptVersion = {
      id: randomUUID(),
      agentId: data.agentId,
      tenantId: data.tenantId,
      systemPrompt: data.systemPrompt,
      version: data.version,
      status: data.status,
      createdAt: new Date(),
    }
    store.set(pv.id, pv)
    return pv
  }

  async supersedePrevious(agentId: string, tenantId: string): Promise<void> {
    for (const [id, pv] of store) {
      if (pv.agentId === agentId && pv.tenantId === tenantId && pv.status === PromptVersionStatus.ACTIVE) {
        store.set(id, { ...pv, status: PromptVersionStatus.SUPERSEDED })
      }
    }
  }
}
