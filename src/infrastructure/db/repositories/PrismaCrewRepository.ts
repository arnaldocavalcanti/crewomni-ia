import { randomUUID } from 'crypto'
import type { Crew, CreateCrewData, UpdateCrewData } from '@/domains/crew/entities/Crew'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaCrewRepository implements ICrewRepository {
  private get db() { return getPrismaClient() }

  async create(data: CreateCrewData): Promise<Crew> {
    const r = await this.db.crew.create({
      data: { id: randomUUID(), tenantId: data.tenantId, departmentId: data.departmentId,
              name: data.name, slug: data.slug, description: data.description, objective: data.objective },
    })
    return this.toEntity(r)
  }

  async findById(id: string, tenantId: string): Promise<Crew | null> {
    const r = await this.db.crew.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string): Promise<Crew | null> {
    const r = await this.db.crew.findFirst({ where: { name, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findAllByTenant(tenantId: string): Promise<Crew[]> {
    const records = await this.db.crew.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
    return records.map((r) => this.toEntity(r))
  }

  async findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]> {
    const records = await this.db.crew.findMany({ where: { departmentId, tenantId }, orderBy: { name: 'asc' } })
    return records.map((r) => this.toEntity(r))
  }

  async update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew> {
    await this.db.crew.updateMany({ where: { id, tenantId }, data })
    const updated = await this.db.crew.findFirst({ where: { id, tenantId } })
    return this.toEntity(updated!)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.crew.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): Crew {
    return {
      id: r.id, tenantId: r.tenantId, departmentId: r.departmentId,
      name: r.name, slug: r.slug, description: r.description, objective: r.objective,
      status: r.status as CrewStatus, createdAt: r.createdAt, updatedAt: r.updatedAt,
    }
  }
}
