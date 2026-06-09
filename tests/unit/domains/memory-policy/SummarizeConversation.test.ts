import { describe, it, expect } from 'vitest'
import { SummarizeConversation } from '@/domains/memory-policy/use-cases/SummarizeConversation'
import { InMemoryConversationRepository } from '@/infrastructure/db/repositories/InMemoryConversationRepository'
import { InMemoryConversationSummaryRepository } from '@/infrastructure/db/repositories/InMemoryConversationSummaryRepository'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'

class FakeLLMProvider implements ILLMProvider {
  public lastSystemPrompt: string = ''
  public lastMessages: any[] = []
  public reply: string = 'Este é o resumo gerado pelo modelo.'

  async complete(params: any): Promise<any> {
    this.lastSystemPrompt = params.systemPrompt
    this.lastMessages = params.messages
    return {
      content: this.reply,
      model: 'gpt-4o-mini',
      tokensUsed: 100,
    }
  }
}

function makeUseCase() {
  const convRepo = new InMemoryConversationRepository()
  const summaryRepo = new InMemoryConversationSummaryRepository()
  const llmProvider = new FakeLLMProvider()
  const useCase = new SummarizeConversation(convRepo, summaryRepo, llmProvider)
  return { useCase, convRepo, summaryRepo, llmProvider }
}

describe('SummarizeConversation', () => {
  it('deve retornar silenciosamente se nao houver mensagens', async () => {
    const { useCase, summaryRepo } = makeUseCase()
    await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })
    const summary = await summaryRepo.findByConversationId('conv-1', 'tenant-1')
    expect(summary).toBeNull()
  })

  it('deve criar novo resumo se nao existir', async () => {
    const { useCase, convRepo, summaryRepo, llmProvider } = makeUseCase()
    
    // Cria conversa e mensagens
    const conv = await convRepo.createConversation({ tenantId: 'tenant-1', agentId: 'agent-1' })
    const m1 = await convRepo.createMessage({
      conversationId: conv.id,
      tenantId: 'tenant-1',
      role: 'USER' as any,
      content: 'Preciso de ajuda com login',
    })
    const m2 = await convRepo.createMessage({
      conversationId: conv.id,
      tenantId: 'tenant-1',
      role: 'ASSISTANT' as any,
      content: 'Qual o erro apresentado?',
    })

    await useCase.execute({ tenantId: 'tenant-1', conversationId: conv.id })

    const summary = await summaryRepo.findByConversationId(conv.id, 'tenant-1')
    expect(summary).not.toBeNull()
    expect(summary?.summary).toBe('Este é o resumo gerado pelo modelo.')
    expect(summary?.lastSummarizedMessageId).toBe(m2.id)
    expect(summary?.summaryVersion).toBe(1)
    expect(llmProvider.lastMessages[0].content).toContain('Preciso de ajuda com login')
  })

  it('deve atualizar resumo existente incorporando novas mensagens', async () => {
    const { useCase, convRepo, summaryRepo, llmProvider } = makeUseCase()
    
    const conv = await convRepo.createConversation({ tenantId: 'tenant-1', agentId: 'agent-1' })
    const m1 = await convRepo.createMessage({
      conversationId: conv.id, tenantId: 'tenant-1', role: 'USER' as any, content: 'Msg 1',
    })

    // Upsert summary inicial
    await summaryRepo.upsert({
      id: 'sum-1',
      tenantId: 'tenant-1',
      conversationId: conv.id,
      summary: 'Resumo inicial',
      lastSummarizedMessageId: m1.id,
      summaryVersion: 1,
      tokenCount: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Cria nova mensagem
    const m2 = await convRepo.createMessage({
      conversationId: conv.id, tenantId: 'tenant-1', role: 'ASSISTANT' as any, content: 'Msg 2',
    })

    llmProvider.reply = 'Resumo atualizado'

    await useCase.execute({ tenantId: 'tenant-1', conversationId: conv.id })

    const summary = await summaryRepo.findByConversationId(conv.id, 'tenant-1')
    expect(summary).not.toBeNull()
    expect(summary?.summary).toBe('Resumo atualizado')
    expect(summary?.lastSummarizedMessageId).toBe(m2.id)
    expect(summary?.summaryVersion).toBe(2)
    expect(llmProvider.lastMessages[0].content).toContain('Resumo anterior:\nResumo inicial')
    expect(llmProvider.lastMessages[0].content).toContain('Assistant: Msg 2')
  })
})
