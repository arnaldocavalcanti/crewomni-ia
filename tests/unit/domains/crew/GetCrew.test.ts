import { describe, it, expect, vi } from 'vitest'
import { GetCrew } from '@/domains/crew/use-cases/GetCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(overrides = {}) {
  return {
    id: 'mem-1', tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1',
    role: CrewMemberRole.MEMBER, order: 0, isRequired: true, createdAt: new Date(),
    ...overrides,
  }
}

function makeCrewRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
  }
}

function makeMemberRepo(members = [makeMember()]): ICrewMemberRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
    findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), delete: vi.fn(),
    findAllByCrew: vi.fn().mockResolvedValue(members),
  }
}

describe('GetCrew', () => {
  it('retorna crew com members', async () => {
    const result = await new GetCrew(makeCrewRepo(), makeMemberRepo()).execute({ id: 'crew-1', tenantId: 'tenant-1' })
    expect(result.crew.id).toBe('crew-1')
    expect(result.members).toHaveLength(1)
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    await expect(new GetCrew(makeCrewRepo(null), makeMemberRepo([])).execute({ id: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })

  it('lança CREW_NOT_FOUND para id inexistente', async () => {
    await expect(new GetCrew(makeCrewRepo(null), makeMemberRepo([])).execute({ id: 'nope', tenantId: 'tenant-1' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
