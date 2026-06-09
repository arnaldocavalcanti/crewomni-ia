import { randomUUID } from 'crypto'
import type { AgentRole, CreateAgentRoleData } from '@/domains/agent/entities/AgentRole'
import type { IAgentRoleRepository } from '@/domains/agent/repositories/IAgentRoleRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaAgentRoleRepository implements IAgentRoleRepository {
  private get db() {
    return getPrismaClient()
  }

  async findById(id: string): Promise<AgentRole | null> {
    const r = await this.db.agentRole.findUnique({ where: { id } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string | null): Promise<AgentRole | null> {
    const r = await this.db.agentRole.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        tenantId,
      },
    })
    return r ? this.toEntity(r) : null
  }

  async list(tenantId: string): Promise<AgentRole[]> {
    const records = await this.db.agentRole.findMany({
      where: {
        OR: [
          { tenantId: null },
          { tenantId },
        ],
      },
      orderBy: { name: 'asc' },
    })
    return records.map((r) => this.toEntity(r))
  }

  async create(data: CreateAgentRoleData): Promise<AgentRole> {
    const r = await this.db.agentRole.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId ?? null,
        name: data.name,
        category: data.category,
        description: data.description ?? null,
      },
    })
    return this.toEntity(r)
  }

  private toEntity(r: any): AgentRole {
    return {
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      category: r.category,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}
