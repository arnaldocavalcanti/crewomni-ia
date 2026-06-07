import { createHash } from 'crypto'
import { describe, it, expect, vi } from 'vitest'
import { ResolveTenantContext } from '@/domains/tenant/use-cases/ResolveTenantContext'
import type { ITenantRepository } from '@/domains/tenant/repositories/ITenantRepository'
import type { IApiKeyRepository } from '@/domains/tenant/repositories/IApiKeyRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { TenantStatus, Niche } from '@/domains/tenant/entities/Tenant'

/**
 * Testes de isolamento multi-tenant.
 *
 * Garantem que nenhuma estratégia de resolução de tenant
 * retorna dados ou contexto de outro tenant.
 *
 * Critério da spec tenant-resolution.md — seção 13.
 */

const RAW_KEY_A = 'ahub_live_devo_secret'
const RAW_KEY_B = 'ahub_live_fast_secret'

function makeTenantRepo(tenants: Record<string, any>) {
  return {
    findById: vi.fn((id: string) => Promise.resolve(tenants[id] ?? null)),
    findBySlug: vi.fn((slug: string) =>
      Promise.resolve(Object.values(tenants).find((t: any) => t.slug === slug) ?? null)
    ),
    create: vi.fn(),
    updateStatus: vi.fn(), update: vi.fn(),
  } as ITenantRepository
}

function makeApiKeyRepo(keys: Record<string, any>) {
  return {
    findByPrefix: vi.fn((prefix: string) =>
      Promise.resolve(Object.values(keys).find((k: any) => k.keyPrefix === prefix) ?? null)
    ),
    create: vi.fn(),
    revoke: vi.fn(),
  } as IApiKeyRepository
}

const auditLogger: IAuditLogger = { log: vi.fn() }

const tenantA = {
  id: 'tenant-a',
  slug: 'devolus',
  name: 'Devolus',
  niche: Niche.REAL_ESTATE,
  status: TenantStatus.ACTIVE,
  allowedDomains: ['devolus.com'],
  plan: 'PRO',
}

const tenantB = {
  id: 'tenant-b',
  slug: 'fast4sign',
  name: 'Fast4Sign',
  niche: Niche.ESIGN,
  status: TenantStatus.ACTIVE,
  allowedDomains: ['fast4sign.com'],
  plan: 'PRO',
}

const apiKeyTenantA = {
  id: 'key-a',
  tenantId: 'tenant-a',
  keyPrefix: 'ahub_live_devo',
  keyHash: createHash('sha256').update(RAW_KEY_A).digest('hex'),
  status: 'ACTIVE' as const,
  expiresAt: null,
}

const apiKeyTenantB = {
  id: 'key-b',
  tenantId: 'tenant-b',
  keyPrefix: 'ahub_live_fast',
  keyHash: createHash('sha256').update(RAW_KEY_B).digest('hex'),
  status: 'ACTIVE' as const,
  expiresAt: null,
}

describe('Tenant Isolation — ResolveTenantContext', () => {
  const tenantRepo = makeTenantRepo({ 'tenant-a': tenantA, 'tenant-b': tenantB })
  const apiKeyRepo = makeApiKeyRepo({ 'key-a': apiKeyTenantA, 'key-b': apiKeyTenantB })
  const useCase = new ResolveTenantContext(tenantRepo, apiKeyRepo, auditLogger)

  // ── JWT: tenant A não pode se passar por tenant B ─────────────────────────

  it('JWT de tenant A deve resolver apenas tenant A, nunca tenant B', async () => {
    const resultA = await useCase.execute({ strategy: 'JWT', tenantId: 'tenant-a' })
    const resultB = await useCase.execute({ strategy: 'JWT', tenantId: 'tenant-b' })

    expect(resultA.tenantId).toBe('tenant-a')
    expect(resultB.tenantId).toBe('tenant-b')
    expect(resultA.tenantId).not.toBe(resultB.tenantId)
  })

  // ── API Key: chave de A não dá acesso a B ────────────────────────────────

  it('API key de tenant A deve resolver apenas tenant A', async () => {
    const result = await useCase.execute({ strategy: 'API_KEY', rawKey: RAW_KEY_A })

    expect(result.tenantId).toBe('tenant-a')
    expect(result.tenantId).not.toBe('tenant-b')
  })

  it('API key de tenant B deve resolver apenas tenant B', async () => {
    const result = await useCase.execute({ strategy: 'API_KEY', rawKey: RAW_KEY_B })

    expect(result.tenantId).toBe('tenant-b')
    expect(result.tenantId).not.toBe('tenant-a')
  })

  // ── Slug: domínio de A não carrega config de B ────────────────────────────

  it('slug de tenant A com domínio autorizado de A deve resolver apenas tenant A', async () => {
    const result = await useCase.execute({
      strategy: 'PUBLIC_SLUG',
      slug: 'devolus',
      requestDomain: 'devolus.com',
    })

    expect(result.tenantId).toBe('tenant-a')
    expect(result.tenant.slug).toBe('devolus')
  })

  it('domínio de tenant A não deve autorizar carregamento de widget de tenant B', async () => {
    await expect(
      useCase.execute({
        strategy: 'PUBLIC_SLUG',
        slug: 'fast4sign',
        requestDomain: 'devolus.com',
      })
    ).rejects.toMatchObject({ code: 'DOMAIN_NOT_AUTHORIZED' })
  })

  // ── Tenant suspenso não vaza dados através de resolução bem-sucedida ──────

  it('tenant suspenso deve falhar na resolução antes de expor qualquer dado', async () => {
    const suspendedRepo = makeTenantRepo({
      'tenant-suspended': { ...tenantA, id: 'tenant-suspended', status: TenantStatus.SUSPENDED },
    })
    const isolatedUseCase = new ResolveTenantContext(suspendedRepo, apiKeyRepo, auditLogger)

    await expect(
      isolatedUseCase.execute({ strategy: 'JWT', tenantId: 'tenant-suspended' })
    ).rejects.toMatchObject({ code: 'TENANT_INACTIVE' })
  })
})
