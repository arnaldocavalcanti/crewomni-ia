import type { Tenant, TenantStatus } from '../entities/Tenant'

export type CreateTenantData = {
  name: string
  slug: string
  niche: string
  status: TenantStatus
  allowedDomains?: string[]
  plan?: string
}

export interface ITenantRepository {
  findById(id: string): Promise<Tenant | null>
  findBySlug(slug: string): Promise<Tenant | null>
  create(data: CreateTenantData): Promise<Tenant>
  updateStatus(id: string, status: TenantStatus): Promise<void>
}
