import { createHash } from 'crypto'
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { API_KEY_PREFIX_LENGTH } from '@/shared/constants'
import { TenantStatus } from '../entities/Tenant'
import type { Tenant } from '../entities/Tenant'
import type { ITenantRepository } from '../repositories/ITenantRepository'
import type { IApiKeyRepository } from '../repositories/IApiKeyRepository'

type ResolveInput =
  | { strategy: 'JWT'; tenantId: string }
  | { strategy: 'API_KEY'; rawKey: string }
  | { strategy: 'PUBLIC_SLUG'; slug: string; requestDomain: string }

export type TenantContext = {
  tenantId: string
  tenant: Tenant
  resolutionStrategy: 'JWT' | 'API_KEY' | 'PUBLIC_SLUG'
  userId?: string
  role?: string
  apiKeyId?: string
}

export class ResolveTenantContext {
  constructor(
    private tenantRepo: ITenantRepository,
    private apiKeyRepo: IApiKeyRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: ResolveInput): Promise<TenantContext> {
    const context = await this.resolve(input)

    await this.auditLogger.log({
      action: 'tenant.context.resolved',
      tenantId: context.tenantId,
      metadata: { strategy: input.strategy },
    })

    return context
  }

  private async resolve(input: ResolveInput): Promise<TenantContext> {
    if (input.strategy === 'JWT') {
      return this.resolveFromJwt(input.tenantId)
    }
    if (input.strategy === 'API_KEY') {
      return this.resolveFromApiKey(input.rawKey)
    }
    return this.resolveFromSlug(input.slug, input.requestDomain)
  }

  private async resolveFromJwt(tenantId: string): Promise<TenantContext> {
    const tenant = await this.tenantRepo.findById(tenantId)

    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 'Tenant não encontrado')

    this.assertActive(tenant)

    return { tenantId: tenant.id, tenant, resolutionStrategy: 'JWT' }
  }

  private async resolveFromApiKey(rawKey: string): Promise<TenantContext> {
    const prefix = rawKey.substring(0, API_KEY_PREFIX_LENGTH)
    const apiKey = await this.apiKeyRepo.findByPrefix(prefix)

    if (!apiKey) throw new AppError('INVALID_API_KEY', 'API key inválida')
    if (apiKey.status === 'REVOKED') throw new AppError('INVALID_API_KEY', 'API key inválida')
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new AppError('INVALID_API_KEY', 'API key inválida')
    }

    const rawKeyHash = createHash('sha256').update(rawKey).digest('hex')
    if (rawKeyHash !== apiKey.keyHash) {
      throw new AppError('INVALID_API_KEY', 'API key inválida')
    }

    const tenant = await this.tenantRepo.findById(apiKey.tenantId)
    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 'Tenant não encontrado')

    this.assertActive(tenant)

    return { tenantId: tenant.id, tenant, resolutionStrategy: 'API_KEY', apiKeyId: apiKey.id }
  }

  private async resolveFromSlug(slug: string, requestDomain: string): Promise<TenantContext> {
    const tenant = await this.tenantRepo.findBySlug(slug)

    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 'Tenant não encontrado')

    if (!tenant.allowedDomains.includes(requestDomain)) {
      throw new AppError('DOMAIN_NOT_AUTHORIZED', 'Domínio não autorizado')
    }

    this.assertActive(tenant)

    return { tenantId: tenant.id, tenant, resolutionStrategy: 'PUBLIC_SLUG' }
  }

  private assertActive(tenant: Tenant): void {
    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new AppError('TENANT_INACTIVE', 'Tenant inativo ou suspenso')
    }
  }
}
