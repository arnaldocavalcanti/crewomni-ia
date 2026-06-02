import { randomUUID } from 'crypto'
import type { User, CreateUserData } from '@/domains/auth/entities/User'
import { UserRole, type UserStatus } from '@/domains/auth/entities/User'
import type { IUserRepository } from '@/domains/auth/repositories/IUserRepository'
import type { TenantStatus } from '@/domains/tenant/entities/Tenant'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaUserRepository implements IUserRepository {
  private get db() {
    return getPrismaClient()
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.db.user.findUnique({
      where: { email },
      include: { tenant: { select: { id: true, slug: true, status: true } } },
    })
    return record ? this.toEntity(record) : null
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.db.user.findUnique({
      where: { id },
      include: { tenant: { select: { id: true, slug: true, status: true } } },
    })
    return record ? this.toEntity(record) : null
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
    })
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedUntil: null },
    })
  }

  async lockUntil(userId: string, until: Date): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { lockedUntil: until },
    })
  }

  async create(data: CreateUserData): Promise<User> {
    const record = await this.db.user.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role,
        status: data.status ?? 'ACTIVE',
      },
      include: { tenant: { select: { id: true, slug: true, status: true } } },
    })
    return this.toEntity(record)
  }

  private toEntity(record: any): User {
    return {
      id: record.id,
      tenantId: record.tenantId,
      email: record.email,
      name: record.name,
      passwordHash: record.passwordHash,
      role: record.role as UserRole,
      status: record.status as UserStatus,
      failedAttempts: record.failedAttempts,
      lockedUntil: record.lockedUntil,
      tenant: record.tenant
        ? { id: record.tenant.id, slug: record.tenant.slug, status: record.tenant.status as TenantStatus }
        : null,
    }
  }
}
