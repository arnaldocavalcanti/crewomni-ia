# Observability & Tracing

> **Status:** APPROVED  
> **Domínio:** observability  
> **Autor:** @arnaldo  
> **Data:** 2026-06-07  
> **Fase:** 2.5 — Agent Harness Core  
> **Depende de:** ADR 006, inbound-event-processing spec

---

## 1. Objetivo

Registrar um trace completo de cada execução do agente — incluindo tempo de fila, tokens usados, custo estimado, modelo LLM, chunks de RAG e erros — para permitir debugging operacional, otimização de custo e análise de qualidade por tenant.

---

## 2. Contexto de negócio

Com WhatsApp em produção, o volume de execuções aumenta drasticamente. Sem observabilidade estruturada:
- Não é possível responder "por que esse agente deu a resposta X?"
- Não é possível calcular custo por tenant (prerequisito para billing)
- Não é possível detectar degradação de qualidade
- Não é possível identificar quais prompts geram mais tokens

O AuditLog atual registra eventos pontuais (ação executada). O tracing registra o **processo de execução** — do inbound ao outbound — com granularidade de milissegundos.

---

## 3. Problema que resolve

- Impossibilidade de debugar respostas incorretas em produção
- Custo LLM não rastreável por tenant/agente/model
- Tempo de processamento não mensurável (fila + LLM + DB)
- Sem dados para otimizar prompts ou escolher modelos mais baratos
- Sem baseline para SLA de atendimento

---

## 4. Regras de negócio

1. Toda execução de agente via harness gera um `AgentExecutionTrace` obrigatório.
2. O trace é registrado mesmo em caso de erro — `status: FAILED` com `error` descritivo.
3. O trace **nunca contém** conteúdo de mensagem em texto plano — apenas IDs e metadados.
4. O custo estimado é calculado com base em tabela de preços configurável (`LLMPricingConfig`).
5. O `durationMs` cobre o tempo total do turno: desde `receivedAt` do InboundEvent até envio da resposta.
6. `queueWaitMs` cobre o tempo entre enqueue e início do processamento.
7. `llmDurationMs` cobre apenas o tempo da chamada LLM.
8. Um `ConversationTrace` agrega múltiplos `AgentExecutionTrace` de uma mesma conversa.
9. Dados de trace são retidos por 90 dias (configurável por tenant).
10. `ITraceLogger` mascara campos sensíveis antes de persistir.
11. Métricas agregadas (`totalTokens`, `totalCost`, `avgDuration`) são calculadas sob demanda via queries.
12. Erros de trace (falha ao salvar) **nunca bloqueam** a execução do agente — trace é best-effort.

---

## 5. Fluxos principais

### Registro de trace em execução normal

```
1. OrchestrateInboundMessage inicia — cria AgentExecutionTrace com status STARTED
2. Registra: inboundEventId, tenantId, conversationId, agentId, channel, promptVersion
3. Após fila: registra queueWaitMs
4. BuildRAGContext executa:
   a. chunksUsed: IDs dos chunks de RAG utilizados
   b. memoryBlocksUsed: quais blocos do prompt hierárquico foram incluídos
5. LLM retorna:
   a. model: 'gpt-4o', 'gpt-4o-mini'
   b. inputTokens: tokens do prompt
   c. outputTokens: tokens da resposta
   d. llmDurationMs
6. Calcula estimatedCostUsd = (inputTokens * inputPrice + outputTokens * outputPrice) / 1000000
7. Atualiza trace: status COMPLETED, durationMs, all fields
8. ConversationTrace.totalCost += estimatedCostUsd
```

### Registro de trace em caso de erro

