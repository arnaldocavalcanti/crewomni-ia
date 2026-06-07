import { randomUUID } from 'crypto'
import type { AgentPromptVersion, CreatePromptVersionData } from '@/domains/agent/entities/AgentPromptVersion'
import { PromptVersionStatus } from '@/domains/agent/entities/AgentPromptVersion'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaAgentPromptVersionRepository implements IAgentPromptVersionRepository {
  private get db() { return getPrismaClient() }

  async findActiveByAgent(agentId: string, tenantId: string): Promise<AgentPromptVersion | null> {
    const r = await this.db.agentPromptVersion.findFirst({
      where: { agentId, tenantId, status: 'ACTIVE' },
    })
    return r ? this.toEntity(r) : null
  }

  async findLatestByAgent(agentId: string, tenantId: string): Promise<AgentPromptVersion | null> {
    const r = await this.db.agentPromptVersion.findFirst({
      where: { agentId, tenantId },
      orderBy: { version: 'desc' },
    })
    return r ? this.toEntity(r) : null
  }

  async getLatestVersion(agentId: string): Promise<number> {
    const r = await this.db.agentPromptVersion.findFirst({
      where: { agentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    return r?.version ?? 0
  }

  async create(data: CreatePromptVersionData): Promise<AgentPromptVersion> {
    const r = await this.db.agentPromptVersion.create({
      data: { id: randomUUID(), agentId: data.agentId, tenantId: data.tenantId, systemPrompt: data.systemPrompt, version: data.version, status: data.status },
    })
    return this.toEntity(r)
  }

  async supersedePrevious(agentId: string, tenantId: string): Promise<void> {
    await this.db.agentPromptVersion.updateMany({
      where: { agentId, tenantId, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' },
    })
  }

  private toEntity(r: any): AgentPromptVersion {
    return { id: r.id, agentId: r.agentId, tenantId: r.tenantId, systemPrompt: r.systemPrompt, version: r.version, status: r.status as PromptVersionStatus, createdAt: r.createdAt }
  }
}
