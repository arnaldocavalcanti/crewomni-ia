import { describe, it, expect, vi } from 'vitest'
import { RunKDL } from '@/domains/distillation/use-cases/RunKDL'
import { InMemoryKDLInsightRepository } from '@/infrastructure/db/repositories/InMemoryKDLInsightRepository'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryTenantRepository } from '@/infrastructure/db/repositories/InMemoryTenantRepository'
import { KDLInsightStatus } from '@/domains/distillation/entities/KDLInsight'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'

function makeSut() {
  const kdlInsightRepo = new InMemoryKDLInsightRepository()
  const conversationRepo = new InMemoryConversationRepository()
  const tenantRepo = new InMemoryTenantRepository()
  const llmProviderMock: ILLMProvider = {
    complete: vi.fn(),
  }

  const sut = new RunKDL(kdlInsightRepo, conversationRepo, tenantRepo, llmProviderMock)

  return { sut, kdlInsightRepo, conversationRepo, tenantRepo, llmProviderMock }
}

describe('RunKDL Use Case', () => {
  it('should successfully analyze closed conversations, scrub PII and save insight', async () => {
    const { sut, kdlInsightRepo, conversationRepo, tenantRepo, llmProviderMock } = makeSut()

    // 1. Setup Tenant
    const tenant = await tenantRepo.create({
      name: 'Test Tech',
      slug: 'test-tech',
      niche: 'TECHNOLOGY',
      status: 'ACTIVE' as any,
    })

    // 2. Setup Closed Conversation
    const conv = await conversationRepo.createConversation({
      tenantId: tenant.id,
      agentId: 'agent-1',
    })
    await conversationRepo.createMessage({
      conversationId: conv.id,
      tenantId: tenant.id,
      role: 'USER' as any,
      content: 'Como posso redefinir minha senha do portal? Meu email é joao.silva@email.com e telefone é +55 (11) 98765-4321.',
    })
    await conversationRepo.createMessage({
      conversationId: conv.id,
      tenantId: tenant.id,
      role: 'ASSISTANT' as any,
      content: 'Para redefinir a senha do portal, acesse a tela de login e clique em "Esqueci minha senha". O link será enviado.',
    })
    await conversationRepo.closeConversation(conv.id, tenant.id)

    // 3. Mock LLM Response
    const mockLlmResponse = {
      content: JSON.stringify({
        questionPattern: 'Como posso redefinir minha senha do portal?',
        answerPattern: 'Para redefinir a senha do portal, acesse a tela de login e clique em "Esqueci minha senha".',
        confidence: 0.95,
        skip: false,
      }),
      model: 'gpt-4o-mini',
      tokensUsed: 150,
    }
    vi.spyOn(llmProviderMock, 'complete').mockResolvedValue(mockLlmResponse)

    // 4. Run Use Case
    const result = await sut.execute({ niche: 'TECHNOLOGY' })

    expect(result.conversationsAnalyzed).toBe(1)
    expect(result.insightsCreated).toBe(1)

    // 5. Verify PII scrubbing in LLM calls
    expect(llmProviderMock.complete).toHaveBeenCalledTimes(1)
    const callArgs = (llmProviderMock.complete as any).mock.calls[0][0]
    expect(callArgs.messages[0].content).not.toContain('joao.silva@email.com')
    expect(callArgs.messages[0].content).not.toContain('98765-4321')
    expect(callArgs.messages[0].content).toContain('[EMAIL]')
    expect(callArgs.messages[0].content).toContain('[TELEFONE]')

    // 6. Verify Saved Insight
    const pending = await kdlInsightRepo.listPending(10)
    expect(pending).toHaveLength(1)
    expect(pending[0].niche).toBe('TECHNOLOGY')
    expect(pending[0].questionPattern).toBe('Como posso redefinir minha senha do portal?')
    expect(pending[0].answerPattern).toBe('Para redefinir a senha do portal, acesse a tela de login e clique em "Esqueci minha senha".')
    expect(pending[0].status).toBe(KDLInsightStatus.PENDING_REVIEW)
  })

  it('should skip analysis if tenant has opted out of KDL sharing', async () => {
    const { sut, conversationRepo, tenantRepo, llmProviderMock } = makeSut()

    // 1. Setup Tenant with opt-out
    const tenant = await tenantRepo.create({
      name: 'OptOut Corp',
      slug: 'opt-out-corp',
      niche: 'HEALTH',
      status: 'ACTIVE' as any,
    })
    tenantRepo.setKdlOptOut(tenant.id, true)

    // 2. Setup Closed Conversation
    const conv = await conversationRepo.createConversation({
      tenantId: tenant.id,
      agentId: 'agent-1',
    })
    await conversationRepo.createMessage({
      conversationId: conv.id,
      tenantId: tenant.id,
      role: 'USER' as any,
      content: 'Qual o valor do plano?',
    })
    await conversationRepo.closeConversation(conv.id, tenant.id)

    // 3. Run Use Case
    const result = await sut.execute({ niche: 'HEALTH' })

    expect(result.conversationsAnalyzed).toBe(0)
    expect(result.insightsCreated).toBe(0)
    expect(llmProviderMock.complete).not.toHaveBeenCalled()
  })

  it('should skip analysis if conversation belongs to another niche', async () => {
    const { sut, conversationRepo, tenantRepo, llmProviderMock } = makeSut()

    // 1. Setup Tenant under HEALTH niche
    const tenant = await tenantRepo.create({
      name: 'Health Corp',
      slug: 'health-corp',
      niche: 'HEALTH',
      status: 'ACTIVE' as any,
    })

    // 2. Setup Closed Conversation
    const conv = await conversationRepo.createConversation({
      tenantId: tenant.id,
      agentId: 'agent-1',
    })
    await conversationRepo.createMessage({
      conversationId: conv.id,
      tenantId: tenant.id,
      role: 'USER' as any,
      content: 'Consulta de rotina',
    })
    await conversationRepo.closeConversation(conv.id, tenant.id)

    // 3. Run Use Case for TECHNOLOGY niche
    const result = await sut.execute({ niche: 'TECHNOLOGY' })

    expect(result.conversationsAnalyzed).toBe(0)
    expect(result.insightsCreated).toBe(0)
    expect(llmProviderMock.complete).not.toHaveBeenCalled()
  })

  it('should handle LLM exception or parse error without crashing the run', async () => {
    const { sut, conversationRepo, tenantRepo, llmProviderMock } = makeSut()

    const tenant = await tenantRepo.create({
      name: 'Error Tech',
      slug: 'error-tech',
      niche: 'TECHNOLOGY',
      status: 'ACTIVE' as any,
    })

    const conv = await conversationRepo.createConversation({
      tenantId: tenant.id,
      agentId: 'agent-1',
    })
    await conversationRepo.createMessage({
      conversationId: conv.id,
      tenantId: tenant.id,
      role: 'USER' as any,
      content: 'Mensagem de teste',
    })
    await conversationRepo.closeConversation(conv.id, tenant.id)

    vi.spyOn(llmProviderMock, 'complete').mockRejectedValue(new Error('LLM Provider Outage'))

    const result = await sut.execute({ niche: 'TECHNOLOGY' })

    expect(result.conversationsAnalyzed).toBe(1)
    expect(result.insightsCreated).toBe(0)
  })
})
