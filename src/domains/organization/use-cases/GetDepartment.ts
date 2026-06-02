import { AppError } from '@/shared/errors/AppError'
import type { Department } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'

export class GetDepartment {
  constructor(private repo: IDepartmentRepository) {}

  async execute(input: { id: string; tenantId: string }): Promise<Department> {
    const dept = await this.repo.findById(input.id, input.tenantId)
    if (!dept) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')
    return dept
  }
}
