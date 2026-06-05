import type { IQualificationStateRepository } from '../repositories/IQualificationStateRepository'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'
import type { QualificationState, QualificationFields } from '../entities/QualificationState'
import { ConversationStage, LeadIntent } from '../entities/QualificationState'

type ExtractAndUpdateStateInput = {
  state: QualificationState
  message: string
}

type ExtractionResult = {
  fields: Partial<QualificationFields>
  intent: string
  stage: string
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um extrator de dados estruturado para agente SDR.
Analise a mensagem do lead e retorne um JSON válido com:
- "fields": objeto com os campos extraídos (use null para campos não mencionados na mensagem)
- "intent": um de: QUALIFICATION_ANSWER, PRICE_INQUIRY, OBJECTION, CONTACT_SHARED, VIDEO_REQUEST, GREETING, OTHER
- "stage": um de: QUALIFYING, PRICE_INQUIRY, OBJECTION, DEMO_SCHEDULED, CONTACT_COLLECTED, CLOSED

Campos disponíveis: tipo_empresa, numero_colaboradores, usa_crm, nome_contato, telefone, email, nivel_interesse, objecao

Retorne APENAS o JSON, sem markdown, sem explicação.`

export class ExtractAndUpdateState {
  constructor(
    private repo: IQualificationStateRepository,
    private llmProvider: ILLMProvider,
  ) {}

  async execute(input: ExtractAndUpdateStateInput): Promise<QualificationState> {
    let extraction: ExtractionResult
    try {
      const result = await this.llmProvider.complete({
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: input.message }],
        model: 'gpt-4o-mini',
        maxTokens: 200,
      })
      extraction = JSON.parse(result.content) as ExtractionResult
    } catch {
      return input.state
    }

    const intent = (Object.values(LeadIntent) as string[]).includes(extraction.intent)
      ? (extraction.intent as LeadIntent)
      : LeadIntent.OTHER

    const stage = (Object.values(ConversationStage) as string[]).includes(extraction.stage)
      ? (extraction.stage as ConversationStage)
      : input.state.stage

    return this.repo.update(input.state.id, input.state.tenantId, {
      lastIntent: intent,
      stage,
      fields: extraction.fields ?? {},
    })
  }
}
