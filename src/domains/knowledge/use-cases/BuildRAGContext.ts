import { AppError } from '@/shared/errors/AppError'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAgentPromptVersionRepository } from '@/domains/agent/repositories/IAgentPromptVersionRepository'
import { AgentStatus } from '@/domains/agent/entities/Agent'
import type { IVectorRepository, VectorSearchResult } from '@/shared/types/IVectorRepository'
import type { IEmbeddingProvider } from '@/shared/types/IEmbeddingProvider'
import type { ILLMProvider, LLMMessage } from '@/shared/types/ILLMProvider'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { KnowledgeLayer } from '../entities/KnowledgeDocument'
import { DEFAULT_TOP_K, DEFAULT_SIMILARITY_THRESHOLD } from '@/shared/constants'
import type { QualificationState } from '@/domains/qualification/entities/QualificationState'
import type { QualificationSchema } from '@/domains/qualification/entities/QualificationSchema'
import { pickNextField } from '@/domains/qualification/use-cases/PickNextField'

// ── Token budgets per layer (ADR 004) ─────────────────────────────────────────
const TOKEN_BUDGET = {
  GLOBAL: 800,
  TENANT: 1500,
  AGENT: 800,
} as const

// Rough chars-to-tokens ratio (1 token ≈ 4 chars in Portuguese)
const CHARS_PER_TOKEN = 4

type ConversationMessage = { role: 'user' | 'assistant'; content: string }

type BuildRAGContextInput = {
  tenantId: string
  agentId: string
  message: string
  conversationHistory?: ConversationMessage[]
  qualificationState?: QualificationState
  qualificationSchema?: QualificationSchema
  crewMembers?: { role: string; agentSlug: string; agentName: string; agentId: string; description?: string; operationalFunction?: string }[]
  tools?: any[]
}

type ChunkUsage = {
  layer: 'GLOBAL' | 'TENANT' | 'AGENT'
  count: number
  totalScore: number
}

type BuildRAGContextOutput = {
  reply: string
  model: string
  tokensUsed: number
  chunksUsed: ChunkUsage[]
  toolCalls?: any[]
}

