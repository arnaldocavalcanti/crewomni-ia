import type { IAuditLogger, AuditEvent } from '@/shared/types/IAuditLogger'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaAuditLogger implements IAuditLogger {
  async log(event: AuditEvent): Promise<void> {
    try {
      const prisma = getPrismaClient()
      await prisma.auditLog.create({
        data: {
          tenantId: event.tenantId ?? null,
          userId: event.userId ?? null,
          action: event.action,
          resourceId: event.resourceId ?? null,
          resourceType: event.resourceType ?? null,
          metadata: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : undefined,
          ip: event.ip ?? null,
        },
      })
    } catch {
      // Audit log failure must never crash the main flow
      console.error('[AUDIT ERROR]', event.action)
    }
  }
}
