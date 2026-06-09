import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GetCrewMetrics } from '@/domains/crew/use-cases/GetCrewMetrics'
import { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'

describe('GetCrewMetrics Use Case', () => {
  let crewRepo: any
  let conversationRepo: any
  let auditLogger: any
  let useCase: GetCrewMetrics

  beforeEach(() => {
    crewRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listByDepartment: vi.fn(),
      listByTenant: vi.fn(),
      findBySlug: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as any

    conversationRepo = {
      countConversationsByCrew: vi.fn(),
      countMessagesByCrewAndAgent: vi.fn(),
    } as any

    auditLogger = { log: vi.fn() }

    useCase = new GetCrewMetrics(crewRepo, conversationRepo, auditLogger)
  })

  it('deve retornar as métricas corretamente', async () => {
    crewRepo.findById.mockResolvedValue({
      id: 'crew-1',
      tenantId: 'tenant-1',
      departmentId: 'dep-1',
      name: 'Sales Crew',
      slug: 'sales-crew',
      status: CrewStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    conversationRepo.countConversationsByCrew.mockResolvedValue({ total: 10, active: 3 })
    conversationRepo.countMessagesByCrewAndAgent.mockResolvedValue([
      { agentId: 'agent-1', count: 20 },
      { agentId: 'agent-2', count: 15 },
    ])

    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-1' })

    expect(result.totalConversations).toBe(10)
    expect(result.activeConversations).toBe(3)
    expect(result.totalMessages).toBe(35) // 20 + 15
    expect(result.messagesByAgent).toHaveLength(2)
    expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREW_METRICS_FETCHED',
      tenantId: 'tenant-1',
      resourceId: 'crew-1',
    }))
  })

  it('deve retornar 404 se a crew não pertencer ao tenant', async () => {
    crewRepo.findById.mockResolvedValue(null) // tenant incorreto

    await expect(useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-2' }))
      .rejects.toThrow('Equipe não encontrada')
  })

  it('deve retornar métricas zeradas para crew sem conversas', async () => {
    crewRepo.findById.mockResolvedValue({
      id: 'crew-3',
      tenantId: 'tenant-1',
      departmentId: 'dep-1',
      name: 'Empty Crew',
      slug: 'empty',
      status: CrewStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    conversationRepo.countConversationsByCrew.mockResolvedValue({ total: 0, active: 0 })
    conversationRepo.countMessagesByCrewAndAgent.mockResolvedValue([])

    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-3' })

    expect(result.totalConversations).toBe(0)
    expect(result.activeConversations).toBe(0)
    expect(result.totalMessages).toBe(0)
    expect(result.messagesByAgent).toHaveLength(0)
  })
})
