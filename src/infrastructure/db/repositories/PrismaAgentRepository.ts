import { randomUUID } from 'crypto'
import type { Agent, AgentStatus, CreateAgentData } from '@/domains/agent/entities/Agent'
import { AgentStatus as AS, AgentType } from '@/domains/agent/entities/Agent'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaAgentRepository implements IAgentRepository {
  private get db() { return getPrismaClient() }

  async findById(id: string, tenantId: string): Promise<Agent | null> {
    const r = await this.db.agent.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string): Promise<Agent | null> {
    const r = await this.db.agent.findFirst({ where: { name, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Agent | null> {
    const r = await this.db.agent.findFirst({ where: { slug, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async countActive(tenantId: string): Promise<number> {
    return this.db.agent.count({ where: { tenantId, status: 'ACTIVE' } })
  }

  async listByTenant(tenantId: string): Promise<Agent[]> {
    const records = await this.db.agent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
    return records.map((r) => this.toEntity(r))
  }

  async create(data: CreateAgentData): Promise<Agent> {
    const r = await this.db.agent.create({
      data: { id: randomUUID(), tenantId: data.tenantId, name: data.name, slug: data.slug, type: data.type, description: data.description },
    })
    return this.toEntity(r)
  }

  async updateStatus(id: string, tenantId: string, status: AgentStatus): Promise<void> {
    await this.db.agent.updateMany({ where: { id, tenantId }, data: { status } })
  }

  private toEntity(r: any): Agent {
    return { id: r.id, tenantId: r.tenantId, name: r.name, slug: r.slug, type: r.type as AgentType, description: r.description, status: r.status as AS, createdAt: r.createdAt, updatedAt: r.updatedAt }
  }
}
