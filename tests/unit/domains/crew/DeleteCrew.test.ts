import { describe, it, expect, vi } from 'vitest'
import { DeleteCrew } from '@/domains/crew/use-cases/DeleteCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
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

function makeCrewRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(), update: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    delete:   vi.fn().mockResolvedValue(undefined),
  }
}

function makeMemberRepo(count = 0): ICrewMemberRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
    findAllByCrew: vi.fn(), findDirector: vi.fn(), countDirectors: vi.fn(), delete: vi.fn(),
    countByCrew: vi.fn().mockResolvedValue(count),
  }
}

describe('DeleteCrew', () => {
  it('deleta crew sem membros', async () => {
    const audit: IAuditLogger = { log: vi.fn() }
    await new DeleteCrew(makeCrewRepo(), makeMemberRepo(0), audit).execute({ id: 'crew-1', tenantId: 'tenant-1' })
    expect(makeCrewRepo().delete).toBeDefined()
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.deleted' }))
  })

  it('rejeita deletar crew com membros', async () => {
    const audit: IAuditLogger = { log: vi.fn() }
    await expect(new DeleteCrew(makeCrewRepo(), makeMemberRepo(2), audit).execute({ id: 'crew-1', tenantId: 'tenant-1' }))
      .rejects.toMatchObject({ code: 'CREW_HAS_MEMBERS' })
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    const audit: IAuditLogger = { log: vi.fn() }
    await expect(new DeleteCrew(makeCrewRepo(null), makeMemberRepo(0), audit).execute({ id: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
