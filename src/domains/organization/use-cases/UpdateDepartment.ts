import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Department, DepartmentStatus, UpdateDepartmentData } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'
import { generateSlug } from '../utils/generateSlug'

type Input = {
  id:           string
  tenantId:     string
  name?:        string
  description?: string
  status?:      DepartmentStatus
}

export class UpdateDepartment {
  constructor(
    private repo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Department> {
    const existing = await this.repo.findById(input.id, input.tenantId)
    if (!existing) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')

    const updateData: UpdateDepartmentData = {}

    if (input.name !== undefined) {
      const byName = await this.repo.findByName(input.name, input.tenantId)
      if (byName && byName.id !== input.id) throw new AppError('DEPARTMENT_NAME_TAKEN', 'Já existe um departamento com este nome')
      updateData.name = input.name
      updateData.slug = generateSlug(input.name)
    }

    if (input.description !== undefined) updateData.description = input.description
    if (input.status !== undefined) updateData.status = input.status

    const updated = await this.repo.update(input.id, input.tenantId, updateData)

    await this.auditLogger.log({
      action: 'department.updated', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'department', metadata: updateData as Record<string, unknown>,
    })

    return updated
  }
}
