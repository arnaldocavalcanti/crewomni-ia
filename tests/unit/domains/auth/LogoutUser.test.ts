import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LogoutUser } from '@/domains/auth/use-cases/LogoutUser'
import type { IRefreshTokenRepository } from '@/domains/auth/repositories/IRefreshTokenRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'

function makeRepos() {
  const tokenRepo: IRefreshTokenRepository = {
    create: vi.fn(),
    findByHash: vi.fn(),
    revokeById: vi.fn(),
    revokeByFamily: vi.fn(),
    revokeAllByUserId: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { tokenRepo, auditLogger }
}

describe('LogoutUser', () => {
  let useCase: LogoutUser
  let tokenRepo: IRefreshTokenRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    tokenRepo = repos.tokenRepo
    auditLogger = repos.auditLogger
    useCase = new LogoutUser(tokenRepo, auditLogger)
  })

  // ── Spec critério: logout invalida refresh token ──────────────────────────

  it('deve revogar o refresh token da sessão atual no logout', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      tokenHash: 'hash-abc',
      family: 'family-1',
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
    })

    await useCase.execute({ refreshToken: 'token-valido', userId: 'user-1' })

    expect(tokenRepo.revokeById).toHaveBeenCalledWith('token-1')
  })

  it('deve registrar logout no audit log', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      tokenHash: 'hash-abc',
      family: 'family-1',
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
    })

    await useCase.execute({ refreshToken: 'token-valido', userId: 'user-1' })

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout', userId: 'user-1' })
    )
  })

  it('deve concluir sem erro mesmo quando token não é encontrado (logout idempotente)', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue(null)

    await expect(
      useCase.execute({ refreshToken: 'inexistente', userId: 'user-1' })
    ).resolves.not.toThrow()
  })

  it('não deve revogar token de outro usuário', async () => {
    vi.mocked(tokenRepo.findByHash).mockResolvedValue({
      id: 'token-1',
      userId: 'user-OUTRO',
      tenantId: 'tenant-2',
      tokenHash: 'hash-abc',
      family: 'family-1',
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
    })

    await useCase.execute({ refreshToken: 'token-alheio', userId: 'user-1' })

    expect(tokenRepo.revokeById).not.toHaveBeenCalled()
  })
})
