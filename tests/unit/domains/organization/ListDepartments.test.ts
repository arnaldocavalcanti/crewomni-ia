import { describe, it, expect, vi } from 'vitest'
import { ListDepartments } from '@/domains/organization/use-cases/ListDepartments'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(depts = [makeDept()]): IDepartmentRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(),
    findAllByTenant: vi.fn().mockResolvedValue(depts),
    update: vi.fn(), delete: vi.fn(),
  }
}

describe('ListDepartments', () => {
  it('retorna todos os departments do tenant', async () => {
    const repo = makeRepo([makeDept(), makeDept({ id: 'dept-2', name: 'Suporte', slug: 'suporte' })])
    const useCase = new ListDepartments(repo)
    const result = await useCase.execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(2)
    expect(repo.findAllByTenant).toHaveBeenCalledWith('tenant-1')
  })

  it('retorna lista vazia se tenant sem departments', async () => {
    const repo = makeRepo([])
    const useCase = new ListDepartments(repo)
    const result = await useCase.execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(0)
  })
})
