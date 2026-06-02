import { createHash } from 'crypto'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IRefreshTokenRepository } from '../repositories/IRefreshTokenRepository'

type LogoutInput = {
  refreshToken: string
  userId: string
}

export class LogoutUser {
  constructor(
    private tokenRepo: IRefreshTokenRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex')
    const storedToken = await this.tokenRepo.findByHash(tokenHash)

    if (!storedToken) return

    if (storedToken.userId !== input.userId) return

    await this.tokenRepo.revokeById(storedToken.id)

    await this.auditLogger.log({
      action: 'auth.logout',
      userId: input.userId,
      tenantId: storedToken.tenantId ?? undefined,
    })
  }
}
