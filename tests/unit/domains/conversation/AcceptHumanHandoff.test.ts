import { describe, it, expect, vi } from 'vitest'

// Mock dns.promises.lookup so isSafeWebhookUrl passes in unit tests without real DNS
vi.mock('dns', () => ({
  promises: {
    lookup: vi.fn().mockResolvedValue([{ address: '203.0.113.1', family: 4 }]),
  },
}))
import { AcceptHumanHandoff } from '@/domains/conversation/use-cases/AcceptHumanHandoff'
import { ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IContactChannelIdentityRepository } from '@/domains/contact/repositories/IContactChannelIdentityRepository'
import type { IHumanHandoffRepository } from '@/domains/conversation/repositories/IHumanHandoffRepository'
import type { IChannelDispatcher } from '@/infrastructure/channel/IChannelDispatcher'

function makeConversation(overrides = {}) {
  return {
    id: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    crewId: 'crew-1',
    externalUserId: null,
    status: ConversationStatus.OPEN,
    messageCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1',
    tenantId: 'tenant-1',
    departmentId: 'dept-1',
    name: 'Suporte Premium',
    slug: 'suporte-premium',
    description: null,
    objective: null,
    status: 'ACTIVE' as const,
    humanHandoffWhatsappNumber: '+5511999990000',
    humanHandoffWebhookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMessages() {
  return [
    { id: 'm1', conversationId: 'conv-1', tenantId: 'tenant-1', role: MessageRole.USER, content: 'Preciso de ajuda', createdAt: new Date() },
    { id: 'm2', conversationId: 'conv-1', tenantId: 'tenant-1', role: MessageRole.ASSISTANT, content: 'Claro, vou verificar.', createdAt: new Date() },
  ]
}

function makeConversationRepo(): IConversationRepository {
  return {
    findConversationById: vi.fn().mockResolvedValue(makeConversation()),
    listRecentMessages: vi.fn().mockResolvedValue(makeMessages()),
    updateConversationStatus: vi.fn().mockResolvedValue(undefined),
    createConversation: vi.fn(),
    createMessage: vi.fn(),
    countMessages: vi.fn(),
    closeConversation: vi.fn(),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    countConversationsByCrew: vi.fn(),
    countMessagesByCrewAndAgent: vi.fn(),
    updateConversationAgent: vi.fn(),
    listClosedConversations: vi.fn(),
    getMessageHistory: vi.fn(),
  } as unknown as IConversationRepository
}

function makeCrewRepo(crewOverrides = {}): ICrewRepository {
  return {
    findById: vi.fn().mockResolvedValue(makeCrew(crewOverrides)),
    create: vi.fn(),
    findBySlug: vi.fn(),
    findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as ICrewRepository
}

function makeChannelIdentityRepo(phoneNumber: string | null = null): IContactChannelIdentityRepository {
  return {
    findByExternalId: vi.fn().mockResolvedValue(null),
    findByContactId: vi.fn().mockResolvedValue(
      phoneNumber ? [{ channel: 'WHATSAPP', phoneNumber, externalId: phoneNumber }] : []
    ),
    save: vi.fn(),
  } as unknown as IContactChannelIdentityRepository
}

function makeHandoffRepo(): IHumanHandoffRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findByConversationId: vi.fn().mockResolvedValue(null),
  }
}

function makeDispatcher(): IChannelDispatcher {
  return {
    send: vi.fn().mockResolvedValue({ success: true }),
  }
}

function makeSut(opts: {
  crew?: ReturnType<typeof makeCrew>
  customerPhone?: string | null
  dispatcher?: IChannelDispatcher
} = {}) {
  const conversationRepo = makeConversationRepo()
  const crewRepo = makeCrewRepo()
  if (opts.crew !== undefined) {
    ;(crewRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(opts.crew)
  }
  const channelIdentityRepo = makeChannelIdentityRepo(opts.customerPhone ?? null)
  const handoffRepo = makeHandoffRepo()
  const dispatcher = opts.dispatcher ?? makeDispatcher()
  const useCase = new AcceptHumanHandoff(conversationRepo, crewRepo, channelIdentityRepo, handoffRepo, dispatcher)
  return { useCase, conversationRepo, crewRepo, channelIdentityRepo, handoffRepo, dispatcher }
}

describe('AcceptHumanHandoff', () => {
  it('despacha WA ao cliente e ao bot quando contactPhone é fornecido no body', async () => {
    const { useCase, dispatcher, handoffRepo, conversationRepo } = makeSut()

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      contactPhone: '+5511888880000',
    })

    expect(result.success).toBe(true)
    expect(result.channel).toBe('whatsapp')

    const calls = (dispatcher.send as ReturnType<typeof vi.fn>).mock.calls
    const toNumbers = calls.map((c: any[]) => c[0].to)
    expect(toNumbers).toContain('+5511888880000')
    expect(toNumbers).toContain('+5511999990000')

    expect(handoffRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      contactPhone: '+5511888880000',
    }))

    expect(conversationRepo.updateConversationStatus).toHaveBeenCalledWith(
      'conv-1',
      'TRANSFERRED_TO_HUMAN',
      'tenant-1',
    )
  })

  it('despacha WA quando contactPhone vem da identidade do canal', async () => {
    const { useCase, dispatcher } = makeSut({ customerPhone: '+5511777770000' })

    // Conversation has externalUserId so identity lookup is triggered
    const convRepo = (useCase as any).conversationRepo
    ;(convRepo.findConversationById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConversation({ externalUserId: 'contact-1' })
    )

    const result = await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })

    expect(result.channel).toBe('whatsapp')
    const calls = (dispatcher.send as ReturnType<typeof vi.fn>).mock.calls
    const toNumbers = calls.map((c: any[]) => c[0].to)
    expect(toNumbers).toContain('+5511777770000')
  })

  it('retorna channel=link quando contactPhone não é informado e não há identidade WA', async () => {
    const { useCase, dispatcher } = makeSut({ customerPhone: null })

    const result = await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })

    expect(result.channel).toBe('link')
    expect(result.linkUrl).toContain('wa.me')
    // Must NOT dispatch WA to the customer (only to bot is OK)
    const calls = (dispatcher.send as ReturnType<typeof vi.fn>).mock.calls
    const clientCalls = calls.filter((c: any[]) => c[0].to !== '+5511999990000')
    expect(clientCalls).toHaveLength(0)
  })

  it('dispara webhook JSON quando crew.humanHandoffWebhookUrl está configurado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const crew = makeCrew({ humanHandoffWebhookUrl: 'https://n8n.example.com/webhook/handoff' })
    const { useCase } = makeSut({ crew, customerPhone: '+5511888880000' })

    await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', contactPhone: '+5511888880000' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/handoff',
      expect.objectContaining({ method: 'POST' }),
    )

    vi.unstubAllGlobals()
  })

  it('não dispara webhook quando crew.humanHandoffWebhookUrl é null', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { useCase } = makeSut({ customerPhone: '+5511888880000' })
    await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', contactPhone: '+5511888880000' })

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('lança erro quando crew não tem humanHandoffWhatsappNumber configurado', async () => {
    const crew = makeCrew({ humanHandoffWhatsappNumber: null })
    const { useCase } = makeSut({ crew })

    await expect(
      useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })
    ).rejects.toThrow('HUMAN_HANDOFF_NOT_CONFIGURED')
  })

  it('lança erro quando conversa não é encontrada', async () => {
    const { useCase, conversationRepo } = makeSut()
    ;(conversationRepo.findConversationById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-x' })
    ).rejects.toThrow('Conversa não encontrada.')
  })
})
