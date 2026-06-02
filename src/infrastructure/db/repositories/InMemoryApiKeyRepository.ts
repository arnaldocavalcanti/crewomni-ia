import { randomUUID } from 'crypto'
import type { ApiKey, CreateApiKeyData, IApiKeyRepository } from '@/domains/tenant/repositories/IApiKeyRepository'
import { apiKeys } from './store'

export class InMemoryApiKeyRepository implements IApiKeyRepository {
  async findByPrefix(prefix: string): Promise<ApiKey | null> {
    return Array.from(apiKeys.values()).find((k) => k.keyPrefix === prefix) ?? null
  }

  async create(data: CreateApiKeyData): Promise<ApiKey> {
    const key: ApiKey = {
      id: randomUUID(),
      tenantId: data.tenantId,
      keyPrefix: data.keyPrefix,
      keyHash: data.keyHash,
      status: 'ACTIVE',
      expiresAt: data.expiresAt ?? null,
    }
    apiKeys.set(key.id, key)
    return key
  }

  async revoke(id: string): Promise<void> {
    const key = apiKeys.get(id)
    if (key) apiKeys.set(id, { ...key, status: 'REVOKED' })
  }
}
