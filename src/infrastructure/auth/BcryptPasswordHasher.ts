import bcrypt from 'bcryptjs'
import type { IPasswordHasher } from '@/shared/types/IPasswordHasher'

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly rounds: number

  constructor(rounds = 12) {
    this.rounds = rounds
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds)
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed)
  }
}
