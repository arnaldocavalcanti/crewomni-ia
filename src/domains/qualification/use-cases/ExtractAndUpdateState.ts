import type { ILLMProvider } from '@/shared/types/ILLMProvider'
import type { QualificationState } from '../entities/QualificationState'
import type { QualificationSchema } from '../entities/QualificationSchema'
import type { ValidateAndMerge, ExtractionDelta } from './ValidateAndMerge'
import { ConversationStage, LeadIntent } from '../entities/QualificationState'
import type { IQualificationStateRepository } from '../repositories/IQualificationStateRepository'

export type ExtractAndUpdateStateInput = {
  state: QualificationState
  schema?: QualificationSchema   // optional — uses generic fallback when absent
  message: string
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
}

export type ExtractAndUpdateStateOutput = {
  newState: QualificationState
  changedKeys: string[]
  rejectedKeys: string[]
}

const GENERIC_FALLBACK_SCHEMA: QualificationSchema = {
  id: 'generic-fallback',
  tenantId: null,
  nicheKey: 'generic',
  version: 1,
  fields: [
    { key: 'tipo_empresa', type: 'string', label: 'Tipo de empresa' },
    { key: 'nome_contato', type: 'string', label: 'Nome do contato' },
    { key: 'email', type: 'string', label: 'E-mail' },
    { key: 'nivel_interesse', type: 'string', label: 'Nível de interesse' },
  ],
  order: ['tipo_empresa', 'nome_contato', 'nivel_interesse', 'email'],
  createdAt: new Date(0),
}

type LLMExtractionItem = {
  field: string
  value: unknown
  evidence: string | null
  intent?: string
  stage?: string
}

type LLMExtractionResult = {
  extractions: LLMExtractionItem[]
  intent: string
  stage: string
}

function buildExtractionPrompt(schema: QualificationSchema): string {
  const fieldDescriptions = schema.fields
    .map((f) => {
      let desc = `  - "${f.key}" (${f.type})`
      if (f.label) desc += `: ${f.label}`
      if (f.type === 'enum' && f.enum) desc += ` — valores aceitos: [${f.enum.join(', ')}]`
      if (f.type === 'integer') desc += ` — inteiro${f.min !== undefined ? `, mín: ${f.min}` : ''}${f.max !== undefined ? `, máx: ${f.max}` : ''}`
      return desc
    })
    .join('\n')

  return `Você é um extrator de dados estruturado para agente SDR.

Analise a mensagem do lead (e o histórico fornecido) e retorne um JSON válido com:
- "extractions": array de { "field", "value", "evidence" } — apenas campos com evidência literal
- "intent": um de: QUALIFICATION_ANSWER, PRICE_INQUIRY, OBJECTION, CONTACT_SHARED, VIDEO_REQUEST, GREETING, OTHER
- "stage": um de: QUALIFYING, PRICE_INQUIRY, OBJECTION, DEMO_SCHEDULED, CONTACT_COLLECTED, CLOSED

Campos disponíveis do schema:
${fieldDescriptions}

REGRAS CRÍTICAS:
1. Só extraia um campo se houver evidência literal na mensagem do lead — trecho exato que comprova o valor.
2. "evidence" deve ser o trecho literal da mensagem que comprova o valor (nunca invente).
3. Se não houver evidência para um campo, NÃO inclua esse campo nas extractions.
4. Para campos "enum", mapeie a resposta do lead para o valor aceito mais próximo (ex: "internamente" → "propria").
5. Para campos "integer", extraia apenas o número — sem unidades.

Retorne APENAS o JSON, sem markdown, sem explicação.`
}

export class ExtractAndUpdateState {
  constructor(
    private stateRepo: IQualificationStateRepository,
    private llmProvider: ILLMProvider,
    private validateAndMerge: ValidateAndMerge,
  ) {}

  async execute(input: ExtractAndUpdateStateInput): Promise<ExtractAndUpdateStateOutput> {
    const schema = input.schema ?? GENERIC_FALLBACK_SCHEMA
    let result: LLMExtractionResult
    try {
      const contextMessages: { role: 'user' | 'assistant'; content: string }[] = input.conversationHistory
        ? [...input.conversationHistory.slice(-6), { role: 'user', content: input.message }]
        : [{ role: 'user', content: input.message }]

      const llmResult = await this.llmProvider.complete({
        systemPrompt: buildExtractionPrompt(schema),
        messages: contextMessages,
        model: 'gpt-4o-mini',
        maxTokens: 400,
      })
      result = JSON.parse(llmResult.content) as LLMExtractionResult
    } catch {
      // Extraction failure is non-critical — return current state unchanged
      return { newState: input.state, changedKeys: [], rejectedKeys: [] }
    }

    const delta: ExtractionDelta[] = (result.extractions ?? []).map((item) => ({
      field: item.field,
      value: item.value,
      evidence: item.evidence ?? null,
    }))

    const mergeResult = await this.validateAndMerge.execute({
      state: input.state,
      schema,
      delta,
    })

    // Update stage and intent separately
    const intent = (Object.values(LeadIntent) as string[]).includes(result.intent)
      ? (result.intent as LeadIntent)
      : LeadIntent.OTHER

    const stage = (Object.values(ConversationStage) as string[]).includes(result.stage)
      ? (result.stage as ConversationStage)
      : input.state.stage

    const finalState = await this.stateRepo.update(mergeResult.newState.id, input.state.tenantId, {
      lastIntent: intent,
      stage,
    })

    return {
      newState: { ...mergeResult.newState, ...finalState },
      changedKeys: mergeResult.changedKeys,
      rejectedKeys: mergeResult.rejectedKeys,
    }
  }
}
