# Inbound Event Processing

> **Status:** APPROVED  
> **Domínio:** channel  
> **Autor:** @arnaldo  
> **Data:** 2026-06-07  
> **Fase:** 2.5 — Agent Harness Core  
> **Depende de:** ADR 006, conversation-lifecycle spec

---

## 1. Objetivo

Receber eventos de mensagem de qualquer canal (WhatsApp, e-mail, widget), garantir idempotência, normalizar o payload e enfileirar para processamento assíncrono — tudo em < 300ms, sem chamar LLM dentro do webhook.

---

## 2. Contexto de negócio

Canais externos como WhatsApp enviam webhooks que precisam de resposta imediata (< 5s). O processamento do agente pode levar 8–30s. Sem separação entre recebimento e processamento, o canal reenvia o evento, o agente responde múltiplas vezes e o custo aumenta exponencialmente. Esta spec define a camada de recebimento responsável por:

1. Validar a origem do evento
2. Garantir que o mesmo evento não seja processado duas vezes
3. Armazenar o evento bruto para auditoria
4. Normalizar para um formato interno independente do canal
5. Enfileirar para processamento

---

## 3. Problema que resolve

- Duplicate webhooks geram respostas duplicadas do agente
- LLM chamado dentro do webhook causa timeout e mais duplicações
- Sem registro do evento bruto, não há como auditar ou reprocessar
- Cada canal tem formato diferente — sem normalização, o processamento vira um switch/case gigante
- Sem fila, falhas de LLM ou banco perdem a mensagem permanentemente

---

## 4. Regras de negócio

1. Um `InboundEvent` com `(tenantId, provider, providerMessageId)` idêntico a um já existente **não é reprocessado** — retorna sucesso silencioso com `status: IGNORED_DUPLICATE`.
2. O `tenantId` **nunca** vem do corpo do webhook — é resolvido pelo token/API-key/segredo do provider.
3. O evento bruto (`rawPayload`) é armazenado antes de qualquer processamento.
4. O webhook responde HTTP 200 em < 300ms, independente do tempo de processamento do agente.
5. Não chamar LLM, não chamar `SendMessage` dentro do webhook handler.
6. O `normalizedPayload` segue o formato `NormalizedMessage` — independente de canal.
7. Um evento com assinatura inválida retorna 401 e **não** é armazenado.
8. Um evento em formato inválido (parse fail) é armazenado com `status: FAILED` e `error` descritivo.
9. Após normalização e idempotência OK, o evento é enfileirado na fila `inbound-message`.
10. O status evolui: `RECEIVED → QUEUED → PROCESSING → PROCESSED | FAILED → DEAD_LETTER`.
11. Após 3 tentativas falhadas de processamento, o evento move para `DEAD_LETTER`.
12. Eventos em `DEAD_LETTER` podem ser reprocessados manualmente por `PLATFORM_ADMIN`.
13. `tenantId` presente em todos os queries e registros — isolamento multi-tenant inviolável.

---

## 5. Fluxos principais

### Recebimento via webhook WhatsApp

```
1. POST /api/v1/channels/whatsapp/webhook recebe payload do Meta
2. WhatsAppWebhookAdapter valida assinatura HMAC-SHA256 com WHATSAPP_APP_SECRET
3. Se assinatura inválida → retorna 401
4. Para cada mensagem no payload:
   a. Extrai providerMessageId + contactExternalId + text
   b. Resolve tenantId via X-Hub-Signature secret mapeado no DB
   c. Chama ReceiveInboundEvent(channel: WHATSAPP, ...)
5. ReceiveInboundEvent:
   a. Persiste InboundEvent com status RECEIVED e rawPayload
   b. Verifica índice único (tenantId, WHATSAPP, providerMessageId)
   c. Se duplicado → atualiza status para IGNORED_DUPLICATE, retorna
   d. Normaliza payload para NormalizedMessage
   e. Atualiza normalizedPayload no InboundEvent
   f. Enfileira job { inboundEventId } na fila inbound-message
   g. Atualiza status para QUEUED
6. Webhook retorna 200 OK {"status": "accepted"}
```

### Processamento do job (worker assíncrono)

