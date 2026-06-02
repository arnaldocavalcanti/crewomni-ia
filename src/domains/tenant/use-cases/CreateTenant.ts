import { randomBytes } from 'crypto'
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IPasswordHasher } from '@/shared/types/IPasswordHasher'
import { TenantStatus, type Niche } from '../entities/Tenant'
import type { ITenantRepository } from '../repositories/ITenantRepository'
import type { IUserRepository } from '@/domains/auth/repositories/IUserRepository'
import { UserRole } from '@/domains/auth/entities/User'

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$|^[a-z0-9]{3}$/

type CreateTenantInput = {
  name: string
  slug: string
  niche: Niche
  ownerEmail: string
  ownerName: string
}

type CreateTenantOutput = {
  tenant: {
    id: string
    name: string
    slug: string
    niche: string
    status: string
    createdAt: string
  }
  owner: {
    id: string
    email: string
    temporaryPassword: string
  }
}

export class CreateTenant {
  constructor(
    private tenantRepo: ITenantRepository,
    private userRepo: IUserRepository,
    private auditLogger: IAuditLogger,
    private passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: CreateTenantInput): Promise<CreateTenantOutput> {
    this.validateSlug(input.slug)
    this.validateName(input.name)

    const existing = await this.tenantRepo.findBySlug(input.slug)
    if (existing) throw new AppError('SLUG_ALREADY_TAKEN', 'Slug já está em uso')

    const tenant = await this.tenantRepo.create({
      name: input.name,
      slug: input.slug,
      niche: input.niche,
      status: TenantStatus.ACTIVE,
      allowedDomains: [],
      plan: 'FREE',
    })

    const temporaryPassword = randomBytes(12).toString('base64url')
    const passwordHash = await this.passwordHasher.hash(temporaryPassword)

    const owner = await this.userRepo.create({
      tenantId: tenant.id,
      email: input.ownerEmail,
      name: input.ownerName,
      passwordHash,
      role: UserRole.TENANT_ADMIN,
      status: 'ACTIVE',
    })

    await this.auditLogger.log({
      action: 'tenant.created',
      tenantId: tenant.id,
      metadata: { slug: tenant.slug, ownerEmail: input.ownerEmail },
    })

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        niche: tenant.niche,
        status: tenant.status,
        createdAt: (tenant.createdAt ?? new Date()).toISOString(),
      },
      owner: {
        id: owner.id,
        email: owner.email,
        temporaryPassword,
      },
    }
  }

  private validateSlug(slug: string): void {
    if (slug.length < 3 || slug.length > 32) {
      throw new AppError('VALIDATION_ERROR', 'Slug deve ter entre 3 e 32 caracteres')
    }
    if (!SLUG_REGEX.test(slug)) {
      throw new AppError('VALIDATION_ERROR', 'Slug deve conter apenas letras minúsculas, números e hífens')
    }
  }

  private validateName(name: string): void {
    if (name.length < 3 || name.length > 100) {
      throw new AppError('VALIDATION_ERROR', 'Nome deve ter entre 3 e 100 caracteres')
    }
  }
}
