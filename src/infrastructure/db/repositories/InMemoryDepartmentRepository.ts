import { randomUUID } from 'crypto'
import type { Department, CreateDepartmentData, UpdateDepartmentData } from '@/domains/organization/entities/Department'
import { DepartmentStatus } from '@/domains/organization/entities/Department'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'

const store = new Map<string, Department>()

export class InMemoryDepartmentRepository implements IDepartmentRepository {
  async create(data: CreateDepartmentData): Promise<Department> {
    const dept: Department = {
      id:          randomUUID(),
      tenantId:    data.tenantId,
      name:        data.name,
      slug:        data.slug,
      description: data.description ?? null,
      status:      DepartmentStatus.ACTIVE,
      createdAt:   new Date(),
      updatedAt:   new Date(),
    }
    store.set(dept.id, dept)
    return dept
  }

  async findById(id: string, tenantId: string): Promise<Department | null> {
    const dept = store.get(id)
    return dept?.tenantId === tenantId ? dept : null
  }

  async findByName(name: string, tenantId: string): Promise<Department | null> {
    return Array.from(store.values()).find(
      (d) => d.name === name && d.tenantId === tenantId,
    ) ?? null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Department | null> {
    return Array.from(store.values()).find(
      (d) => d.slug === slug && d.tenantId === tenantId,
    ) ?? null
  }

  async findAllByTenant(tenantId: string): Promise<Department[]> {
    return Array.from(store.values())
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department> {
    const dept = store.get(id)
    if (!dept || dept.tenantId !== tenantId) throw new Error('Not found')
    const updated: Department = { ...dept, ...data, updatedAt: new Date() }
    store.set(id, updated)
    return updated
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const dept = store.get(id)
    if (dept?.tenantId === tenantId) store.delete(id)
  }

  clear(): void { store.clear() }
}
