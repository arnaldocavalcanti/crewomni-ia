import type { Department, CreateDepartmentData, UpdateDepartmentData } from '../entities/Department'

export interface IDepartmentRepository {
  create(data: CreateDepartmentData): Promise<Department>
  findById(id: string, tenantId: string): Promise<Department | null>
  findByName(name: string, tenantId: string): Promise<Department | null>
  findBySlug(slug: string, tenantId: string): Promise<Department | null>
  findAllByTenant(tenantId: string): Promise<Department[]>
  update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department>
  delete(id: string, tenantId: string): Promise<void>
}
