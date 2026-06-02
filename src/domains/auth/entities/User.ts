import type { TenantStatus } from '@/domains/tenant/entities/Tenant'

export enum UserRole {
  TENANT_ADMIN = 'TENANT_ADMIN',
  TENANT_OPERATOR = 'TENANT_OPERATOR',
  KDL_APPROVER = 'KDL_APPROVER',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export type User = {
  id: string
  tenantId: string | null
  email: string
  name: string
  passwordHash: string
  role: UserRole
  status: UserStatus
  failedAttempts: number
  lockedUntil: Date | null
  tenant: {
    id: string
    slug: string
    status: TenantStatus
  } | null
}

export type CreateUserData = {
  tenantId: string | null
  email: string
  name: string
  passwordHash: string
  role: UserRole
  status?: UserStatus
}
