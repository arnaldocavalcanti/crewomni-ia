import { randomUUID } from 'crypto'
import type { User, CreateUserData } from '@/domains/auth/entities/User'
import type { IUserRepository } from '@/domains/auth/repositories/IUserRepository'
import { users, tenants } from './store'

export class InMemoryUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = Array.from(users.values()).find((u) => u.email === email) ?? null
    if (!user) return null
    return this.withTenant(user)
  }

  async findById(id: string): Promise<User | null> {
    const user = users.get(id) ?? null
    if (!user) return null
    return this.withTenant(user)
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    const user = users.get(userId)
    if (user) users.set(userId, { ...user, failedAttempts: user.failedAttempts + 1 })
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    const user = users.get(userId)
    if (user) users.set(userId, { ...user, failedAttempts: 0, lockedUntil: null })
  }

  async lockUntil(userId: string, until: Date): Promise<void> {
    const user = users.get(userId)
    if (user) users.set(userId, { ...user, lockedUntil: until })
  }

  async create(data: CreateUserData): Promise<User> {
    const user: User = {
      id: randomUUID(),
      tenantId: data.tenantId,
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role,
      status: data.status ?? 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      tenant: null,
    }
    users.set(user.id, user)
    return user
  }

  private withTenant(user: User): User {
    if (!user.tenantId) return user
    const tenant = tenants.get(user.tenantId)
    return {
      ...user,
      tenant: tenant ? { id: tenant.id, slug: tenant.slug, status: tenant.status } : null,
    }
  }
}
