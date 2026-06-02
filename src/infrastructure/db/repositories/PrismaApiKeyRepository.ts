import { randomUUID } from 'crypto'
import type { ApiKey, CreateApiKeyData, IApiKeyRepository } from '@/domains/tenant/repositories/IApiKeyRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaApiKeyRepository implements IApiKeyRepository {
  private get db() {
    return getPrismaClient()
  }

  async findByPrefix(prefix: string): Promise<ApiKey | null> {
    const record = await this.db.apiKey.findFirst({
      where: { keyPrefix: prefix },
    })
    return record ? this.toEntity(record) : null
  }

  async create(data: CreateApiKeyData): Promise<ApiKey> {
    const record = await this.db.apiKey.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        keyPrefix: data.keyPrefix,
        keyHash: data.keyHash,
        expiresAt: data.expiresAt,
      },
    })
    return this.toEntity(record)
  }

  async revoke(id: string): Promise<void> {
    await this.db.apiKey.update({
      where: { id },
      data: { status: 'REVOKED' },
    })
  }

  private toEntity(record: any): ApiKey {
    return {
      id: record.id,
      tenantId: record.tenantId,
      keyPrefix: record.keyPrefix,
      keyHash: record.keyHash,
      status: record.status as 'ACTIVE' | 'REVOKED',
      expiresAt: record.expiresAt,
    }
  }
}
