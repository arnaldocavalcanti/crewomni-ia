import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateTenant } from '@/domains/tenant/use-cases/CreateTenant'
import type { ITenantRepository } from '@/domains/tenant/repositories/ITenantRepository'
import type { IUserRepository } from '@/domains/auth/repositories/IUserRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IPasswordHasher } from '@/shared/types/IPasswordHasher'
import { Niche, TenantStatus } from '@/domains/tenant/entities/Tenant'
import { UserRole } from '@/domains/auth/entities/User'

// ─── Factories ───────────────────────────────────────────────────────────────

function makeInput(overrides = {}) {
  return {
    name: 'Devolus',
    slug: 'devolus',
    niche: Niche.REAL_ESTATE,
    ownerEmail: 'admin@devolus.com',
    ownerName: 'Admin Devolus',
    ...overrides,
  }
}

function makeRepos() {
  const tenantRepo: ITenantRepository = {
    findById: vi.fn(),
    findBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 'tenant-1',
      slug: 'devolus',
      name: 'Devolus',
      niche: Niche.REAL_ESTATE,
      status: TenantStatus.ACTIVE,
      allowedDomains: [],
      plan: 'FREE',
      createdAt: new Date('2026-05-29'),
    }),
    updateStatus: vi.fn(),
  }
  const userRepo: IUserRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    resetFailedAttempts: vi.fn(),
    lockUntil: vi.fn(),
    create: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'admin@devolus.com',
      name: 'Admin Devolus',
      tenantId: 'tenant-1',
      role: UserRole.TENANT_ADMIN,
      status: 'ACTIVE',
      passwordHash: '$2b$12$mocked-hash',
      failedAttempts: 0,
      lockedUntil: null,
      tenant: null,
    }),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  const passwordHasher: IPasswordHasher = {
    hash: vi.fn().mockResolvedValue('$2b$12$mocked-hash'),
    compare: vi.fn(),
  }
  return { tenantRepo, userRepo, auditLogger, passwordHasher }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('CreateTenant', () => {
  let useCase: CreateTenant
  let tenantRepo: ITenantRepository
  let userRepo: IUserRepository
  let auditLogger: IAuditLogger
  let passwordHasher: IPasswordHasher

  beforeEach(() => {
    const repos = makeRepos()
    tenantRepo = repos.tenantRepo
    userRepo = repos.userRepo
    auditLogger = repos.auditLogger
    passwordHasher = repos.passwordHasher
    useCase = new CreateTenant(tenantRepo, userRepo, auditLogger, passwordHasher)
  })

  // ── Spec critério: criação bem-sucedida ───────────────────────────────────

  it('deve criar tenant com owner e retornar senha temporária', async () => {
    const result = await useCase.execute(makeInput())

    expect(result.tenant.slug).toBe('devolus')
    expect(result.owner.email).toBe('admin@devolus.com')
    expect(result.owner.temporaryPassword).toBeDefined()
    expect(result.owner.temporaryPassword.length).toBeGreaterThan(8)
  })

  it('deve criar o owner com role TENANT_ADMIN', async () => {
    await useCase.execute(makeInput())

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.TENANT_ADMIN })
    )
  })

  it('deve criar tenant com status ACTIVE por padrão', async () => {
    await useCase.execute(makeInput())

    expect(tenantRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: TenantStatus.ACTIVE })
    )
  })

  it('deve nunca armazenar senha temporária em plaintext — apenas o hash', async () => {
    await useCase.execute(makeInput())

    const createCall = vi.mocked(userRepo.create).mock.calls[0][0]
    expect(createCall).not.toHaveProperty('temporaryPassword')
    expect(createCall).toHaveProperty('passwordHash')
    expect(createCall.passwordHash).toBeTruthy()
  })

  // ── Spec critério: validação do slug ─────────────────────────────────────

  it('deve rejeitar slug duplicado', async () => {
    vi.mocked(tenantRepo.findBySlug).mockResolvedValue({
      id: 'outro-tenant',
      slug: 'devolus',
      name: 'Outro',
      niche: Niche.REAL_ESTATE,
      status: TenantStatus.ACTIVE,
      allowedDomains: [],
      plan: 'FREE',
    })

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      code: 'SLUG_ALREADY_TAKEN',
    })
  })

  it('deve rejeitar slug com menos de 3 caracteres', async () => {
    await expect(
      useCase.execute(makeInput({ slug: 'ab' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deve rejeitar slug com mais de 32 caracteres', async () => {
    await expect(
      useCase.execute(makeInput({ slug: 'a'.repeat(33) }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deve rejeitar slug com caracteres inválidos (espaço, underscore, maiúsculas)', async () => {
    const invalidSlugs = ['devo lus', 'devo_lus', 'DEVOLUS']

    for (const slug of invalidSlugs) {
      await expect(
        useCase.execute(makeInput({ slug }))
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    }
  })

  it('deve aceitar slug com hífens', async () => {
    const result = await useCase.execute(makeInput({ slug: 'fast-4-sign' }))
    expect(result.tenant).toBeDefined()
  })

  // ── Spec critério: validação do name ─────────────────────────────────────

  it('deve rejeitar name com menos de 3 caracteres', async () => {
    await expect(
      useCase.execute(makeInput({ name: 'AB' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar criação do tenant no audit log', async () => {
    await useCase.execute(makeInput())

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.created' })
    )
  })
})
