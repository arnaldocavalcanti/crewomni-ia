import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateDepartment } from '@/domains/organization/use-cases/CreateDepartment'
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

function makeInput(overrides = {}) {
  return { tenantId: 'tenant-1', name: 'Comercial', description: undefined, ...overrides }
}

function makeRepo(): IDepartmentRepository {
  return {
    create:           vi.fn().mockResolvedValue(makeDept()),
    findById:         vi.fn().mockResolvedValue(null),
    findByName:       vi.fn().mockResolvedValue(null),
    findBySlug:       vi.fn().mockResolvedValue(null),
    findAllByTenant:  vi.fn().mockResolvedValue([]),
    update:           vi.fn(),
    delete:           vi.fn(),
  }
}

function makeAudit(): IAuditLogger {
  return { log: vi.fn() }
}

describe('CreateDepartment', () => {
  let repo: IDepartmentRepository
  let audit: IAuditLogger
  let useCase: CreateDepartment

  beforeEach(() => {
    repo  = makeRepo()
    audit = makeAudit()
    useCase = new CreateDepartment(repo, audit)
  })

  it('cria department com dados válidos', async () => {
    const result = await useCase.execute(makeInput())
    expect(result.name).toBe('Comercial')
    expect(result.slug).toBe('comercial')
    expect(result.status).toBe(DepartmentStatus.ACTIVE)
    expect(repo.create).toHaveBeenCalledOnce()
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'department.created' }))
  })

  it('gera slug a partir do name com acentos', async () => {
    vi.mocked(repo.create).mockResolvedValue(makeDept({ name: 'Jurídico', slug: 'juridico' }))
    const result = await useCase.execute(makeInput({ name: 'Jurídico' }))
    expect(result.slug).toBe('juridico')
  })

  it('rejeita name duplicado no mesmo tenant', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(makeDept())
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'DEPARTMENT_NAME_TAKEN' })
  })

  it('aceita mesmo name em tenant diferente (isolamento)', async () => {
    vi.mocked(repo.findByName).mockImplementation(async (_, tenantId) =>
      tenantId === 'tenant-2' ? makeDept({ tenantId: 'tenant-2' }) : null,
    )
    await expect(useCase.execute(makeInput({ tenantId: 'tenant-1' }))).resolves.toBeDefined()
  })

  it('cria com description nula quando não fornecida', async () => {
    await useCase.execute(makeInput())
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
  })
})
