import { KDLInsight, KDLInsightStatus } from '../entities/KDLInsight'
import type { IKDLInsightRepository } from '../repositories/IKDLInsightRepository'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { ITenantRepository } from '@/domains/tenant/repositories/ITenantRepository'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'

export type RunKDLInput = {
  niche: string
}

export type RunKDLOutput = {
  conversationsAnalyzed: number
  insightsCreated: number
}

export class RunKDL {
  constructor(
    private kdlInsightRepo: IKDLInsightRepository,
    private conversationRepo: IConversationRepository,
    private tenantRepo: ITenantRepository,
    private llmProvider: ILLMProvider,
  ) {}

  private scrubPII(text: string): string {
    return text
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]') // Emails
      .replace(/\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[TELEFONE]') // Phones
      .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[DOCUMENTO]') // CPF
      .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '[DOCUMENTO]') // CNPJ
  }

  async execute(input: RunKDLInput): Promise<RunKDLOutput> {
    // 1. Busca conversas CLOSED
    const conversations = await this.conversationRepo.listClosedConversations(100)
    let analyzedCount = 0
    let insightCount = 0

    for (const conv of conversations) {
      // 2. Filtra conversas pelo nicho e opt-out do tenant
      const tenant = await this.tenantRepo.findById(conv.tenantId)
      if (!tenant || tenant.niche !== input.niche) continue

      const optedOut = await this.tenantRepo.isKdlOptedOut(conv.tenantId)
      if (optedOut) continue

      analyzedCount++

      // 3. Carrega histórico de mensagens da conversa
      const messages = await this.conversationRepo.listMessages(conv.id, conv.tenantId)
      if (messages.length === 0) continue

      // 4. Anonimiza PII no conteúdo
      const formattedHistory = messages
        .map((m) => {
          const cleanContent = this.scrubPII(m.content)
          return `${m.role === 'USER' ? 'User' : 'Assistant'}: ${cleanContent}`
        })
        .join('\n')

      // 5. Executa extração de insights usando LLM
      const systemPrompt = `Analise a conversa abaixo e extraia o padrão genérico de pergunta e resposta.

REGRAS OBRIGATÓRIAS:
- Remova TODOS os dados pessoais: nomes, e-mails, telefones, CPF, CNPJ, endereços, valores monetários, datas específicas
- Generalize referências a empresas específicas (ex: "Devolus" → "a empresa")
- Se não houver padrão reutilizável, responda: {"skip": true}
- Responda APENAS em JSON válido

FORMATO:
{
  "questionPattern": "Como faço para [ação genérica]?",
  "answerPattern": "Para [ação genérica], os passos são: [passos genéricos].",
  "confidence": 0.0-1.0,
  "skip": false
}`

      try {
        const result = await this.llmProvider.complete({
          systemPrompt,
          messages: [{ role: 'user', content: formattedHistory }],
          model: 'gpt-4o-mini',
        })

        const data = JSON.parse(result.content.trim())
        if (data.skip || data.confidence < 0.8) continue

        // 6. Salva o insight destilado
        const insight: KDLInsight = {
          id: crypto.randomUUID(),
          niche: tenant.niche,
          questionPattern: data.questionPattern,
          answerPattern: data.answerPattern,
          sourceCount: 1,
          confidence: data.confidence,
          status: KDLInsightStatus.PENDING_REVIEW,
          createdAt: new Date(),
        }
        await this.kdlInsightRepo.save(insight)
        insightCount++
      } catch (err) {
        // Ignora falhas de parsing ou LLM e prossegue com as outras conversas
        console.error('KDL extraction failed for conversation:', conv.id, err)
      }
    }

    return {
      conversationsAnalyzed: analyzedCount,
      insightsCreated: insightCount,
    }
  }
}
