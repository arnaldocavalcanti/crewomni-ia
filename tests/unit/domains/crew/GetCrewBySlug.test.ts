import { describe, it, expect, beforeEach } from 'vitest'
import { GetCrewBySlug } from '@/domains/crew/use-cases/GetCrewBySlug'
import { InMemoryCrewRepository } from '@/infrastructure/db/repositories/InMemoryCrewRepository'
import { InMemoryCrewMemberRepository } from '@/infrastructure/db/repositories/InMemoryCrewMemberRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

describe('GetCrewBySlug Use Case', () => {
  let crewRepo: InMemoryCrewRepository
  let memberRepo: InMemoryCrewMemberRepository
  let useCase: GetCrewBySlug

  beforeEach(() => {
    crewRepo = new InMemoryCrewRepository()
    memberRepo = new InMemoryCrewMemberRepository()
    useCase = new GetCrewBySlug(crewRepo, memberRepo)
  })

  it('deve retornar a crew junto com seus membros', async () => {
    const crew = await crewRepo.create({
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      name: 'Equipe Comercial',
      slug: 'equipe-comercial',
    })

    await memberRepo.create({
      tenantId: 'tenant-1',
      crewId: crew.id,
      agentId: 'agent-1',
      role: CrewMemberRole.DIRECTOR,
      order: 1,
      isRequired: true,
    })

    const result = await useCase.execute({
      slug: 'equipe-comercial',
      tenantId: 'tenant-1',
    })

    expect(result.id).toBe(crew.id)
    expect(result.name).toBe('Equipe Comercial')
    expect(result.members).toHaveLength(1)
    expect(result.members[0].agentId).toBe('agent-1')
  })

  it('deve rejeitar se a crew nao for encontrada', async () => {
    await expect(
      useCase.execute({ slug: 'nao-existe', tenantId: 'tenant-1' }),
    ).rejects.toThrow('Crew não encontrada.')
  })

  it('deve rejeitar se for tentado acessar crew de outro tenant', async () => {
    await crewRepo.create({
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      name: 'Comercial',
      slug: 'comercial',
    })

    await expect(
      useCase.execute({ slug: 'comercial', tenantId: 'tenant-2' }),
    ).rejects.toThrow('Crew não encontrada.')
  })
})
