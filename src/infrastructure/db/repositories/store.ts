import type { User } from '@/domains/auth/entities/User'
import type { RefreshToken } from '@/domains/auth/entities/RefreshToken'
import type { Tenant } from '@/domains/tenant/entities/Tenant'
import type { ApiKey } from '@/domains/tenant/repositories/IApiKeyRepository'

// Shared in-memory store — replaced by Prisma in production
export const users = new Map<string, User>()
export const tokens = new Map<string, RefreshToken>()
export const tenants = new Map<string, Tenant>()
export const apiKeys = new Map<string, ApiKey>()
