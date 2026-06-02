export type RefreshToken = {
  id: string
  userId: string
  tenantId: string | null
  tokenHash: string
  family: string
  expiresAt: Date
  revokedAt: Date | null
}

export type CreateRefreshTokenData = {
  userId: string
  tenantId: string | null
  family: string
  expiresAt: Date
}
