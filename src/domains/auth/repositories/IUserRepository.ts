import type { User, CreateUserData } from '../entities/User'

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  incrementFailedAttempts(userId: string): Promise<void>
  resetFailedAttempts(userId: string): Promise<void>
  lockUntil(userId: string, until: Date): Promise<void>
  create(data: CreateUserData): Promise<User>
}
