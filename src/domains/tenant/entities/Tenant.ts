export enum Niche {
  REAL_ESTATE = 'REAL_ESTATE',
  ESIGN = 'ESIGN',
  LEGAL = 'LEGAL',
  HR = 'HR',
  SUPPORT = 'SUPPORT',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export type Tenant = {
  id: string
  slug: string
  name: string
  niche: Niche
  status: TenantStatus
  allowedDomains: string[]
  plan: string
  createdAt?: Date
}

export type TenantSettings = {
  tenantId: string
  dpoName?: string
  dpoEmail?: string
  privacyPolicyUrl?: string
  dataRetentionDays: number
}
