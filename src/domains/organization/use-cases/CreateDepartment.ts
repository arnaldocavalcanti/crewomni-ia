import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Department } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'
import { generateSlug } from '../utils/generateSlug'

type Input = {
  tenantId:     string
  name:         string
  description?: string
}

export class CreateDepartment {
  constructor(
    private repo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Department> {
    const slug = generateSlug(input.name)

    const existing = await this.repo.findByName(input.name, input.tenantId)
    if (existing) throw new AppError('DEPARTMENT_NAME_TAKEN', 'Já existe um departamento com este nome')

    const dept = await this.repo.create({
      tenantId:    input.tenantId,
      name:        input.name,
      slug,
      description: input.description,
    })

    await this.auditLogger.log({
      action:       'department.created',
      tenantId:     input.tenantId,
      resourceId:   dept.id,
      resourceType: 'department',
      metadata:     { name: dept.name },
    })

    return dept
  }
}
