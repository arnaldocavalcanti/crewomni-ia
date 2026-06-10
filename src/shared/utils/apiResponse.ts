import { AppError } from '@/shared/errors/AppError'

const ERROR_STATUS: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  SESSION_EXPIRED: 401,
  STALE_SESSION: 401,    // tenantId in JWT no longer valid in DB → force re-login
  UNAUTHORIZED: 401,
  INVALID_API_KEY: 401,
  ACCOUNT_LOCKED: 403,
  ACCOUNT_INACTIVE: 403,
  TENANT_INACTIVE: 403,
  DOMAIN_NOT_AUTHORIZED: 403,
  FORBIDDEN: 403,
  TENANT_NOT_FOUND: 404,
  AGENT_NOT_FOUND: 404,
  CONVERSATION_NOT_FOUND: 404,
  DOCUMENT_NOT_FOUND: 404,
  DEPARTMENT_NOT_FOUND: 404,
  DEPARTMENT_NAME_TAKEN: 409,
  CREW_NOT_FOUND:             404,
  CREW_MEMBER_NOT_FOUND:      404,
  CREW_NAME_TAKEN:            409,
  CREW_ALREADY_HAS_DIRECTOR:  409,
  AGENT_ALREADY_IN_CREW:      409,
  CREW_HAS_MEMBERS:           422,
  CREW_HAS_NO_MEMBERS:             400,
  WHATSAPP_CHANNEL_NOT_CONFIGURED: 400,
  SLUG_ALREADY_TAKEN: 409,
  AGENT_NOT_ACTIVE: 422,
  CONVERSATION_CLOSED: 422,
  CHUNK_LIMIT_REACHED: 422,
  VALIDATION_ERROR: 422,
  LLM_PROVIDER_ERROR: 502,
  EMBEDDING_ERROR: 502,
  EMBEDDING_FAILED: 502,
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { code: error.code, message: error.message },
      { status: ERROR_STATUS[error.code] ?? 400 },
    )
  }
  console.error('[Internal Error]', error)
  return Response.json(
    { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export function refreshTokenCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `refreshToken=${token}; HttpOnly${secure}; SameSite=Lax; Path=/api/v1/auth; Max-Age=${maxAge}`
}

export function clearRefreshTokenCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `refreshToken=; HttpOnly${secure}; SameSite=Lax; Path=/api/v1/auth; Max-Age=0`
}
