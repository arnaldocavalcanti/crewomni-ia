import { randomUUID } from 'crypto'
import type { Tenant, TenantStatus, Niche } from '@/domains/tenant/entities/Tenant'
import type { ITenantRepository, CreateTenantData } from '@/domains/tenant/repositories/ITenantRepository'
import { tenants } from './store'

export class InMemoryTenantRepository implements ITenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    return tenants.get(id) ?? null
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return Array.from(tenants.values()).find((t) => t.slug === slug) ?? null
  }

  async create(data: CreateTenantData): Promise<Tenant> {
    const tenant: Tenant = {
      id: randomUUID(),
      name: data.name,
      slug: data.slug,
      niche: data.niche as Niche,
      status: data.status,
      allowedDomains: data.allowedDomains ?? [],
      plan: data.plan ?? 'FREE',
      createdAt: new Date(),
    }
    tenants.set(tenant.id, tenant)
    return tenant
  }

  async updateStatus(id: string, status: TenantStatus): Promise<void> {
    const tenant = tenants.get(id)
    if (tenant) tenants.set(id, { ...tenant, status })
  }
}