```
1. Worker consome job { inboundEventId } da fila inbound-message
2. Carrega InboundEvent do banco
3. Atualiza status para PROCESSING
4. Chama OrchestrateInboundMessage(normalizedPayload, tenantId, channel)
5. Em caso de sucesso: status → PROCESSED, processedAt = now()
6. Em caso de falha: incrementa attemptCount
   a. attemptCount < 3: requeue com backoff exponencial
   b. attemptCount >= 3: status → DEAD_LETTER
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Assinatura HMAC inválida | Retorna 401, nada armazenado |
| Payload malformado (não parseable) | Armazena com status FAILED, error = parse error message |
| `providerMessageId` duplicado | Status IGNORED_DUPLICATE, retorna 200 sem processar |
| Enqueue falha (Redis down) | Armazena evento com status RECEIVED (não QUEUED), retry na próxima varredura |
| Worker falha 1–2x | Requeue com backoff: 1s, 4s |
| Worker falha 3x | Status DEAD_LETTER, alerta via observability |
| Reprocessamento manual de DEAD_LETTER | PLATFORM_ADMIN chama RepublishDeadLetterEvent → status volta para QUEUED |

---

## 7. Critérios de aceite

- Dado um webhook com assinatura válida e providerMessageId novo, quando ReceiveInboundEvent é chamado, então o evento é armazenado com status QUEUED e um job é enfileirado
- Dado um webhook com o mesmo providerMessageId já processado, quando ReceiveInboundEvent é chamado, então retorna sucesso com status IGNORED_DUPLICATE sem enfileirar
- Dado um webhook com assinatura inválida, quando o handler valida, então retorna 401 e nada é armazenado
- Dado um job que falha 3 vezes consecutivas, quando o worker processa, então o evento move para DEAD_LETTER
- Dado um InboundEvent em DEAD_LETTER, quando PLATFORM_ADMIN republica, então o status volta para QUEUED e um novo job é enfileirado
- Dado um tenant A e um tenant B, quando B tenta acessar InboundEvent de A por id, então retorna 404
- Dado um webhook com tenantId no body, quando processado, então o tenantId do body é ignorado e o tenantId real é resolvido pelo secret do provider

---

## 8. Contratos de entrada e saída

```typescript
// Entidade
type InboundEventStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'IGNORED_DUPLICATE'

type Channel = 'WHATSAPP' | 'EMAIL' | 'WIDGET' | 'API'

type InboundEvent = {
  id: string
  tenantId: string
  channel: Channel
  provider: string            // 'meta', 'twilio', 'sendgrid'
  providerMessageId: string   // ID do provider — usado para idempotência
  providerConversationId?: string
  contactExternalId: string   // +5511999999999 no WhatsApp
  rawPayload: Record<string, unknown>
  normalizedPayload?: NormalizedMessage
  status: InboundEventStatus
  attemptCount: number
  receivedAt: Date
  processedAt?: Date
  error?: string
  createdAt: Date
  updatedAt: Date
}

// Mensagem normalizada (independente de canal)
type NormalizedMessage = {
  text: string
  mediaUrl?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document'
  replyToMessageId?: string
  metadata?: Record<string, unknown>
}

// Input do use-case
type ReceiveInboundEventInput = {
  tenantId: string           // resolvido pelo adapter, nunca do body
  channel: Channel
  provider: string
  providerMessageId: string
  providerConversationId?: string
  contactExternalId: string
  rawPayload: Record<string, unknown>
}

// Output do use-case
type ReceiveInboundEventOutput = {
  inboundEventId: string
  status: 'QUEUED' | 'IGNORED_DUPLICATE' | 'FAILED'
  isDuplicate: boolean
}

// Erros esperados
type ReceiveInboundEventError =
  | 'INVALID_SIGNATURE'
  | 'TENANT_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'QUEUE_UNAVAILABLE'

// Interface do repositório
interface IInboundEventRepository {
  save(event: InboundEvent): Promise<void>
  findByProviderMessageId(
    tenantId: string,
    provider: string,
    providerMessageId: string
  ): Promise<InboundEvent | null>
  findById(id: string, tenantId: string): Promise<InboundEvent | null>
  updateStatus(
    id: string,
    status: InboundEventStatus,
    extra?: { processedAt?: Date; error?: string; attemptCount?: number }
  ): Promise<void>
  updateNormalized(id: string, normalized: NormalizedMessage): Promise<void>
  findDeadLetters(tenantId: string, limit: number): Promise<InboundEvent[]>
}

