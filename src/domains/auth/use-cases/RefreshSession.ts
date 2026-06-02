import { createHash, randomUUID } from 'crypto'
import { SignJWT } from 'jose'
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_MS } from '@/shared/constants'
import type { IRefreshTokenRepository } from '../repositories/IRefreshTokenRepository'

type RefreshInput = {
  refreshToken: string
}

type RefreshOutput = {
  accessToken: string
  refreshToken: string
}

const jwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-production')

export class RefreshSession {
  constructor(
    private tokenRepo: IRefreshTokenRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: RefreshInput): Promise<RefreshOutput> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex')
    const storedToken = await this.tokenRepo.findByHash(tokenHash)

    if (!storedToken) {
      throw new AppError('SESSION_EXPIRED', 'Sessão expirada. Faça login novamente')
    }

    if (storedToken.revokedAt !== null) {
      await this.tokenRepo.revokeByFamily(storedToken.family)
      await this.auditLogger.log({
        action: 'auth.refresh_token.reuse_detected',
        userId: storedToken.userId,
        tenantId: storedToken.tenantId ?? undefined,
        metadata: { family: storedToken.family },
      })
      throw new AppError('SESSION_EXPIRED', 'Sessão inválida. Faça login novamente')
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError('SESSION_EXPIRED', 'Sessão expirada. Faça login novamente')
    }

    await this.tokenRepo.revokeById(storedToken.id)

    const accessToken = await new SignJWT({
      userId: storedToken.userId,
      tenantId: storedToken.tenantId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .setIssuedAt()
      .sign(jwtSecret())

    const { token: newRefreshToken } = await this.tokenRepo.create({
      userId: storedToken.userId,
      tenantId: storedToken.tenantId,
      family: storedToken.family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })

    return { accessToken, refreshToken: newRefreshToken }
  }
}