export class BuildRAGContext {
  constructor(
    private agentRepo: IAgentRepository,
    private promptRepo: IAgentPromptVersionRepository,
    private vectorRepo: IVectorRepository,
    private embeddingProvider: IEmbeddingProvider,
    private llmProvider: ILLMProvider,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: BuildRAGContextInput): Promise<BuildRAGContextOutput> {
    // 1. Validate message
    if (!input.message || !input.message.trim()) {
      throw new AppError('VALIDATION_ERROR', 'A mensagem não pode ser vazia.')
    }

    // 2. Load agent — tenantId ensures isolation (404 for other tenant)
    const agent = await this.agentRepo.findById(input.agentId, input.tenantId)
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado.')

    if (agent.status !== AgentStatus.ACTIVE) {
      throw new AppError('AGENT_NOT_ACTIVE', 'O agente não está ativo.')
    }

    // 3. Load active system prompt
    const promptVersion = await this.promptRepo.findActiveByAgent(input.agentId, input.tenantId)
    const baseSystemPrompt = promptVersion?.systemPrompt ?? ''

    // 4. Generate embedding for the user message
    let embedding: number[]
    try {
      embedding = await this.embeddingProvider.embed(input.message.trim())
    } catch {
      throw new AppError('EMBEDDING_ERROR', 'Falha ao gerar embedding da mensagem.')
    }

    // 5. Search KB layers in parallel (Industry KB skipped — Phase 1)
    const searchParams = { embedding, topK: DEFAULT_TOP_K, threshold: DEFAULT_SIMILARITY_THRESHOLD }

    const [tenantChunks, agentChunks] = await Promise.all([
      this.vectorRepo.search({ ...searchParams, tenantId: input.tenantId, layer: KnowledgeLayer.TENANT }),
      this.vectorRepo.search({ ...searchParams, tenantId: input.tenantId, layer: KnowledgeLayer.AGENT, agentId: input.agentId }),
    ])

    // 6. Apply token budgets — trim lowest-score chunks first
    const trimmedTenant = applyBudget(tenantChunks, TOKEN_BUDGET.TENANT)
    const trimmedAgent = applyBudget(agentChunks, TOKEN_BUDGET.AGENT)

    // 7. Build system prompt (ADR 004 format)
    const systemPrompt = buildSystemPrompt(baseSystemPrompt, trimmedTenant, trimmedAgent, input.qualificationState, input.qualificationSchema, input.crewMembers, input.conversationHistory)

    // 8. Build messages array: history + current message
    const history = input.conversationHistory ?? []
    const messages: LLMMessage[] = [
      ...history,
      { role: 'user', content: input.message.trim() },
    ]

    // 9. Call LLM
    let llmResult: Awaited<ReturnType<ILLMProvider['complete']>>
    try {
      llmResult = await this.llmProvider.complete({ systemPrompt, messages, tools: input.tools })
    } catch {
      throw new AppError('LLM_PROVIDER_ERROR', 'Falha ao chamar o provedor de LLM.')
    }

    // 10. Build chunksUsed summary
    const chunksUsed: ChunkUsage[] = []
    if (trimmedTenant.length > 0) {
      chunksUsed.push({ layer: 'TENANT', count: trimmedTenant.length, totalScore: sum(trimmedTenant.map((c) => c.score)) })
    }
    if (trimmedAgent.length > 0) {
      chunksUsed.push({ layer: 'AGENT', count: trimmedAgent.length, totalScore: sum(trimmedAgent.map((c) => c.score)) })
    }

    // 11. Audit log
    await this.auditLogger.log({
      action: 'knowledge.rag.completed',
      tenantId: input.tenantId,
      metadata: {
        agentId: input.agentId,
        model: llmResult.model,
        tokensUsed: llmResult.tokensUsed,
        chunkCount: chunksUsed.reduce((acc, c) => acc + c.count, 0),
        toolCalls: llmResult.toolCalls ? llmResult.toolCalls.length : 0,
      },
    })

    return {
      reply: llmResult.content,
      model: llmResult.model,
      tokensUsed: llmResult.tokensUsed,
      chunksUsed,
      toolCalls: llmResult.toolCalls,
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyBudget(chunks: VectorSearchResult[], budgetTokens: number): VectorSearchResult[] {
  const budgetChars = budgetTokens * CHARS_PER_TOKEN
  const sorted = [...chunks].sort((a, b) => b.score - a.score)
  let used = 0
  return sorted.filter((c) => {
    used += c.content.length
    return used <= budgetChars
  })
}

function buildSystemPrompt(
  base: string,
  tenantChunks: VectorSearchResult[],
  agentChunks: VectorSearchResult[],
  qualificationState?: QualificationState,
  qualificationSchema?: QualificationSchema,
  crewMembers?: { role: string; agentSlug: string; agentName: string }[],
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
): string {
  const parts: string[] = [base]

  const turnCount = conversationHistory ? Math.floor(conversationHistory.length / 2) : 0

  if (turnCount > 0) {
    parts.push('', '---INSTRUÇÃO OBRIGATÓRIA---')
    parts.push(`Esta é uma conversa EM ANDAMENTO. Você já realizou ${turnCount} trocas com este lead.`)
    parts.push('PROIBIDO: enviar saudação ou apresentação novamente.')
    parts.push('PROIBIDO: repetir perguntas que já foram respondidas no histórico da conversa.')
    parts.push('PROIBIDO: inventar, supor ou mencionar dados que o lead NÃO forneceu explicitamente nesta conversa.')
    parts.push('OBRIGATÓRIO: analise o histórico completo e continue exatamente de onde parou.')
    parts.push('')
  }

  if (qualificationState) {
    parts.push('---ESTADO DA QUALIFICAÇÃO---')
    if (qualificationState.stage) parts.push(`etapa_atual: ${qualificationState.stage}`)
    if (qualificationState.lastIntent) parts.push(`ultima_intencao: ${qualificationState.lastIntent}`)

    const nonNullFields = Object.entries(qualificationState.fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
    if (nonNullFields.length > 0) {
      parts.push('campos_coletados:')
      if (qualificationSchema) {
        const labelMap = new Map(qualificationSchema.fields.map((f) => [f.key, f.label ?? f.key]))
        nonNullFields.forEach(([k, v]) => parts.push(`  ${labelMap.get(k) ?? k}: ${v}`))
      } else {
        nonNullFields.forEach(([k, v]) => parts.push(`  ${k}: ${v}`))
      }
    }

    if (qualificationSchema && qualificationState) {
      const nextField = pickNextField({ schema: qualificationSchema, state: qualificationState })
      if (nextField) {
        const fieldDef = qualificationSchema.fields.find((f) => f.key === nextField)
        const label = fieldDef?.label ?? nextField
        parts.push(`proximo_campo: ${nextField} (${label})`)
        if (fieldDef?.type === 'enum' && fieldDef.enum) {
          parts.push(`  valores_aceitos: [${fieldDef.enum.join(', ')}]`)
        }
      } else {
        parts.push('proximo_campo: null (qualificação completa)')
      }
    }
    parts.push('')
  }

  if (crewMembers && crewMembers.length > 0) {
    parts.push('---EQUIPE (CREW)---')
    parts.push('Você pode transferir a conversa para os seguintes agentes, caso o assunto seja da especialidade deles:')
    crewMembers.forEach((member) => {
      let desc = `- ${member.agentName} (slug: ${member.agentSlug}, role: ${member.role})`
      if (member.description) desc += `: ${member.description}`
      if (member.operationalFunction) desc += ` [Função: ${member.operationalFunction}]`
      parts.push(desc)
    })
    parts.push('Para transferir, use a tool "transfer_conversation" informando o agentSlug do agente de destino.')
    parts.push('')
  }

  const hasKb = tenantChunks.length > 0 || agentChunks.length > 0
  if (hasKb) {
    parts.push('---CONHECIMENTO RELEVANTE---')
    if (tenantChunks.length > 0) {
      parts.push('[Base de Conhecimento]')
      tenantChunks.forEach((c) => parts.push(c.content))
      parts.push('')
    }
    if (agentChunks.length > 0) {
      parts.push('[Instruções Específicas]')
      agentChunks.forEach((c) => parts.push(c.content))
      parts.push('')
    }
  }

  return parts.join('\n')
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}
