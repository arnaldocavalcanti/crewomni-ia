import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateDepartment } from '@/domains/organization/use-cases/UpdateDepartment'
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
    create: vi.fn(), findBySlug: vi.fn().mockResolvedValue(null),
    findAllByTenant: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    findByName: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockImplementation(async (_id, _tenantId, data) => ({ ...found, ...data, updatedAt: new Date() })),
    delete: vi.fn(),
  }
}

describe('UpdateDepartment', () => {
  let repo: IDepartmentRepository
  let audit: IAuditLogger
  let useCase: UpdateDepartment

  beforeEach(() => {
    repo  = makeRepo()
    audit = { log: vi.fn() }
    useCase = new UpdateDepartment(repo, audit)
  })

  it('atualiza name e regenera slug', async () => {
    await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1', name: 'Jurídico' })
    expect(repo.update).toHaveBeenCalledWith('dept-1', 'tenant-1', expect.objectContaining({ name: 'Jurídico', slug: 'juridico' }))
  })

  it('inativa department', async () => {
    await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1', status: DepartmentStatus.INACTIVE })
    expect(repo.update).toHaveBeenCalledWith('dept-1', 'tenant-1', expect.objectContaining({ status: DepartmentStatus.INACTIVE }))
  })

  it('lança DEPARTMENT_NOT_FOUND para department de outro tenant', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null)
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })

  it('lança DEPARTMENT_NAME_TAKEN se novo name já existe no tenant', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(makeDept({ id: 'dept-2', name: 'Suporte' }))
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-1', name: 'Suporte' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NAME_TAKEN' })
  })
})