// Interface da fila
interface IQueueProvider {
  enqueue(queueName: string, payload: Record<string, unknown>): Promise<string>
  process(
    queueName: string,
    handler: (payload: Record<string, unknown>) => Promise<void>
  ): void
}
```

---

## 9. Impacto arquitetural

- [x] Nova entidade: `InboundEvent` — `src/domains/channel/entities/InboundEvent.ts`
- [x] Novo enum: `Channel` — `src/domains/channel/entities/Channel.ts`
- [x] Novo enum: `InboundEventStatus` — `src/domains/channel/entities/InboundEvent.ts`
- [x] Nova interface: `IInboundEventRepository` — `src/domains/channel/repositories/IInboundEventRepository.ts`
- [x] Novo use-case: `ReceiveInboundEvent` — `src/domains/channel/use-cases/ReceiveInboundEvent.ts`
- [x] Nova infra: `InMemoryInboundEventRepository` — `src/infrastructure/db/repositories/InMemoryInboundEventRepository.ts`
- [x] Nova infra: `PrismaInboundEventRepository` — `src/infrastructure/db/repositories/PrismaInboundEventRepository.ts`
- [x] Nova interface: `IQueueProvider` — `src/infrastructure/queues/IQueueProvider.ts`
- [x] Nova infra: `InMemoryQueueProvider` — `src/infrastructure/queues/InMemoryQueueProvider.ts`
- [x] Nova tabela Prisma: `InboundEvent` com índice único `(tenantId, provider, providerMessageId)`
- [x] Nova API route: `POST /api/v1/channels/whatsapp/webhook`
- [x] Novo adapter: `WhatsAppWebhookAdapter` — `src/infrastructure/channels/whatsapp/WhatsAppWebhookAdapter.ts`
- [x] DI: registrar `ReceiveInboundEvent` e `IQueueProvider`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Meta reenviar evento após job já enfileirado mas antes de status atualizar para QUEUED | Média | Médio | Índice único por (tenantId, provider, providerMessageId) previne duplicação no banco |
| InMemoryQueueProvider processar síncronamente e tornar testes lentos | Baixa | Baixo | Configurar processamento lazy (após retorno do use-case) |
| rawPayload conter dados sensíveis (CPF, cartão) | Média | Alto | Mascaramento antes de log; retenção de rawPayload limitada a 30 dias |
| Índice único falhar em migração com dados existentes | Baixa | Médio | Migration incremental com CONCURRENTLY |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/channel/`):**
- [x] `ReceiveInboundEvent deve armazenar evento com status QUEUED e retornar isDuplicate=false`
- [x] `ReceiveInboundEvent deve retornar IGNORED_DUPLICATE para providerMessageId já existente`
- [x] `ReceiveInboundEvent deve armazenar rawPayload antes de normalizar`
- [x] `ReceiveInboundEvent deve enfileirar job com inboundEventId correto`
- [x] `ReceiveInboundEvent deve ignorar tenantId vindo do rawPayload`
- [x] `InboundEvent deve rejeitar status PROCESSED sem processedAt`
- [x] `InboundEvent deve incrementar attemptCount a cada falha de processamento`
- [x] `InboundEvent deve mover para DEAD_LETTER após 3 tentativas`

**Integração (`tests/integration/channel/`):**
- [x] `tenant A não deve acessar InboundEvent de tenant B por id`
- [x] `POST /api/v1/channels/whatsapp/webhook com assinatura inválida retorna 401`
- [x] `POST /api/v1/channels/whatsapp/webhook com payload válido retorna 200 em < 300ms`
- [x] `POST /api/v1/channels/whatsapp/webhook com providerMessageId duplicado retorna 200 sem reprocessar`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** texto da mensagem, número de telefone (contactExternalId), payload bruto do provider
- **Finalidade:** processamento pelo agente de IA, auditoria, reprocessamento em caso de falha
- **Retenção:** `rawPayload` retido por 30 dias; `normalizedPayload` retido durante lifecycle da conversa
- **Exclusão:** direito ao esquecimento cobre InboundEvents do tenant; cascata via FK
- **Dados sensíveis:** telefone e nome no rawPayload; mascarar em logs de trace
- **KDL:** rawPayload nunca alimenta KDL; apenas insights anonimizados da conversa processada

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todos os queries: `findByProviderMessageId(tenantId, ...)` ✅
- RLS deve cobrir tabela `inbound_events`: `tenantId` com policy SELECT/INSERT ✅
- Cache (futuro) usa prefixo `tenant:{tenantId}:inbound:` ✅
- Audit log registra `tenantId` em todos os eventos de InboundEvent ✅
- Testes de isolamento: tenant A não acessa InboundEvent de tenant B ✅
- `tenantId` resolvido pelo adapter a partir do token/secret do provider, nunca do body ✅
