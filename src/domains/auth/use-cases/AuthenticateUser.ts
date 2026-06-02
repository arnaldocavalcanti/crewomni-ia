import { createHash, randomUUID } from 'crypto'
import { SignJWT } from 'jose'
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IPasswordHasher } from '@/shared/types/IPasswordHasher'
import {
  LOCK_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
} from '@/shared/constants'
import { UserRole } from '../entities/User'
import { TenantStatus } from '@/domains/tenant/entities/Tenant'
import type { IUserRepository } from '../repositories/IUserRepository'
import type { IRefreshTokenRepository } from '../repositories/IRefreshTokenRepository'

type LoginInput = {
  email: string
  password: string
}

type LoginOutput = {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    tenantId: string | null
    isPlatformAdmin: boolean
  }
}

const jwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-production')

export class AuthenticateUser {
  constructor(
    private userRepo: IUserRepository,
    private tokenRepo: IRefreshTokenRepository,
    private auditLogger: IAuditLogger,
    private passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepo.findByEmail(input.email)

    if (!user) {
      await this.auditLogger.log({ action: 'auth.login.failed', metadata: { reason: 'user_not_found' } })
      throw new AppError('INVALID_CREDENTIALS', 'Credenciais inválidas')
    }

    if (user.status === 'INACTIVE') {
      throw new AppError('ACCOUNT_INACTIVE', 'Conta inativa. Contate o administrador')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('ACCOUNT_LOCKED', 'Conta temporariamente bloqueada')
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.userRepo.resetFailedAttempts(user.id)
    }

    if (user.tenant && user.tenant.status !== TenantStatus.ACTIVE) {
      throw new AppError('TENANT_INACTIVE', 'Tenant inativo ou suspenso')
    }

    const isValid = await this.passwordHasher.compare(input.password, user.passwordHash)

    if (!isValid) {
      await this.userRepo.incrementFailedAttempts(user.id)

      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS - 1) {
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MS)
        await this.userRepo.lockUntil(user.id, lockUntil)
        await this.auditLogger.log({
          action: 'auth.login.failed',
          userId: user.id,
          metadata: { reason: 'account_locked' },
        })
        throw new AppError('ACCOUNT_LOCKED', 'Conta temporariamente bloqueada após múltiplas falhas')
      }

      await this.auditLogger.log({
        action: 'auth.login.failed',
        userId: user.id,
        metadata: { reason: 'invalid_password' },
      })
      throw new AppError('INVALID_CREDENTIALS', 'Credenciais inválidas')
    }

    await this.userRepo.resetFailedAttempts(user.id)

    const accessToken = await new SignJWT({ userId: user.id, tenantId: user.tenantId, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .setIssuedAt()
      .sign(jwtSecret())

    const family = randomUUID()
    const rawTokenHash = createHash('sha256').update(randomUUID()).digest('hex')
    const { token: refreshToken } = await this.tokenRepo.create({
      userId: user.id,
      tenantId: user.tenantId,
      family,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })

    await this.auditLogger.log({
      action: 'auth.login.success',
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isPlatformAdmin: user.role === UserRole.PLATFORM_ADMIN,
      },
    }
  }
}
