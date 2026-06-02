import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateCrew } from '@/domains/crew/use-cases/UpdateCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findAllByTenant: vi.fn(), findAllByDepartment: vi.fn(), delete: vi.fn(),
    findById:   vi.fn().mockResolvedValue(found),
    findByName: vi.fn().mockResolvedValue(null),
    update:     vi.fn().mockImplementation(async (_id, _t, data) => ({ ...found, ...data, updatedAt: new Date() })),
  }
}

describe('UpdateCrew', () => {
  let repo: ICrewRepository
  let audit: IAuditLogger
  let useCase: UpdateCrew

  beforeEach(() => {
    repo  = makeRepo()
    audit = { log: vi.fn() }
    useCase = new UpdateCrew(repo, audit)
  })

  it('atualiza name e regenera slug', async () => {
    await useCase.execute({ id: 'crew-1', tenantId: 'tenant-1', name: 'Jurídico IA' })
    expect(repo.update).toHaveBeenCalledWith('crew-1', 'tenant-1',
      expect.objectContaining({ name: 'Jurídico IA', slug: 'juridico-ia' }))
  })

  it('atualiza status para ACTIVE', async () => {
    await useCase.execute({ id: 'crew-1', tenantId: 'tenant-1', status: CrewStatus.ACTIVE })
    expect(repo.update).toHaveBeenCalledWith('crew-1', 'tenant-1',
      expect.objectContaining({ status: CrewStatus.ACTIVE }))
  })

  it('lança CREW_NAME_TAKEN se novo name já existe no tenant', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(makeCrew({ id: 'crew-2' }))
    await expect(useCase.execute({ id: 'crew-1', tenantId: 'tenant-1', name: 'Suporte IA' }))
      .rejects.toMatchObject({ code: 'CREW_NAME_TAKEN' })
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null)
    await expect(useCase.execute({ id: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
