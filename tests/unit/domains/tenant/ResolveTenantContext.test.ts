import { createHash } from 'crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResolveTenantContext } from '@/domains/tenant/use-cases/ResolveTenantContext'
import type { ITenantRepository } from '@/domains/tenant/repositories/ITenantRepository'
import type { IApiKeyRepository } from '@/domains/tenant/repositories/IApiKeyRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { TenantStatus, Niche } from '@/domains/tenant/entities/Tenant'

// ─── Factories ───────────────────────────────────────────────────────────────

const TEST_RAW_KEY = 'ahub_live_devo_secretpart'

function makeTenant(overrides = {}) {
  return {
    id: 'tenant-1',
    slug: 'devolus',
    name: 'Devolus',
    niche: Niche.REAL_ESTATE,
    status: TenantStatus.ACTIVE,
    allowedDomains: ['devolus.com', 'app.devolus.com'],
    plan: 'PRO',
    ...overrides,
  }
}

function makeApiKey(overrides = {}) {
  return {
    id: 'key-1',
    tenantId: 'tenant-1',
    keyPrefix: 'ahub_live_devo',
    keyHash: createHash('sha256').update(TEST_RAW_KEY).digest('hex'),
    status: 'ACTIVE' as const,
    expiresAt: null,
    ...overrides,
  }
}

function makeRepos() {
  const tenantRepo: ITenantRepository = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  }
  const apiKeyRepo: IApiKeyRepository = {
    findByPrefix: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
  }
  const auditLogger: IAuditLogger = { log: vi.fn() }
  return { tenantRepo, apiKeyRepo, auditLogger }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('ResolveTenantContext', () => {
  let useCase: ResolveTenantContext
  let tenantRepo: ITenantRepository
  let apiKeyRepo: IApiKeyRepository
  let auditLogger: IAuditLogger

  beforeEach(() => {
    const repos = makeRepos()
    tenantRepo = repos.tenantRepo
    apiKeyRepo = repos.apiKeyRepo
    auditLogger = repos.auditLogger
    useCase = new ResolveTenantContext(tenantRepo, apiKeyRepo, auditLogger)
  })

  // ── Estratégia JWT ────────────────────────────────────────────────────────

  it('deve resolver tenant corretamente a partir de tenantId no JWT', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(makeTenant())

    const result = await useCase.execute({
      strategy: 'JWT',
      tenantId: 'tenant-1',
    })

    expect(result.tenantId).toBe('tenant-1')
    expect(result.tenant.slug).toBe('devolus')
    expect(result.resolutionStrategy).toBe('JWT')
  })

  // ── Estratégia API Key ────────────────────────────────────────────────────

  it('deve resolver tenant corretamente a partir de API key válida', async () => {
    vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue(makeApiKey())
    vi.mocked(tenantRepo.findById).mockResolvedValue(makeTenant())

    const result = await useCase.execute({
      strategy: 'API_KEY',
      rawKey: TEST_RAW_KEY,
    })

    expect(result.tenantId).toBe('tenant-1')
    expect(result.resolutionStrategy).toBe('API_KEY')
    expect(result.apiKeyId).toBe('key-1')
  })

  it('deve retornar INVALID_API_KEY para chave revogada', async () => {
    vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue(makeApiKey({ status: 'REVOKED' }))

    await expect(
      useCase.execute({ strategy: 'API_KEY', rawKey: TEST_RAW_KEY })
    ).rejects.toMatchObject({ code: 'INVALID_API_KEY' })
  })

  it('deve retornar INVALID_API_KEY para chave expirada', async () => {
    vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue(
      makeApiKey({ expiresAt: new Date(Date.now() - 1000) })
    )

    await expect(
      useCase.execute({ strategy: 'API_KEY', rawKey: TEST_RAW_KEY })
    ).rejects.toMatchObject({ code: 'INVALID_API_KEY' })
  })

  it('deve retornar INVALID_API_KEY sem revelar se a chave existiu', async () => {
    vi.mocked(apiKeyRepo.findByPrefix).mockResolvedValue(null)

    const error = await useCase
      .execute({ strategy: 'API_KEY', rawKey: 'chave-inexistente-xxxxx' })
      .catch((e) => e)

    expect(error.code).toBe('INVALID_API_KEY')
    expect(error.message).not.toContain('não encontrada')
    expect(error.message).not.toContain('not found')
  })

  // ── Estratégia Slug público ───────────────────────────────────────────────

  it('deve resolver tenant corretamente a partir de slug público com domínio autorizado', async () => {
    vi.mocked(tenantRepo.findBySlug).mockResolvedValue(makeTenant())

    const result = await useCase.execute({
      strategy: 'PUBLIC_SLUG',
      slug: 'devolus',
      requestDomain: 'devolus.com',
    })

    expect(result.tenantId).toBe('tenant-1')
    expect(result.resolutionStrategy).toBe('PUBLIC_SLUG')
  })

  it('deve retornar TENANT_NOT_FOUND para slug inexistente', async () => {
    vi.mocked(tenantRepo.findBySlug).mockResolvedValue(null)

    await expect(
      useCase.execute({ strategy: 'PUBLIC_SLUG', slug: 'inexistente', requestDomain: 'x.com' })
    ).rejects.toMatchObject({ code: 'TENANT_NOT_FOUND' })
  })

  it('deve bloquear widget de domínio não autorizado', async () => {
    vi.mocked(tenantRepo.findBySlug).mockResolvedValue(makeTenant())

    await expect(
      useCase.execute({
        strategy: 'PUBLIC_SLUG',
        slug: 'devolus',
        requestDomain: 'site-nao-autorizado.com',
      })
    ).rejects.toMatchObject({ code: 'DOMAIN_NOT_AUTHORIZED' })
  })

  // ── Status do tenant (todas as estratégias) ───────────────────────────────

  it('deve retornar TENANT_INACTIVE para tenant com status INACTIVE', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(
      makeTenant({ status: TenantStatus.INACTIVE })
    )

    await expect(
      useCase.execute({ strategy: 'JWT', tenantId: 'tenant-1' })
    ).rejects.toMatchObject({ code: 'TENANT_INACTIVE' })
  })

  it('deve retornar TENANT_INACTIVE para tenant com status SUSPENDED', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(
      makeTenant({ status: TenantStatus.SUSPENDED })
    )

    await expect(
      useCase.execute({ strategy: 'JWT', tenantId: 'tenant-1' })
    ).rejects.toMatchObject({ code: 'TENANT_INACTIVE' })
  })

  // ── Audit log ─────────────────────────────────────────────────────────────

  it('deve registrar resolução bem-sucedida no audit log com a estratégia usada', async () => {
    vi.mocked(tenantRepo.findById).mockResolvedValue(makeTenant())

    await useCase.execute({ strategy: 'JWT', tenantId: 'tenant-1' })

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.context.resolved',
        metadata: expect.objectContaining({ strategy: 'JWT' }),
      })
    )
  })
})
