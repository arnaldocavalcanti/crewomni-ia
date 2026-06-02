import { randomUUID } from 'crypto'
import type { Department, CreateDepartmentData, UpdateDepartmentData } from '@/domains/organization/entities/Department'
import { DepartmentStatus } from '@/domains/organization/entities/Department'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaDepartmentRepository implements IDepartmentRepository {
  private get db() { return getPrismaClient() }

  async create(data: CreateDepartmentData): Promise<Department> {
    const r = await this.db.department.create({
      data: { id: randomUUID(), tenantId: data.tenantId, name: data.name, slug: data.slug, description: data.description },
    })
    return this.toEntity(r)
  }

  async findById(id: string, tenantId: string): Promise<Department | null> {
    const r = await this.db.department.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string): Promise<Department | null> {
    const r = await this.db.department.findFirst({ where: { name, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Department | null> {
    const r = await this.db.department.findFirst({ where: { slug, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findAllByTenant(tenantId: string): Promise<Department[]> {
    const records = await this.db.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
    return records.map((r) => this.toEntity(r))
  }

  async update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department> {
    await this.db.department.updateMany({ where: { id, tenantId }, data })
    const updated = await this.db.department.findFirst({ where: { id, tenantId } })
    return this.toEntity(updated!)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.department.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): Department {
    return {
      id: r.id, tenantId: r.tenantId, name: r.name, slug: r.slug,
      description: r.description, status: r.status as DepartmentStatus,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }
  }
}
