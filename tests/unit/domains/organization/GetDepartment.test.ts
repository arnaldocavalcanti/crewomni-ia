import { describe, it, expect, vi } from 'vitest'
import { GetDepartment } from '@/domains/organization/use-cases/GetDepartment'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(result: any = null): IDepartmentRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(),
    findById: vi.fn().mockResolvedValue(result),
    update: vi.fn(), delete: vi.fn(),
  }
}

describe('GetDepartment', () => {
  it('retorna department existente do mesmo tenant', async () => {
    const repo = makeRepo(makeDept())
    const useCase = new GetDepartment(repo)
    const result = await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1' })
    expect(result.id).toBe('dept-1')
  })

  it('lança DEPARTMENT_NOT_FOUND para id de outro tenant', async () => {
    const repo = makeRepo(null)
    const useCase = new GetDepartment(repo)
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })

  it('lança DEPARTMENT_NOT_FOUND para id inexistente', async () => {
    const repo = makeRepo(null)
    const useCase = new GetDepartment(repo)
    await expect(useCase.execute({ id: 'nope', tenantId: 'tenant-1' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })
})
