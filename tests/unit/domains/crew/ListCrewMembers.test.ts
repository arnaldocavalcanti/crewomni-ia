import { describe, it, expect, vi } from 'vitest'
import { ListCrewMembers } from '@/domains/crew/use-cases/ListCrewMembers'
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

describe('ListCrewMembers', () => {
  it('retorna membros ordenados por order', async () => {
    const crewRepo: ICrewRepository = {
      create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
      findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeCrew()),
    }
    const memberRepo: ICrewMemberRepository = {
      create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
      findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), delete: vi.fn(),
      findAllByCrew: vi.fn().mockResolvedValue([
        makeMember({ id: 'mem-2', order: 1 }),
        makeMember({ id: 'mem-1', order: 0 }),
      ]),
    }
    const result = await new ListCrewMembers(crewRepo, memberRepo).execute({ crewId: 'crew-1', tenantId: 'tenant-1' })
    expect(result).toHaveLength(2)
    expect(memberRepo.findAllByCrew).toHaveBeenCalledWith('crew-1', 'tenant-1')
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    const crewRepo: ICrewRepository = {
      create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
      findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    }
    const memberRepo: ICrewMemberRepository = {
      create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
      findAllByCrew: vi.fn(), findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), delete: vi.fn(),
    }
    await expect(new ListCrewMembers(crewRepo, memberRepo).execute({ crewId: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
