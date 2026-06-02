import { randomUUID } from 'crypto'
import type { Tenant, TenantStatus, Niche } from '@/domains/tenant/entities/Tenant'
import type { ITenantRepository, CreateTenantData } from '@/domains/tenant/repositories/ITenantRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaTenantRepository implements ITenantRepository {
  private get db() {
    return getPrismaClient()
  }

  async findById(id: string): Promise<Tenant | null> {
    const record = await this.db.tenant.findUnique({ where: { id } })
    return record ? this.toEntity(record) : null
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const record = await this.db.tenant.findUnique({ where: { slug } })
    return record ? this.toEntity(record) : null
  }

  async create(data: CreateTenantData): Promise<Tenant> {
    const record = await this.db.tenant.create({
      data: {
        id: randomUUID(),
        name: data.name,
        slug: data.slug,
        niche: data.niche as Niche,
        status: data.status,
        allowedDomains: data.allowedDomains ?? [],
        plan: data.plan ?? 'FREE',
      },
    })
    return this.toEntity(record)
  }

  async updateStatus(id: string, status: TenantStatus): Promise<void> {
    await this.db.tenant.update({ where: { id }, data: { status } })
  }

  private toEntity(record: any): Tenant {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      niche: record.niche as Niche,
      status: record.status as TenantStatus,
      allowedDomains: record.allowedDomains,
      plan: record.plan,
      createdAt: record.createdAt,
    }
  }
}
