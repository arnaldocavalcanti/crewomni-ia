import type { RefreshToken, CreateRefreshTokenData } from '../entities/RefreshToken'

export interface IRefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<{ id: string; token: string }>
  findByHash(tokenHash: string): Promise<RefreshToken | null>
  revokeById(id: string): Promise<void>
  revokeByFamily(family: string): Promise<void>
  revokeAllByUserId(userId: string): Promise<void>
}
