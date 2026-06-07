import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateCrew } from '@/domains/crew/use-cases/CreateCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return { tenantId: 'tenant-1', departmentId: 'dept-1', name: 'Comercial IA', ...overrides }
}

function makeCrewRepo(): ICrewRepository {
  return {
    create:               vi.fn().mockResolvedValue(makeCrew()),
    findById:             vi.fn().mockResolvedValue(null),
    findByName:           vi.fn().mockResolvedValue(null),
    findBySlug:           vi.fn().mockResolvedValue(null),
    findAllByTenant:      vi.fn().mockResolvedValue([]),
    findAllByDepartment:  vi.fn().mockResolvedValue([]),
    update:               vi.fn(),
    delete:               vi.fn(),
  }
}

function makeDeptRepo(found: any = makeDept()): IDepartmentRepository {
  return {
    create: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findById:   vi.fn().mockResolvedValue(found),
    findByName: vi.fn().mockResolvedValue(null),
  }
}

describe('CreateCrew', () => {
  let crewRepo: ICrewRepository
  let deptRepo: IDepartmentRepository
  let audit: IAuditLogger
  let useCase: CreateCrew

  beforeEach(() => {
    crewRepo = makeCrewRepo()
    deptRepo = makeDeptRepo()
    audit    = { log: vi.fn() }
    useCase  = new CreateCrew(crewRepo, deptRepo, audit)
  })

  it('cria crew com dados válidos', async () => {
    const result = await useCase.execute(makeInput())
    expect(result.name).toBe('Comercial IA')
    expect(result.slug).toBe('comercial-ia')
    expect(result.status).toBe(CrewStatus.DRAFT)
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.created' }))
  })

  it('gera slug do name com acentos', async () => {
    vi.mocked(crewRepo.create).mockResolvedValue(makeCrew({ name: 'Jurídico IA', slug: 'juridico-ia' }))
    const result = await useCase.execute(makeInput({ name: 'Jurídico IA' }))
    expect(result.slug).toBe('juridico-ia')
  })

  it('rejeita name duplicado no tenant', async () => {
    vi.mocked(crewRepo.findByName).mockResolvedValue(makeCrew())
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'CREW_NAME_TAKEN' })
  })

  it('rejeita departmentId de outro tenant', async () => {
    vi.mocked(deptRepo.findById).mockResolvedValue(null)
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })

  it('aceita mesmo name em tenant diferente', async () => {
    vi.mocked(crewRepo.findByName).mockImplementation(async (_name, tenantId) =>
      tenantId === 'tenant-2' ? makeCrew({ tenantId: 'tenant-2' }) : null,
    )
    await expect(useCase.execute(makeInput({ tenantId: 'tenant-1' }))).resolves.toBeDefined()
  })
})
