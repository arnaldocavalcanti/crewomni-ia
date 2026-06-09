import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { IConversationSummaryRepository } from '../repositories/IConversationSummaryRepository'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'

export type SummarizeConversationInput = {
  tenantId: string
  conversationId: string
}

export class SummarizeConversation {
  constructor(
    private conversationRepo: IConversationRepository,
    private summaryRepo: IConversationSummaryRepository,
    private llmProvider: ILLMProvider,
  ) {}

  async execute(input: SummarizeConversationInput): Promise<void> {
    const { tenantId, conversationId } = input

    // 1. Carrega histórico completo de mensagens da conversa
    const messages = await this.conversationRepo.listMessages(conversationId, tenantId)
    if (messages.length === 0) return

    // 2. Carrega resumo existente
    const existingSummary = await this.summaryRepo.findByConversationId(conversationId, tenantId)

    // 3. Filtra apenas mensagens ainda não sumarizadas
    let newMessages = messages
    if (existingSummary && existingSummary.lastSummarizedMessageId) {
      const idx = messages.findIndex((m) => m.id === existingSummary.lastSummarizedMessageId)
      if (idx !== -1) {
        newMessages = messages.slice(idx + 1)
      }
    }

    if (newMessages.length === 0) return

    // 4. Formata as novas mensagens
    const formattedMessages = newMessages
      .map((m) => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')

    // 5. Prepara prompt de sumarização com as diretrizes de privacidade e LGPD
    const systemPrompt = `Você é um assistente especializado em resumir turnos de conversas de atendimento.
Seu objetivo é gerar um resumo conciso e progressivo dos principais tópicos abordados na conversa.
REGRA IMPORTANTE: Remova ou mascare qualquer dado pessoal sensível (PII), como nomes completos, CPFs, números de telefone, cartões de crédito ou senhas. Use placeholders como [NOME], [TELEFONE] se necessário.
Se já existir um resumo anterior, incorpore os novos fatos de forma coesa sem perder o histórico essencial.`

    const userPrompt = existingSummary
      ? `Resumo anterior:\n${existingSummary.summary}\n\nNovas mensagens a serem incorporadas:\n${formattedMessages}`
      : `Mensagens a serem sumariadas:\n${formattedMessages}`

    // 6. Chama o provedor LLM
    const result = await this.llmProvider.complete({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      model: 'gpt-4o-mini',
    })

    const newSummaryText = result.content.trim()
    const lastMessage = newMessages[newMessages.length - 1]

    // 7. Persiste ou atualiza o resumo
    await this.summaryRepo.upsert({
      id: existingSummary?.id ?? crypto.randomUUID(),
      tenantId,
      conversationId,
      summary: newSummaryText,
      lastSummarizedMessageId: lastMessage.id,
      summaryVersion: (existingSummary?.summaryVersion ?? 0) + 1,
      tokenCount: Math.ceil(newSummaryText.length / 4), // Estimativa base de tokens
      createdAt: existingSummary?.createdAt ?? new Date(),
      updatedAt: new Date(),
    })
  }
}
