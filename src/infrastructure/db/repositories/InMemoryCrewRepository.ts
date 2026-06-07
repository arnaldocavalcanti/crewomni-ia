import { randomUUID } from 'crypto'
import type { Crew, CreateCrewData, UpdateCrewData } from '@/domains/crew/entities/Crew'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'

const store = new Map<string, Crew>()

export class InMemoryCrewRepository implements ICrewRepository {
  async create(data: CreateCrewData): Promise<Crew> {
    const crew: Crew = {
      id:           randomUUID(),
      tenantId:     data.tenantId,
      departmentId: data.departmentId,
      name:         data.name,
      slug:         data.slug,
      description:  data.description ?? null,
      objective:    data.objective ?? null,
      status:       CrewStatus.DRAFT,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    }
    store.set(crew.id, crew)
    return crew
  }

  async findById(id: string, tenantId: string): Promise<Crew | null> {
    const crew = store.get(id)
    return crew?.tenantId === tenantId ? crew : null
  }

  async findByName(name: string, tenantId: string): Promise<Crew | null> {
    return Array.from(store.values()).find(
      (c) => c.name === name && c.tenantId === tenantId,
    ) ?? null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Crew | null> {
    return Array.from(store.values()).find(
      (c) => c.slug === slug && c.tenantId === tenantId,
    ) ?? null
  }

  async findAllByTenant(tenantId: string): Promise<Crew[]> {
    return Array.from(store.values())
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]> {
    return Array.from(store.values())
      .filter((c) => c.departmentId === departmentId && c.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew> {
    const crew = store.get(id)
    if (!crew || crew.tenantId !== tenantId) throw new Error('Not found')
    const updated: Crew = { ...crew, ...data, updatedAt: new Date() }
    store.set(id, updated)
    return updated
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const crew = store.get(id)
    if (crew?.tenantId === tenantId) store.delete(id)
  }

  clear(): void { store.clear() }
}
