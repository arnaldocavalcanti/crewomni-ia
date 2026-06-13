import { describe, it, expect, vi } from 'vitest'
import { SuggestHumanHandoff } from '@/domains/conversation/use-cases/SuggestHumanHandoff'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1',
    tenantId: 'tenant-1',
    departmentId: 'dept-1',
    name: 'Suporte Premium',
    slug: 'suporte-premium',
    description: null,
    objective: null,
    humanHandoffWhatsappNumber: null,
    humanHandoffWebhookUrl: null,
    status: CrewStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCrewRepo(): ICrewRepository {
  return {
    findById: vi.fn().mockResolvedValue(makeCrew()),
    create: vi.fn(),
    findBySlug: vi.fn(),
    findByName: vi.fn(),
    findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as ICrewRepository
}

describe('SuggestHumanHandoff', () => {
  it('retorna canSuggest=true quando crew tem número configurado', async () => {
    const crew = makeCrew({ humanHandoffWhatsappNumber: '+5511999990000' })
    const crewRepo = makeCrewRepo()
    ;(crewRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(crew)

    const useCase = new SuggestHumanHandoff(crewRepo)
    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-1', reason: 'Dúvida técnica complexa' })

    expect(result.canSuggest).toBe(true)
    expect(result.crewName).toBe('Suporte Premium')
    expect(result.reason).toBe('Dúvida técnica complexa')
  })

  it('retorna canSuggest=false quando crew não tem número configurado', async () => {
    const crewRepo = makeCrewRepo()
    const useCase = new SuggestHumanHandoff(crewRepo)
    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-1', reason: 'Teste' })

    expect(result.canSuggest).toBe(false)
  })

  it('retorna canSuggest=false quando crew não existe', async () => {
    const crewRepo = makeCrewRepo()
    ;(crewRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const useCase = new SuggestHumanHandoff(crewRepo)
    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-x', reason: 'Teste' })

    expect(result.canSuggest).toBe(false)
  })
})
