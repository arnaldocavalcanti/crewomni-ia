import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SimulateCrewMessage } from '@/domains/crew/use-cases/SimulateCrewMessage'
import { AppError } from '@/shared/errors/AppError'

const TENANT_ID = 'tenant-1'
const CREW_ID = 'crew-1'
const AGENT_DIRECTOR_ID = 'agent-director'
const AGENT_MEMBER_ID = 'agent-member'

function makeCrew(overrides?: object) {
  return {
    id: CREW_ID,
    tenantId: TENANT_ID,
    name: 'SDR Devolus',
    slug: 'sdr-devolus',
    status: 'ACTIVE',
    departmentId: 'dept-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(agentId: string, role: 'DIRECTOR' | 'MEMBER', order: number) {
  return {
    id: `member-${agentId}`,
    crewId: CREW_ID,
    tenantId: TENANT_ID,
    agentId,
    role,
    order,
    isRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeAgent(id: string, name: string, type = 'SDR') {
  return { id, tenantId: TENANT_ID, name, type, status: 'ACTIVE', slug: id }
}

describe('SimulateCrewMessage', () => {
  let crewRepo: any
  let crewMemberRepo: any
  let agentRepo: any
  let sendMessage: any
  let lifecycleRepo: any
  let channelConfigRepo: any
  let useCase: SimulateCrewMessage

  beforeEach(() => {
    crewRepo = {
      findById: vi.fn().mockResolvedValue(makeCrew()),
    }
    crewMemberRepo = {
      findAllByCrew: vi.fn().mockResolvedValue([
        makeMember(AGENT_DIRECTOR_ID, 'DIRECTOR', 1),
      ]),
    }
    agentRepo = {
      findById: vi.fn((id: string, _tenantId: string) =>
        Promise.resolve(makeAgent(id, id === AGENT_DIRECTOR_ID ? 'Receptor SDR' : 'Qualificador'))
      ),
    }
    sendMessage = {
      execute: vi.fn().mockResolvedValue({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        reply: 'Olá! Como posso ajudar?',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
        isNewConversation: true,
        agentId: AGENT_DIRECTOR_ID,
      }),
    }
    lifecycleRepo = {
      findByConversationId: vi.fn().mockResolvedValue([]),
    }
    channelConfigRepo = {
      findByTenantId: vi.fn().mockResolvedValue([]),
    }
    useCase = new SimulateCrewMessage(
      crewRepo, crewMemberRepo, agentRepo, sendMessage, lifecycleRepo, channelConfigRepo
    )
  })

  it('returns reply and flowPath with one agent for a crew with one member', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      crewId: CREW_ID,
      message: 'Olá',
      mode: 'SIMULATE',
    })

    expect(result.reply).toBe('Olá! Como posso ajudar?')
    expect(result.flowPath).toHaveLength(1)
    expect(result.flowPath[0].agentId).toBe(AGENT_DIRECTOR_ID)
    expect(result.flowPath[0].role).toBe('DIRECTOR')
    expect(result.flowPath[0].action).toBe('RESPONDED')
    expect(result.handoffs).toHaveLength(0)
  })

  it('throws CREW_HAS_NO_MEMBERS when crew has no members', async () => {
    crewMemberRepo.findAllByCrew.mockResolvedValue([])

    await expect(
      useCase.execute({ tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE' })
    ).rejects.toThrow(new AppError('CREW_HAS_NO_MEMBERS', 'A Crew não tem agentes configurados'))
  })

  it('throws CREW_NOT_FOUND for crew of a different tenant', async () => {
    crewRepo.findById.mockResolvedValue(null)

    await expect(
      useCase.execute({ tenantId: 'other-tenant', crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE' })
    ).rejects.toThrow(new AppError('CREW_NOT_FOUND', 'Crew não encontrada'))
  })

  it('throws WHATSAPP_CHANNEL_NOT_CONFIGURED for WHATSAPP_REAL mode without channel', async () => {
    channelConfigRepo.findByTenantId.mockResolvedValue([])

    await expect(
      useCase.execute({
        tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá',
        mode: 'WHATSAPP_REAL', toPhone: '+5511999999999',
      })
    ).rejects.toThrow(new AppError('WHATSAPP_CHANNEL_NOT_CONFIGURED', 'Nenhum canal WhatsApp configurado para este tenant'))
  })

  it('builds handoffs from lifecycle events when TransferConversation was called', async () => {
    crewMemberRepo.findAllByCrew.mockResolvedValue([
      makeMember(AGENT_DIRECTOR_ID, 'DIRECTOR', 1),
      makeMember(AGENT_MEMBER_ID, 'MEMBER', 2),
    ])
    lifecycleRepo.findByConversationId.mockResolvedValue([{
      id: 'lc-1',
      conversationId: 'conv-1',
      fromStatus: 'ACTIVE',
      toStatus: 'ACTIVE',
      triggeredBy: 'AGENT',
      metadata: {
        type: 'TRANSFER',
        fromAgentId: AGENT_DIRECTOR_ID,
        toAgentId: AGENT_MEMBER_ID,
      },
      createdAt: new Date(),
    }])

    const result = await useCase.execute({
      tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE',
    })

    expect(result.handoffs).toHaveLength(1)
    expect(result.handoffs[0].fromAgentId).toBe(AGENT_DIRECTOR_ID)
    expect(result.handoffs[0].toAgentId).toBe(AGENT_MEMBER_ID)
  })

  it('includes trace with model and token info', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE',
    })

    expect(result.trace.model).toBe('gpt-4o-mini')
    expect(result.trace.inputTokens).toBeGreaterThanOrEqual(0)
    expect(result.trace.outputTokens).toBeGreaterThanOrEqual(0)
    expect(result.trace.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('invokes new agent after transfer and uses its reply as final result', async () => {
    crewMemberRepo.findAllByCrew.mockResolvedValue([
      makeMember(AGENT_DIRECTOR_ID, 'DIRECTOR', 1),
      makeMember(AGENT_MEMBER_ID, 'MEMBER', 2),
    ])

    // First call: SDR transfers to email agent (returns agentId = AGENT_MEMBER_ID)
    // Second call: email agent responds (returns agentId = AGENT_MEMBER_ID, no further transfer)
    sendMessage.execute
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        reply: 'Um momento, estou transferindo você para o especialista adequado.',
        model: 'gpt-4o-mini',
        tokensUsed: 80,
        isNewConversation: false,
        agentId: AGENT_MEMBER_ID,
      })
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        messageId: 'msg-2',
        reply: 'Olá! Sou o especialista em e-mail. Vou enviar as informações para você.',
        model: 'gpt-4o-mini',
        tokensUsed: 120,
        isNewConversation: false,
        agentId: AGENT_MEMBER_ID,
      })

    const result = await useCase.execute({
      tenantId: TENANT_ID, crewId: CREW_ID, message: 'me envie por email', mode: 'SIMULATE',
    })

    expect(sendMessage.execute).toHaveBeenCalledTimes(2)
    // Second call must skip user message persistence and use a synthetic proactive message
    expect(sendMessage.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      agentId: AGENT_MEMBER_ID,
      skipUserMessage: true,
      conversationId: 'conv-1',
      message: expect.stringContaining('[SISTEMA]'),
    }))
    expect(result.reply).toBe('Olá! Sou o especialista em e-mail. Vou enviar as informações para você.')
  })
})