```
1. Qualquer exceção no fluxo de orquestração é capturada
2. Trace atualizado: status FAILED, error = message, durationMs até o ponto de falha
3. InboundEvent.attemptCount++ → retry na fila
4. Trace persiste mesmo com erro — permite análise pós-mortem
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Falha ao salvar trace no banco | Log no console — execução continua sem interrupção |
| LLM timeout | Trace registrado com status FAILED e error='LLM_TIMEOUT' |
| Retry de InboundEvent | Novo AgentExecutionTrace criado para o novo attempt (não sobrescreve) |
| Tenant desabilitou tracing | Trace criado com apenas campos obrigatórios (id, tenantId, conversationId, status) |

---

## 7. Critérios de aceite

- Dado execução bem-sucedida do agente, quando turno completa, então AgentExecutionTrace é criado com status COMPLETED, tokens, custo e duração
- Dado execução com erro de LLM, quando turno falha, então AgentExecutionTrace é criado com status FAILED e error message — execução não é bloqueada
- Dado falha ao persistir trace, quando banco está indisponível, então agente continua processando (trace é best-effort)
- Dado qualquer trace, quando inspecionado, então não contém conteúdo de mensagem em texto plano
- Dado tenant A, quando consulta métricas, então vê apenas traces de tenant A
- Dado múltiplos turnos numa conversa, quando ConversationTrace é consultado, então totalTokens e totalCost são a soma de todos os AgentExecutionTraces

---

## 8. Contratos de entrada e saída

```typescript
// Status do trace de execução
type TraceStatus = 'STARTED' | 'COMPLETED' | 'FAILED'

// Trace de uma execução de agente (um turno)
type AgentExecutionTrace = {
  id: string
  tenantId: string
  conversationId: string
  inboundEventId?: string
  agentId: string
  crewId?: string
  channel: Channel
  promptVersionId?: string
  model: string                  // 'gpt-4o', 'gpt-4o-mini'
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  chunksUsed: string[]           // IDs dos chunks de RAG
  memoryBlocksUsed: string[]     // 'summary', 'buffer', 'contact_memory', 'rag', 'qualification'
  queueWaitMs?: number
  llmDurationMs?: number
  durationMs: number             // total do turno
  status: TraceStatus
  error?: string
  createdAt: Date
  updatedAt: Date
}

// Trace agregado da conversa
type ConversationTrace = {
  id: string
  tenantId: string
  conversationId: string
  totalTurns: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number
  avgDurationMs: number
  firstTurnAt: Date
  lastTurnAt: Date
  createdAt: Date
  updatedAt: Date
}

// Input para criar trace
type CreateAgentExecutionTraceInput = {
  tenantId: string
  conversationId: string
  inboundEventId?: string
  agentId: string
  crewId?: string
  channel: Channel
  promptVersionId?: string
}

// Input para completar trace
type CompleteAgentExecutionTraceInput = {
  id: string
  tenantId: string
  model: string
  inputTokens: number
  outputTokens: number
  chunksUsed: string[]
  memoryBlocksUsed: string[]
  queueWaitMs?: number
  llmDurationMs?: number
  durationMs: number
  status: 'COMPLETED' | 'FAILED'
  error?: string
}

// Tabela de preços LLM
type LLMPricingConfig = {
  model: string
  inputPricePerMillion: number   // USD por 1M tokens de entrada
  outputPricePerMillion: number  // USD por 1M tokens de saída
}

// Interface do repositório
interface ITraceRepository {
  createExecutionTrace(input: CreateAgentExecutionTraceInput): Promise<AgentExecutionTrace>
  completeExecutionTrace(input: CompleteAgentExecutionTraceInput): Promise<void>
  findExecutionTracesByConversation(conversationId: string, tenantId: string): Promise<AgentExecutionTrace[]>
  upsertConversationTrace(conversationId: string, tenantId: string, delta: Partial<ConversationTrace>): Promise<void>
  findConversationTrace(conversationId: string, tenantId: string): Promise<ConversationTrace | null>
  // Agregações
  getTenantUsageSummary(tenantId: string, from: Date, to: Date): Promise<{
    totalTokens: number
    totalCostUsd: number
    totalConversations: number
    totalTurns: number
  }>
}

// Interface do logger de trace (mascara campos sensíveis)
interface ITraceLogger {
  log(event: TraceEvent): void
}

