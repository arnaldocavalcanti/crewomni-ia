import { createHash, randomBytes, randomUUID } from 'crypto'
import type { RefreshToken, CreateRefreshTokenData } from '@/domains/auth/entities/RefreshToken'
import type { IRefreshTokenRepository } from '@/domains/auth/repositories/IRefreshTokenRepository'
import { tokens } from './store'

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: CreateRefreshTokenData): Promise<{ id: string; token: string }> {
    const rawToken = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const record: RefreshToken = {
      id: randomUUID(),
      userId: data.userId,
      tenantId: data.tenantId,
      tokenHash,
      family: data.family,
      expiresAt: data.expiresAt,
      revokedAt: null,
    }
    tokens.set(record.id, record)
    return { id: record.id, token: rawToken }
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return Array.from(tokens.values()).find((t) => t.tokenHash === tokenHash) ?? null
  }

  async revokeById(id: string): Promise<void> {
    const token = tokens.get(id)
    if (token) tokens.set(id, { ...token, revokedAt: new Date() })
  }

  async revokeByFamily(family: string): Promise<void> {
    for (const [id, token] of tokens) {
      if (token.family === family) tokens.set(id, { ...token, revokedAt: new Date() })
    }
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    for (const [id, token] of tokens) {
      if (token.userId === userId) tokens.set(id, { ...token, revokedAt: new Date() })
    }
  }
}
