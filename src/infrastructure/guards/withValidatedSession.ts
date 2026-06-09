/**
 * Infrastructure-level session guard.
 *
 * This extends the shared `getSession` guard with a critical extra check:
 * it verifies that the tenantId embedded in the JWT **actually exists** in the
 * database. This prevents the data-loss scenario where a stale JWT (from an
 * old in-memory session) carries a phantom tenantId and silently writes data
 * to the wrong tenant bucket.
 *
 * Returns 401 (not 403) so the frontend api.ts refresh-token logic fires and
 * clears the invalid token from localStorage, forcing a clean re-login.
 */

import type { NextRequest } from 'next/server'
import { getSession, type Session } from '@/shared/guards/withSession'
import { AppError } from '@/shared/errors/AppError'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

// Simple in-process LRU to avoid a DB round-trip on every request.
// Entries expire after 60 seconds so changes in tenant status are reflected quickly.
const CACHE_TTL_MS = 60_000
const tenantCache = new Map<string, { valid: boolean; expiresAt: number }>()

async function isTenantValid(tenantId: string): Promise<boolean> {
  const now = Date.now()
  const cached = tenantCache.get(tenantId)
  if (cached && cached.expiresAt > now) return cached.valid

  let valid = false
  try {
    // Skip DB check in test environments — in-memory repos are fine there
    if (process.env.VITEST || process.env.ALLOW_INMEMORY === 'true') {
      valid = true
    } else {
      const db = getPrismaClient()
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, status: true },
      })
      valid = !!tenant && tenant.status === 'ACTIVE'
    }
  } catch {
    // DB connection error — fail open to avoid blocking all requests during
    // a temporary DB outage, but DO NOT cache the result
    return true
  }

  tenantCache.set(tenantId, { valid, expiresAt: now + CACHE_TTL_MS })
  return valid
}

/**
 * Validates JWT **and** confirms tenantId exists in the database.
 *
 * Throws `STALE_SESSION` (mapped to 401) if the tenant is not found or inactive,
 * so the frontend clears the stale token and the user is prompted to log in again.
 */
export async function getValidatedSession(
  request: NextRequest,
  requireTenant = true,
): Promise<Session> {
  const session = await getSession(request, requireTenant)

  if (session.tenantId && !session.isPlatformAdmin) {
    const valid = await isTenantValid(session.tenantId)
    if (!valid) {
      // Invalidate cache entry so next request re-checks
      tenantCache.delete(session.tenantId)
      throw new AppError(
        'STALE_SESSION',
        'Sessão inválida — o tenant associado não existe ou está inativo. Faça login novamente.',
      )
    }
  }

  return session
}
