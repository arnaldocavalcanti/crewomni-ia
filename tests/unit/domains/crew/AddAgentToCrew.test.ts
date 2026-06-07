import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddAgentToCrew } from '@/domains/crew/use-cases/AddAgentToCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1', tenantId: 'tenant-1', name: 'SDR', slug: 'sdr',
    type: AgentType.SDR, description: null, status: AgentStatus.ACTIVE,
    createdAt: new Date(), updatedAt: new Date(),
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

function makeInput(overrides = {}) {
  return { tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1', role: CrewMemberRole.MEMBER, order: 0, ...overrides }
}

function makeCrewRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
  }
}

function makeMemberRepo(overrides: Partial<ICrewMemberRepository> = {}): ICrewMemberRepository {
  return {
    findById: vi.fn(), findAllByCrew: vi.fn(), findDirector: vi.fn(), delete: vi.fn(),
    create:             vi.fn().mockResolvedValue(makeMember()),
    findByCrewAndAgent: vi.fn().mockResolvedValue(null),
    countDirectors:     vi.fn().mockResolvedValue(0),
    countByCrew:        vi.fn().mockResolvedValue(0),
    ...overrides,
  }
}

function makeAgentRepo(found: any = makeAgent()): IAgentRepository {
  return {
    findBySlug: vi.fn(), findByName: vi.fn(), countActive: vi.fn(),
    listByTenant: vi.fn(), create: vi.fn(), updateStatus: vi.fn(), update: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
  }
}

describe('AddAgentToCrew', () => {
  let crewRepo:   ICrewRepository
  let memberRepo: ICrewMemberRepository
  let agentRepo:  IAgentRepository
  let audit:      IAuditLogger
  let useCase:    AddAgentToCrew

  beforeEach(() => {
    crewRepo   = makeCrewRepo()
    memberRepo = makeMemberRepo()
    agentRepo  = makeAgentRepo()
    audit      = { log: vi.fn() }
    useCase    = new AddAgentToCrew(crewRepo, memberRepo, agentRepo, audit)
  })

  it('adiciona agent como MEMBER', async () => {
    const result = await useCase.execute(makeInput())
    expect(result.role).toBe(CrewMemberRole.MEMBER)
    expect(memberRepo.create).toHaveBeenCalledOnce()
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.member_added' }))
  })

  it('adiciona agent como DIRECTOR quando não há director', async () => {
    vi.mocked(memberRepo.create).mockResolvedValue(makeMember({ role: CrewMemberRole.DIRECTOR }))
    const result = await useCase.execute(makeInput({ role: CrewMemberRole.DIRECTOR }))
    expect(result.role).toBe(CrewMemberRole.DIRECTOR)
  })

  it('rejeita agent de outro tenant', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(null)
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
  })

  it('rejeita duplicate (mesmo agent na mesma crew)', async () => {
    vi.mocked(memberRepo.findByCrewAndAgent).mockResolvedValue(makeMember())
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_ALREADY_IN_CREW' })
  })

  it('rejeita segundo DIRECTOR na mesma crew', async () => {
    vi.mocked(memberRepo.countDirectors).mockResolvedValue(1)
    await expect(useCase.execute(makeInput({ role: CrewMemberRole.DIRECTOR })))
      .rejects.toMatchObject({ code: 'CREW_ALREADY_HAS_DIRECTOR' })
  })

  it('permite DIRECTOR em crews diferentes', async () => {
    vi.mocked(memberRepo.countDirectors).mockResolvedValue(0)
    vi.mocked(memberRepo.create).mockResolvedValue(makeMember({ crewId: 'crew-2', role: CrewMemberRole.DIRECTOR }))
    await expect(useCase.execute(makeInput({ crewId: 'crew-2', role: CrewMemberRole.DIRECTOR }))).resolves.toBeDefined()
  })

  it('rejeita se crew de outro tenant', async () => {
    vi.mocked(crewRepo.findById).mockResolvedValue(null)
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
