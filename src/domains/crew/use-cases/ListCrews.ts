import type { Crew } from '../entities/Crew'
import type { ICrewRepository } from '../repositories/ICrewRepository'

export class ListCrews {
  constructor(private repo: ICrewRepository) {}

  async execute(input: { tenantId: string; departmentId?: string }): Promise<Crew[]> {
    if (input.departmentId) {
      return this.repo.findAllByDepartment(input.departmentId, input.tenantId)
    }
    return this.repo.findAllByTenant(input.tenantId)
  }
}
