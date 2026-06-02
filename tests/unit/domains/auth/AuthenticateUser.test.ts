import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthenticateUser } from '@/domains/auth/use-cases/AuthenticateUser'
import type { IUserRepository } from '@/domains/auth/repositories/IUserRepository'
import type { IRefreshTokenRepository } from '@/domains/auth/repositories/IRefreshTokenRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IPasswordHasher } from '@/shared/types/IPasswordHasher'
import { UserRole } from '@/domains/auth/entities/User'
import { TenantStatus } from '@/domains/tenant/entities/Tenant'

// ─── Factories ───────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@devolus.com',
    name: 'Admin Devolus',
    passwordHash: '$2b$12$hashedpassword',
    role: UserRole.TENANT_ADMIN,
    status: 'ACTIVE' as const,
    failedAttempts: 0,
    lockedUntil: null,
    tenant: {
      id: 'tenant-1',
      slug: 'devolus',
      status: TenantStatus.ACTIVE,
    },
    ...overrides,
  }
}

function makeRepos() {
  const userRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    resetFailedAttempts: vi.fn(),
    lockUntil: vi.fn(),
    create: vi.fn(),
  }

  const tokenRepo: IRefreshTokenRepository = {
    create: vi.fn().mockResolvedValue({ id: 'token-1', token: 'refresh-abc' }),
    findByHash: vi.fn(),
    revokeById: vi.fn(),
    revokeByFamily: vi.fn(),
    revokeAllByUserId: vi.fn(),
  }

  const auditLogger: IAuditLogger = { log: vi.fn() }

  // default: senha incorreta — testes de sucesso sobrescrevem com true
  const passwordHasher: IPasswordHasher = {
    hash: vi.fn(),
    compare: vi.fn().mockResolvedValue(false),
  }

  return { userRepo, tokenRepo, auditLogger, passwordHasher }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('AuthenticateUser', () => {
  let useCase: AuthenticateUser
  let userRepo: IUserRepository
  let tokenRepo: IRefreshTokenRepository
  let auditLogger: IAuditLogger
  let passwordHasher: IPasswordHasher

  beforeEach(() => {
    const repos = makeRepos()
    userRepo = repos.userRepo
    tokenRepo = repos.tokenRepo
    auditLogger = repos.auditLogger
    passwordHasher = repos.passwordHasher
    useCase = new AuthenticateUser(userRepo, tokenRepo, auditLogger, passwordHasher)
  })

  // ── Spec critério 1: credenciais válidas ──────────────────────────────────

  it('deve retornar accessToken, refreshToken e dados do usuário com credenciais corretas', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser())
    vi.mocked(passwordHasher.compare).mockResolvedValue(true)

    const result = await useCase.execute({
      email: 'admin@devolus.com',
      password: 'senha-correta-123',
    })

    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.user.email).toBe('admin@devolus.com')
    expect(result.user).not.toHaveProperty('passwordHash')
  })

  // ── Spec critério 2: credenciais inválidas não revelam existência do e-mail

  it('deve retornar erro genérico INVALID_CREDENTIALS com e-mail inexistente', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(null)

    await expect(
      useCase.execute({ email: 'naoexiste@test.com', password: 'qualquer' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('deve retornar erro genérico INVALID_CREDENTIALS com senha incorreta', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser())
    // passwordHasher.compare default = false

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'senha-errada' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('deve incrementar failedAttempts a cada tentativa com senha incorreta', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser())

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'errada' })
    ).rejects.toBeDefined()

    expect(userRepo.incrementFailedAttempts).toHaveBeenCalledWith('user-1')
  })

  // ── Spec critério 3: bloqueio após 5 falhas ───────────────────────────────

  it('deve bloquear conta e retornar ACCOUNT_LOCKED na 5ª tentativa falha', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ failedAttempts: 4 }))

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'errada' })
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })

    expect(userRepo.lockUntil).toHaveBeenCalledWith('user-1', expect.any(Date))
  })

  // ── Spec critério 4: conta bloqueada ─────────────────────────────────────

  it('deve retornar ACCOUNT_LOCKED para conta com bloqueio ativo', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000)
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ lockedUntil }))

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'senha-correta-123' })
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })
  })

  it('deve permitir login quando o bloqueio expirou', async () => {
    const lockedUntil = new Date(Date.now() - 1000)
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ lockedUntil }))
    vi.mocked(passwordHasher.compare).mockResolvedValue(true)

    const result = await useCase.execute({
      email: 'admin@devolus.com',
      password: 'senha-correta-123',
    })

    expect(result.accessToken).toBeDefined()
    expect(userRepo.resetFailedAttempts).toHaveBeenCalledWith('user-1')
  })

  // ── Spec critério 5: conta inativa ───────────────────────────────────────

  it('deve retornar ACCOUNT_INACTIVE para conta com status inativo', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser({ status: 'INACTIVE' }))

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'senha-correta-123' })
    ).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' })
  })

  // ── Spec critério 6: tenant inativo ──────────────────────────────────────

  it('deve retornar TENANT_INACTIVE quando o tenant está inativo', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(
      makeUser({ tenant: { id: 'tenant-1', slug: 'devolus', status: TenantStatus.INACTIVE } })
    )

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'senha-correta-123' })
    ).rejects.toMatchObject({ code: 'TENANT_INACTIVE' })
  })

  it('deve retornar TENANT_INACTIVE quando o tenant está suspenso', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(
      makeUser({ tenant: { id: 'tenant-1', slug: 'devolus', status: TenantStatus.SUSPENDED } })
    )

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'senha-correta-123' })
    ).rejects.toMatchObject({ code: 'TENANT_INACTIVE' })
  })

  // ── Spec critério 7: super-admin ─────────────────────────────────────────

  it('deve retornar sessão sem tenantId para super-admin', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(
      makeUser({ tenantId: null, tenant: null, role: UserRole.PLATFORM_ADMIN })
    )
    vi.mocked(passwordHasher.compare).mockResolvedValue(true)

    const result = await useCase.execute({
      email: 'admin@platform.com',
      password: 'senha-correta-123',
    })

    expect(result.user.tenantId).toBeNull()
    expect(result.user.isPlatformAdmin).toBe(true)
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar login bem-sucedido no audit log', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser())
    vi.mocked(passwordHasher.compare).mockResolvedValue(true)

    await useCase.execute({ email: 'admin@devolus.com', password: 'senha-correta-123' })

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.success', userId: 'user-1' })
    )
  })

  it('deve registrar tentativa falha no audit log', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser())

    await expect(
      useCase.execute({ email: 'admin@devolus.com', password: 'errada' })
    ).rejects.toBeDefined()

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.failed' })
    )
  })

  // ── Segurança: senha não exposta ──────────────────────────────────────────

  it('não deve retornar passwordHash na resposta', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValue(makeUser())
    vi.mocked(passwordHasher.compare).mockResolvedValue(true)

    const result = await useCase.execute({
      email: 'admin@devolus.com',
      password: 'senha-correta-123',
    })

    expect(JSON.stringify(result)).not.toContain('passwordHash')
    expect(JSON.stringify(result)).not.toContain('hashedpassword')
  })
})
