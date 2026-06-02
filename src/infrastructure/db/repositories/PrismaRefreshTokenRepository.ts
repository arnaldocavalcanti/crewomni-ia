import { createHash, randomBytes, randomUUID } from 'crypto'
import type { RefreshToken, CreateRefreshTokenData } from '@/domains/auth/entities/RefreshToken'
import type { IRefreshTokenRepository } from '@/domains/auth/repositories/IRefreshTokenRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  private get db() {
    return getPrismaClient()
  }

  async create(data: CreateRefreshTokenData): Promise<{ id: string; token: string }> {
    const rawToken = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    const record = await this.db.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: data.userId,
        tenantId: data.tenantId,
        tokenHash,
        family: data.family,
        expiresAt: data.expiresAt,
      },
    })

    return { id: record.id, token: rawToken }
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const record = await this.db.refreshToken.findUnique({
      where: { tokenHash },
    })
    return record ? this.toEntity(record) : null
  }

  async revokeById(id: string): Promise<void> {
    await this.db.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  async revokeByFamily(family: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  private toEntity(record: any): RefreshToken {
    return {
      id: record.id,
      userId: record.userId,
      tenantId: record.tenantId,
      tokenHash: record.tokenHash,
      family: record.family,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
    }
  }
}
