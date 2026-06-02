export type AuditEvent = {
  tenantId?: string
  userId?: string | null
  action: string
  resourceId?: string
  resourceType?: string
  metadata?: Record<string, unknown>
  ip?: string
  timestamp?: Date
}

export interface IAuditLogger {
  log(event: AuditEvent): Promise<void> | void
}
