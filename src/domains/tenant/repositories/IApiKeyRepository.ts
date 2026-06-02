export type ApiKey = {
  id: string
  tenantId: string
  keyPrefix: string
  keyHash: string
  status: 'ACTIVE' | 'REVOKED'
  expiresAt: Date | null
}

export type CreateApiKeyData = {
  tenantId: string
  keyPrefix: string
  keyHash: string
  expiresAt?: Date
}

export interface IApiKeyRepository {
  findByPrefix(prefix: string): Promise<ApiKey | null>
  create(data: CreateApiKeyData): Promise<ApiKey>
  revoke(id: string): Promise<void>
}
