import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RefreshSession } from '@/domains/auth/use-cases/RefreshSession'
import type { IRefreshTokenRepository } from '@/domains/auth/repositories/IRefreshTokenRepository'
import type { IUserRepository } from '@/domains/auth/repositories/IUserRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { UserRole } from '@/domains/auth/entities/User'

function makeToken(overrides = {}) {
  return {
    id: 'token-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    tokenHash: 'hash-abc',
    family: 'family-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    revokedAt: null,
    ...overrides,
  }
}

function makeRepos() {
  const tokenRepo: IRefreshTokenRepository = {
    create: vi.fn(),
    findByHash: vi.fn(),
    revokeById: vi.fn(),
    revokeByFamily: vi.fn(),
    revokeAllByUserId: vi.fn(),
  }
  const userRepo: IUserRepository = {
    findById: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Test User',
      tenantId: 'tenant-1',
      role: UserRole.TENANT_ADMIN,
      status: 'ACTIVE',
      passwordHash: 'hash',
      failedAttempts: 0,
      lockedUntil: null,
      tenant: null,
    }),
    findByEmail: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    resetFailedAttempts: vi.fn(),
    lockUntil: vi.fn(),
    create: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { tokenRepo, userRepo, auditLogger }
}

describe('RefreshSession', () => {
  let useCase: RefreshSession
  let tokenRepo: IRefreshTokenRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    tokenRepo = repos.tokenRepo
    auditLogger = repos.auditLogger
    useCase = new RefreshSession(tokenRepo, auditLogger, repos.userRepo)
  })

  // ── Spec critério: refresh com token válido ───────────────────────────────

  it('deve retornar novo accessToken com refresh token válido', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(makeToken())
    vi.mocked(tokenRepo.create).mockResolvedValue({ id: 'token-2', token: 'refresh-novo' })

    const result = await useCase.execute({ refreshToken: 'token-valido' })

    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  it('deve revogar o token anterior ao emitir o novo (rotation)', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(makeToken())
    vi.mocked(tokenRepo.create).mockResolvedValue({ id: 'token-2', token: 'refresh-novo' })

    await useCase.execute({ refreshToken: 'token-valido' })

    expect(tokenRepo.revokeById).toHaveBeenCalledWith('token-1')
  })

  // ── Spec critério: refresh token expirado ────────────────────────────────

  it('deve retornar SESSION_EXPIRED para token expirado', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(
      makeToken({ expiresAt: new Date(Date.now() - 1000) })
    )

    await expect(
      useCase.execute({ refreshToken: 'token-expirado' })
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })

  // ── Spec critério: token já revogado (reuse attack) ───────────────────────

  it('deve revogar família inteira ao detectar reuse de token revogado', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(
      makeToken({ revokedAt: new Date(), family: 'family-1' })
    )

    await expect(
      useCase.execute({ refreshToken: 'token-ja-usado' })
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })

    expect(tokenRepo.revokeByFamily).toHaveBeenCalledWith('family-1')
  })

  it('deve registrar alerta de segurança no audit log ao detectar reuse attack', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(
      makeToken({ revokedAt: new Date(), family: 'family-1' })
    )

    await expect(useCase.execute({ refreshToken: 'reusado' })).rejects.toBeDefined()

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_token.reuse_detected' })
    )
  })

  // ── Token inexistente ─────────────────────────────────────────────────────

  it('deve retornar SESSION_EXPIRED para token inexistente', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(null)

    await expect(
      useCase.execute({ refreshToken: 'inexistente' })
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
