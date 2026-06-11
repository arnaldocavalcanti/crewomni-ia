import { describe, it, expect, vi } from 'vitest'
import { RemoveAgentFromCrew } from '@/domains/crew/use-cases/RemoveAgentFromCrew'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

function makeMember(overrides = {}) {
  return {
    id: 'mem-1', tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1',
    role: CrewMemberRole.MEMBER, order: 0, isRequired: true, createdAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeMember()): ICrewMemberRepository {
  return {
    create: vi.fn(), findByCrewAndAgent: vi.fn(), findAllByCrew: vi.fn(),
    findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), findFirstByAgent: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    delete:   vi.fn().mockResolvedValue(undefined),
  }
}

describe('RemoveAgentFromCrew', () => {
  it('remove membro existente', async () => {
    const repo = makeRepo()
    const audit: IAuditLogger = { log: vi.fn() }
    await new RemoveAgentFromCrew(repo, audit).execute({ memberId: 'mem-1', tenantId: 'tenant-1' })
    expect(repo.delete).toHaveBeenCalledWith('mem-1', 'tenant-1')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.member_removed' }))
  })

  it('lança CREW_MEMBER_NOT_FOUND para membro de outro tenant', async () => {
    const repo = makeRepo(null)
    const audit: IAuditLogger = { log: vi.fn() }
    await expect(new RemoveAgentFromCrew(repo, audit).execute({ memberId: 'mem-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_MEMBER_NOT_FOUND' })
  })
})
