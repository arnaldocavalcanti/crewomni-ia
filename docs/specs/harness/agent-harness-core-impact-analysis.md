# Agent Harness Core — Análise de Impacto Arquitetural

> **Status:** APPROVED  
> **Data:** 2026-06-07  
> **Autor:** @arnaldo  
> **Fase:** 2.5 — Agent Harness Core  

---

## 1. Diagnóstico da Arquitetura Atual

### O que existe

| Componente | Estado | Localização |
|---|---|---|
| Agent Builder | ✅ Completo | `src/domains/agent/` |
| Crew Builder | ✅ Completo | `src/domains/crew/` |
| Conversation Audit | ✅ Completo | `src/domains/conversation/` |
| RAG Orchestrator | ✅ Completo | `src/domains/knowledge/` |
| QualificationState | ✅ Completo | `src/domains/qualification/` |
| SendMessage use-case | ✅ Completo | `src/domains/conversation/use-cases/SendMessage.ts` |
| TransferConversation | ✅ Completo | `src/domains/conversation/use-cases/TransferConversation.ts` |
| ILLMProvider | ✅ Completo | `src/shared/types/ILLMProvider.ts` |
| IEmbeddingProvider | ✅ Completo | `src/shared/types/IEmbeddingProvider.ts` |
| Chat Widget público | ✅ Completo | `src/app/api/v1/widget/` |
| AuditLog | ✅ Completo | `src/infrastructure/audit/` |
| Docker + pgvector | ✅ Completo | `docker-compose.yml` |

### Modelo de dados existente (Conversation)

```typescript
// src/domains/conversation/entities/Conversation.ts
ConversationStatus: OPEN | CLOSED

// Conversation possui:
// id, tenantId, agentId, crewId?, externalUserId?, status, createdAt, updatedAt
```

O modelo atual é adequado para chat síncrono via dashboard, mas insuficiente para canais assíncronos como WhatsApp.

---

## 2. Lacunas Identificadas para WhatsApp em Produção

### 2.1. Processamento síncrono no webhook (BLOQUEADOR CRÍTICO)

**Situação atual:**  
`POST /api/v1/conversations/message` → `SendMessage` → LLM call → resposta HTTP.

**Problema:**  
WhatsApp exige resposta ao webhook em **< 5 segundos**. Uma chamada ao GPT-4 pode levar 8–30s. O webhook vai expirar, re-enviar o evento, e o agente vai processar a mesma mensagem N vezes.

**Gap:** Não existe separação entre recebimento e processamento. Não existe fila.

---

### 2.2. Sem idempotência (BLOQUEADOR CRÍTICO)

**Situação atual:**  
Toda chamada a `SendMessage` cria uma nova mensagem.

**Problema:**  
WhatsApp reenvia webhooks em caso de timeout ou falha. Sem idempotência, o mesmo webhook cria múltiplas mensagens do usuário e múltiplas chamadas ao LLM.

**Gap:** Não existe entidade `InboundEvent` com índice único por `(tenantId, provider, providerMessageId)`.

---

### 2.3. Sem identidade de contato (BLOQUEADOR FUNCIONAL)

**Situação atual:**  
`Conversation` possui `externalUserId?: string` — um campo livre sem entidade estruturada.

**Problema:**  
Um número de WhatsApp (+5511999999999) precisa ser mapeado para um `Contact` persistido, que pode ter múltiplas conversas ao longo do tempo, múltiplos canais (WhatsApp + e-mail), e dados de qualificação acumulados.

**Gap:** Não existe entidade `Contact` nem `ContactChannelIdentity`.

---

### 2.4. Lifecycle de conversa insuficiente (BLOQUEADOR FUNCIONAL)

**Situação atual:**  
`ConversationStatus: OPEN | CLOSED`

**Problema:**  
WhatsApp precisa de estados como `WAITING_USER`, `WAITING_HUMAN`, `HANDOFF_REQUESTED`, `REOPENED`. Sem esses estados, o agente pode responder quando um humano já assumiu o atendimento — situação inaceitável.

**Gap:** O enum `ConversationStatus` precisa ser expandido e as transições precisam ser regidas por um use-case dedicado.

---

### 2.5. Sem política de memória/contexto (DÍVIDA TÉCNICA)

**Situação atual:**  
`SendMessage` carrega as últimas N mensagens da conversa diretamente no prompt. Sem limite de tokens explícito. Sem summary. Sem memória durável por contato.

**Problema:**  
Conversas longas no WhatsApp (dias/semanas) vão estourar o contexto do LLM. Sem summary, o agente perde contexto. Sem memória durável, o agente trata cada conversa como fresh start.

