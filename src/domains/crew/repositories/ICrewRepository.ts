import type { Crew, CreateCrewData, UpdateCrewData } from '../entities/Crew'

export interface ICrewRepository {
  create(data: CreateCrewData): Promise<Crew>
  findById(id: string, tenantId: string): Promise<Crew | null>
  findByName(name: string, tenantId: string): Promise<Crew | null>
  findBySlug(slug: string, tenantId: string): Promise<Crew | null>
  findAllByTenant(tenantId: string): Promise<Crew[]>
  findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]>
  update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew>
  delete(id: string, tenantId: string): Promise<void>
}
