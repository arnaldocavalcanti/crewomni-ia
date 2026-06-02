import { jwtVerify } from 'jose'
import { AppError } from '@/shared/errors/AppError'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/domains/auth/entities/User'

export type Session = {
  userId: string
  tenantId: string | null
  role: UserRole
  isPlatformAdmin: boolean
}

const jwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-production')

export async function getSession(request: NextRequest): Promise<Session> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Token não fornecido')
  }

  const token = authHeader.slice(7)

  const { payload } = await jwtVerify(token, jwtSecret()).catch(() => {
    throw new AppError('TOKEN_EXPIRED', 'Token inválido ou expirado')
  })

  return {
    userId: payload.userId as string,
    tenantId: (payload.tenantId as string | null) ?? null,
    role: payload.role as UserRole,
    isPlatformAdmin: payload.role === 'PLATFORM_ADMIN',
  }
}

export async function requirePlatformAdmin(request: NextRequest): Promise<Session> {
  const session = await getSession(request)
  if (!session.isPlatformAdmin) {
    throw new AppError('FORBIDDEN', 'Acesso restrito a administradores da plataforma')
  }
  return session
}