type TraceEvent = {
  level: 'info' | 'warn' | 'error'
  traceId: string
  tenantId: string
  event: string
  durationMs?: number
  metadata?: Record<string, unknown>  // sem PII aqui
}
```

---

## 9. Impacto arquitetural

- [x] Nova entidade: `AgentExecutionTrace` — `src/domains/observability/entities/AgentExecutionTrace.ts`
- [x] Nova entidade: `ConversationTrace` — `src/domains/observability/entities/ConversationTrace.ts`
- [x] Nova entidade: `LLMPricingConfig` — `src/domains/observability/entities/LLMPricingConfig.ts`
- [x] Nova interface: `ITraceRepository` — `src/domains/observability/repositories/ITraceRepository.ts`
- [x] Nova interface: `ITraceLogger` — `src/domains/observability/ITraceLogger.ts`
- [x] Novo use-case: `RecordExecutionTrace` — `src/domains/observability/use-cases/RecordExecutionTrace.ts`
- [x] Nova infra: `InMemoryTraceRepository` — `src/infrastructure/db/repositories/InMemoryTraceRepository.ts`
- [x] Nova infra: `PrismaTraceRepository` — `src/infrastructure/db/repositories/PrismaTraceRepository.ts`
- [x] Nova infra: `ConsoleTraceLogger` — `src/infrastructure/observability/ConsoleTraceLogger.ts`
- [x] Modificação: `OrchestrateInboundMessage` cria e completa trace a cada turno
- [x] Modificação: `BuildRAGContext` retorna `chunksUsed` e `memoryBlocksUsed` no output
- [x] Novas tabelas Prisma: `agent_execution_traces`, `conversation_traces`
- [x] DI: registrar `ITraceRepository` e `RecordExecutionTrace`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Volume de traces crescer rapidamente e sobrecarregar banco | Alta | Médio | Retenção de 90 dias; partition por tenant e data no futuro |
| Custo estimado divergir do custo real (OpenAI muda preços) | Média | Baixo | LLMPricingConfig é configurável; revisão mensal |
| Trace vazar conteúdo de mensagem | Baixa | Alto | ITraceLogger mascara campos sensíveis; code review obrigatório |
| Falha de trace bloquear execução | Baixa | Alto | try/catch isolado em RecordExecutionTrace — never throws |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/observability/`):**
- [x] `RecordExecutionTrace deve criar trace com status STARTED`
- [x] `RecordExecutionTrace deve completar trace com tokens e custo calculado`
- [x] `RecordExecutionTrace deve registrar trace mesmo em caso de erro de LLM`
- [x] `RecordExecutionTrace falha ao salvar não deve lançar exceção`
- [x] `estimatedCostUsd deve ser calculado corretamente com LLMPricingConfig`
- [x] `ITraceLogger deve mascarar campos sensíveis antes de log`
- [x] `ConversationTrace deve acumular totalTokens e totalCostUsd corretamente`

**Integração (`tests/integration/observability/`):**
- [x] `tenant A não deve ver traces de tenant B`
- [x] `getTenantUsageSummary deve retornar soma correta de tokens e custo no período`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** metadados de execução (tokens, custo, duração, IDs) — sem conteúdo de mensagem
- **Finalidade:** debugging operacional, billing, otimização de custo
- **Retenção:** 90 dias (configurável); depois arquivamento em cold storage
- **Exclusão:** traces deletados com o tenant (cascata)
- **Dados sensíveis:** ITraceLogger proibido de logar `rawPayload`, `normalizedPayload.text`, conteúdo de mensagem
- **KDL:** agregados anonimizados (custo médio por nicho, modelo mais usado) podem alimentar Industry KB

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` em todos os queries de trace ✅
- `getTenantUsageSummary` filtra obrigatoriamente por tenantId ✅
- Acesso a trace de outro tenant retorna 404 ✅
- RLS nas tabelas `agent_execution_traces` e `conversation_traces` ✅
- Campos de custo nunca cruzam entre tenants ✅
