import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'

export class DeleteDepartment {
  constructor(
    private repo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: { id: string; tenantId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id, input.tenantId)
    if (!existing) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')

    await this.repo.delete(input.id, input.tenantId)

    await this.auditLogger.log({
      action: 'department.deleted', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'department',
      metadata: { name: existing.name },
    })
  }
}
