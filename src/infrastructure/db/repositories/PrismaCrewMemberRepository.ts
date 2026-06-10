import { randomUUID } from 'crypto'
import type { CrewMember, CreateCrewMemberData } from '@/domains/crew/entities/CrewMember'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaCrewMemberRepository implements ICrewMemberRepository {
  private get db() { return getPrismaClient() }

  async create(data: CreateCrewMemberData): Promise<CrewMember> {
    const r = await this.db.crewMember.create({
      data: { id: randomUUID(), tenantId: data.tenantId, crewId: data.crewId,
              agentId: data.agentId, role: data.role, order: data.order,
              isRequired: data.isRequired ?? true },
    })
    return this.toEntity(r)
  }

  async findById(id: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { crewId, agentId, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findFirstByAgent(agentId: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { agentId, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]> {
    const records = await this.db.crewMember.findMany({
      where: { crewId, tenantId }, orderBy: { order: 'asc' },
    })
    return records.map((r) => this.toEntity(r))
  }

  async findDirector(crewId: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { crewId, tenantId, role: 'DIRECTOR' } })
    return r ? this.toEntity(r) : null
  }

  async countDirectors(crewId: string, tenantId: string): Promise<number> {
    return this.db.crewMember.count({ where: { crewId, tenantId, role: 'DIRECTOR' } })
  }

  async countByCrew(crewId: string, tenantId: string): Promise<number> {
    return this.db.crewMember.count({ where: { crewId, tenantId } })
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.crewMember.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): CrewMember {
    return {
      id: r.id, tenantId: r.tenantId, crewId: r.crewId, agentId: r.agentId,
      role: r.role as CrewMemberRole, order: r.order, isRequired: r.isRequired,
      createdAt: r.createdAt,
    }
  }
}