**Gap:** Não existe `IMemoryPolicyEngine`, `ConversationSummary` nem `ContactMemory`.

---

### 2.6. Sem retry e Dead Letter Queue (BLOQUEADOR OPERACIONAL)

**Situação atual:**  
Se `SendMessage` falhar (timeout do LLM, erro de DB), a mensagem é simplesmente perdida. Não há retry.

**Gap:** Sem fila, não há como implementar retry. Sem DLQ, mensagens que falharam consistentemente somem silenciosamente.

---

### 2.7. Observabilidade insuficiente (DÍVIDA TÉCNICA)

**Situação atual:**  
`AuditLog` registra ações pontuais. Não há trace de execução com tempo de fila, tempo de LLM, tokens, custo, modelo, prompt version.

**Gap:** Sem `ConversationTrace` e `AgentExecutionTrace`, é impossível debugar problemas em produção ou otimizar custo por tenant.

---

### 2.8. Sem controle de uso e quotas (RISCO DE NEGÓCIO)

**Situação atual:**  
Nenhum tenant tem limite de mensagens, tokens ou custo. Qualquer tenant pode usar ilimitadamente.

**Gap:** Sem `IUsageLimiter` e `IUsageRecorder`, um único tenant pode esgotar toda a capacidade da plataforma.

---

### 2.9. Sem abstração de canal (DÍVIDA ARQUITETURAL)

**Situação atual:**  
O código fala diretamente em `agentId`, `message`, sem conceito de `Channel`, `InboundMessage` normalizada ou `OutboundMessage`.

**Gap:** Se amanhã vier e-mail ou SMS, será necessário criar toda a lógica de zero para cada canal. A arquitetura deve falar em `Channel` abstrato, com WhatsApp sendo apenas um adapter.

---

### 2.10. Handoff humano sem suporte estrutural (RISCO FUNCIONAL)

**Situação atual:**  
`TransferConversation` transfere entre agentes de uma crew. Não há suporte a handoff para humano real.

**Gap:** Não existe `RequestHumanHandoff` use-case, nem estados de conversa para handoff, nem mecanismo de notificação ao operador humano.

---

## 3. Módulos Afetados

| Módulo | Tipo de impacto | Ação necessária |
|---|---|---|
| `domains/conversation/entities/Conversation.ts` | Modificação | Expandir `ConversationStatus` |
| `domains/conversation/repositories/IConversationRepository.ts` | Modificação | Adicionar métodos de lifecycle |
| `infrastructure/di/index.ts` | Modificação | Registrar novos use-cases |
| `prisma/schema.prisma` | Modificação | Adicionar 6+ novos modelos |
| `app/api/v1/conversations/message/route.ts` | Modificação | Proteger contra estados WAITING_HUMAN |
| **NOVOS** `domains/channel/` | Criação | InboundEvent, channel enum, repos, use-cases |
| **NOVOS** `domains/contact/` | Criação | Contact, ContactChannelIdentity |
| **NOVOS** `domains/conversation-lifecycle/` | Criação | ApplyLifecycleTransition |
| **NOVOS** `domains/memory-policy/` | Criação | ConversationSummary, IMemoryPolicyEngine |
| **NOVOS** `domains/observability/` | Criação | ConversationTrace, AgentExecutionTrace |
| **NOVOS** `infrastructure/channels/whatsapp/` | Criação | Adapter, normalizer, dispatcher |
| **NOVOS** `infrastructure/queues/` | Criação | IQueueProvider, InMemoryQueueProvider |
| **NOVOS** `infrastructure/rate-limit/` | Criação | IUsageLimiter, InMemoryUsageLimiter |
| **NOVOS** `app/api/v1/channels/` | Criação | Webhook route WhatsApp |

---

## 4. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Quebrar `SendMessage` existente ao expandir lifecycle | Alta | Alto | Manter backward-compat: novos estados são opcionais; OPEN/CLOSED continuam funcionando |
| Migration Prisma com tabelas existentes com dados | Média | Alto | Usar `DEFAULT` nos novos campos, migrations com rollback plan |
| Fila InMemory não escala para produção | Alta (intencional) | Médio | IQueueProvider permite trocar para BullMQ sem mudar domínio |
| WhatsApp mudar payload de webhook | Média | Médio | Normalizer isola o parse; domínio não conhece formato do provider |
| LLM timeout > 5s vs webhook window | Alta | Alto | Fila resolve: webhook responde imediatamente, processamento é assíncrono |
| Dados sensíveis vazarem em logs de trace | Média | Alto | ITraceLogger mascara campos sensíveis; política LGPD explícita |
| Tenant sem quota esgotar LLM budget | Baixa (sem quotas) | Crítico | Fase F implementa IUsageLimiter com limites conservadores por padrão |

