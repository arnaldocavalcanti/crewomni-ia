import type { IAuditLogger, AuditEvent } from '@/shared/types/IAuditLogger'

export class ConsoleAuditLogger implements IAuditLogger {
  log(event: AuditEvent): void {
    console.log(`[AUDIT] ${new Date().toISOString()} ${event.action}`, {
      tenantId: event.tenantId,
      userId: event.userId,
      resourceId: event.resourceId,
      metadata: event.metadata,
    })
  }
}
