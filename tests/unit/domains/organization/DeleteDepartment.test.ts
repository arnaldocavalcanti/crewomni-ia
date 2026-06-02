import { describe, it, expect, vi } from 'vitest'
import { DeleteDepartment } from '@/domains/organization/use-cases/DeleteDepartment'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeDept()): IDepartmentRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(), update: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

describe('DeleteDepartment', () => {
  it('deleta department existente do mesmo tenant', async () => {
    const repo = makeRepo()
    const audit: IAuditLogger = { log: vi.fn() }
    const useCase = new DeleteDepartment(repo, audit)
    await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1' })
    expect(repo.delete).toHaveBeenCalledWith('dept-1', 'tenant-1')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'department.deleted' }))
  })

  it('lança DEPARTMENT_NOT_FOUND para department de outro tenant', async () => {
    const repo = makeRepo(null)
    const audit: IAuditLogger = { log: vi.fn() }
    const useCase = new DeleteDepartment(repo, audit)
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })
})
