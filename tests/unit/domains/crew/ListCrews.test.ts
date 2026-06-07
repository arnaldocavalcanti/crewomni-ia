import { describe, it, expect, vi } from 'vitest'
import { ListCrews } from '@/domains/crew/use-cases/ListCrews'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(crews = [makeCrew()]): ICrewRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findAllByTenant:     vi.fn().mockResolvedValue(crews),
    findAllByDepartment: vi.fn().mockResolvedValue(crews.filter(c => c.departmentId === 'dept-1')),
  }
}

describe('ListCrews', () => {
  it('lista crews do tenant', async () => {
    const repo = makeRepo([makeCrew(), makeCrew({ id: 'crew-2', name: 'Suporte IA', slug: 'suporte-ia' })])
    const result = await new ListCrews(repo).execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(2)
    expect(repo.findAllByTenant).toHaveBeenCalledWith('tenant-1')
  })

  it('filtra por departmentId quando fornecido', async () => {
    const repo = makeRepo()
    await new ListCrews(repo).execute({ tenantId: 'tenant-1', departmentId: 'dept-1' })
    expect(repo.findAllByDepartment).toHaveBeenCalledWith('dept-1', 'tenant-1')
  })

  it('retorna lista vazia', async () => {
    const repo = makeRepo([])
    const result = await new ListCrews(repo).execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(0)
  })
})