---

## 5. Decisões Necessárias (antes de implementar)

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D1 | Fila inicial: InMemory vs BullMQ | InMemory (dev) / BullMQ (prod) | InMemory com IQueueProvider abstrata — BullMQ adapter na Fase G |
| D2 | Summary: quando disparar | Após X mensagens / X tokens / ao fechar | 20 mensagens OU 4000 tokens — configurável por tenant |
| D3 | ContactMemory: aprovação automática ou manual | Automático / KDL_APPROVER | Manual para dados sensíveis, automático para metadados de qualificação |
| D4 | Tracing: armazenar no Prisma ou external | Prisma / DataDog / OpenTelemetry | Prisma MVP; interface permite trocar no futuro |
| D5 | Handoff: notificação do operador humano | Polling dashboard / WebSocket / WhatsApp | Polling no dashboard MVP; WebSocket na Fase 3 |

---

## 6. Proposta de Implementação Incremental

### Fase A — Modelagem e interfaces (zero runtime, 100% tipos)
Criar todas as entidades, enums e interfaces. Sem implementações concretas ainda.  
**Critério:** código compila, testes de tipos passam.

### Fase B — InboundEvent + idempotência
InMemoryInboundEventRepository + PrismaInboundEventRepository + migration.  
**Critério:** webhook duplicado não é processado duas vezes.

### Fase C — InMemoryQueueProvider
Fila síncrona para desenvolvimento. IQueueProvider abstrata.  
**Critério:** job enfileirado é processado; BullMQ pode ser plugado sem alterar domínio.

### Fase D — ReceiveInboundEvent use-case
Recebe, valida, armazena bruto, verifica idempotência, normaliza, enfileira.  
**Critério:** use-case testado unitariamente; webhook responde < 100ms.

### Fase E — Conversation Lifecycle
ApplyLifecycleTransition com todas as transições válidas.  
**Critério:** agente não responde quando conversa em WAITING_HUMAN.

### Fase F — Contact Identity
ResolveOrCreateContact com InMemory + Prisma.  
**Critério:** mesmo número WhatsApp sempre resolve para o mesmo Contact.

### Fase G — Memory Policy Engine
ConversationSummary + ApplyMemoryPolicy.  
**Critério:** contexto do prompt nunca excede limite de tokens configurado.

### Fase H — Observabilidade básica
ConversationTrace + AgentExecutionTrace + InMemoryTraceRepository.  
**Critério:** toda execução de agente gera trace com tokens, custo estimado, duração.

### Fase I — WhatsApp webhook route
`POST /api/v1/channels/whatsapp/webhook` — valida assinatura, chama ReceiveInboundEvent.  
**Critério:** webhook do Meta responde 200 em < 200ms.

### Fase J — BullMQ/Redis adapter + smoke test
IQueueProvider → BullMQ. Smoke test do fluxo completo.  
**Critério:** fluxo completo WhatsApp → fila → agente → resposta funcionando.

---

## 7. Dependências Externas

| Dependência | Fase | Justificativa |
|---|---|---|
| Redis | Fase J | BullMQ requer Redis. Docker compose já tem slot. |
| Meta WhatsApp Business API | Fase I | Sandbox de teste disponível via Meta for Developers. |
| `bullmq` package | Fase J | `npm install bullmq` |
| `ioredis` package | Fase J | Cliente Redis para BullMQ |
| OpenTelemetry (futuro) | Fase 3+ | Tracing distribuído — não necessário no MVP |

---

## 8. Resumo Executivo

O projeto está sólido para chat síncrono via dashboard e widget. Para WhatsApp em produção, **10 lacunas estruturais** precisam ser endereçadas. Nenhuma delas quebra o que já existe — são todas adições. A estratégia recomendada é criar a harness como uma **camada intermediária** que envolve o `SendMessage` existente, adicionando:

1. **Idempotência** (InboundEvent)
2. **Fila** (IQueueProvider)
3. **Lifecycle** (ConversationStatus expandido)
4. **Identidade de contato** (Contact + ContactChannelIdentity)
5. **Política de memória** (IMemoryPolicyEngine)
6. **Observabilidade** (ConversationTrace)
7. **Quotas** (IUsageLimiter)
8. **Abstração de canal** (Channel enum + normalizer)

O `SendMessage` atual **não é modificado** na sua assinatura — ele continua sendo o executor. A harness apenas orquestra o fluxo antes e depois dele.
