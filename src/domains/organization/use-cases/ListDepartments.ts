import type { Department } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'

export class ListDepartments {
  constructor(private repo: IDepartmentRepository) {}

  async execute(input: { tenantId: string }): Promise<Department[]> {
    return this.repo.findAllByTenant(input.tenantId)
  }
}
