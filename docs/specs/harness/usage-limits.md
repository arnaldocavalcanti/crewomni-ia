# Usage Limits & Quotas

> **Status:** APPROVED  
> **Domínio:** usage-limits  
> **Autor:** @arnaldo  
> **Data:** 2026-06-07  
> **Fase:** 2.5 — Agent Harness Core  
> **Depende de:** observability-tracing spec, ADR 006

---

## 1. Objetivo

Controlar o uso de recursos por tenant — mensagens, tokens e custo LLM — com limites configuráveis, rejeição automática quando a quota é excedida e base para cobrança futura (billing).

---

## 2. Contexto de negócio

Sem quotas, um único tenant pode consumir toda a capacidade da plataforma (mensagens em loop, agente em produção com alto volume, configuração incorreta de automação). Isso gera custo sem controle para a plataforma e degradação de serviço para outros tenants.

Esta spec define a camada de proteção por tenant, integrada ao fluxo de harness, que bloqueia processamento quando limites são excedidos — antes de chamar o LLM.

---

## 3. Problema que resolve

- Tenant sem limite pode gerar custo ilimitado para a plataforma
- Sem dados de uso por tenant, billing é impossível
- Sem rate limit por minuto, picos podem derrubar o serviço
- Sem quotas visíveis no dashboard, tenants não sabem quanto estão consumindo

---

## 4. Regras de negócio

1. Cada tenant tem um `TenantUsageLimit` com limites mensais configuráveis.
2. O `OrchestrateInboundMessage` **verifica quotas antes de chamar LLM** — se excedida, rejeita com `QUOTA_EXCEEDED`.
3. Quota `messagesPerMonth`: máximo de mensagens processadas no mês corrente (calendário UTC).
4. Quota `tokensPerMonth`: máximo de tokens (input + output) no mês corrente.
5. Quota `costPerMonth`: máximo de custo estimado em USD no mês corrente.
6. Quota `messagesPerMinute`: rate limit por janela de 60 segundos (anti-flood).
7. Quando quota é excedida, a mensagem do usuário **é armazenada** (InboundEvent.status = FAILED, error = QUOTA_EXCEEDED) — não é perdida, mas não é processada.
8. Tenant recebe notificação (via webhook futuro / e-mail) ao atingir 80% da quota.
9. PLATFORM_ADMIN pode ajustar limites de qualquer tenant via API.
10. Uso atual é atualizado incrementalmente após cada execução bem-sucedida.
11. Contadores mensais resetam no dia 1 de cada mês (00:00 UTC).
12. Tenant sem `TenantUsageLimit` configurado usa limites padrão globais.
13. `IUsageLimiter.check()` é síncrono e rápido (< 10ms) — usa cache em memória (Redis futuro).

---

## 5. Fluxos principais

### Verificação de quota antes de processar

```
1. OrchestrateInboundMessage chama UsageLimiter.check(tenantId, channel)
2. UsageLimiter:
   a. Carrega TenantUsageLimit do tenant
   b. Carrega TenantUsageCurrent do mês corrente
   c. Verifica messagesPerMonth: current.messages >= limit.messagesPerMonth → QUOTA_EXCEEDED
   d. Verifica costPerMonth: current.estimatedCostUsd >= limit.costPerMonth → QUOTA_EXCEEDED
   e. Verifica messagesPerMinute: current.messagesLastMinute >= limit.messagesPerMinute → RATE_LIMITED
3. Se quota excedida: lança QuotaExceededError(reason)
4. OrchestrateInboundMessage captura → atualiza InboundEvent status=FAILED, error=QUOTA_EXCEEDED
5. Se OK: prossegue com processamento
```

### Atualização de uso após execução

```
1. Após AgentExecutionTrace completado com sucesso:
2. UsageRecorder.record(tenantId, { messages: 1, inputTokens, outputTokens, estimatedCostUsd })
3. TenantUsageCurrent.messages += 1
4. TenantUsageCurrent.totalTokens += inputTokens + outputTokens
5. TenantUsageCurrent.estimatedCostUsd += estimatedCostUsd
6. Persiste (upsert por tenantId + yearMonth)
7. Verifica se chegou a 80% → marca needsNotification=true
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Tenant sem TenantUsageLimit | Usa limites padrão: 1000 msg/mês, 1M tokens/mês, $10/mês |
| Rate limit excedido (messagesPerMinute) | InboundEvent marcado como FAILED, error=RATE_LIMITED; retry automático após 60s |
| PLATFORM_ADMIN aumenta limite durante o mês | Novas mensagens passam a ser processadas imediatamente |
| Uso falha ao registrar (banco indisponível) | Log de erro + alerta; execução continua (best-effort) |
| Tenant solicita histórico de uso | GET /api/v1/tenants/usage?month=2026-06 retorna resumo |

---

## 7. Critérios de aceite

- Dado tenant com messagesPerMonth=100 e current.messages=100, quando nova mensagem chega, então lança QUOTA_EXCEEDED e mensagem não é processada pelo LLM
- Dado tenant com messagesPerMinute=10 e 10 mensagens no último minuto, quando nova mensagem chega, então lança RATE_LIMITED
- Dado tenant sem TenantUsageLimit configurado, quando mensagem chega, então limites padrão globais são aplicados
- Dado execução bem-sucedida, quando UsageRecorder.record é chamado, então current.messages++ e totalTokens acumulam
- Dado tenant atingindo 80% da quota, quando uso é registrado, então needsNotification=true é marcado
- Dado PLATFORM_ADMIN ajustar limite via API, quando verificação ocorre em seguida, então novo limite é aplicado
- Dado tenant A com quota excedida, quando checado, então tenant B não é afetado

---

## 8. Contratos de entrada e saída

```typescript
// Limites configuráveis por tenant
type TenantUsageLimit = {
  id: string
  tenantId: string
  messagesPerMonth: number       // padrão: 1000
  tokensPerMonth: number         // padrão: 1_000_000
  costPerMonthUsd: number        // padrão: 10.0
  messagesPerMinute: number      // padrão: 30
  activeAgents: number           // padrão: 5
  activeConversations: number    // padrão: 100
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Contadores de uso no mês corrente
type TenantUsageCurrent = {
  id: string
  tenantId: string
  yearMonth: string              // '2026-06'
  messages: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  messagesLastMinute: number     // janela deslizante — requer Redis no futuro
  lastMessageAt?: Date
  needsNotification: boolean
  createdAt: Date
  updatedAt: Date
}

// Input do check
type CheckUsageLimitInput = {
  tenantId: string
  channel?: Channel
}

// Output do check
type CheckUsageLimitOutput = {
  allowed: boolean
  reason?: 'QUOTA_MESSAGES' | 'QUOTA_TOKENS' | 'QUOTA_COST' | 'RATE_LIMITED'
  currentUsage: {
    messages: number
    totalTokens: number
    estimatedCostUsd: number
  }
  limit: {
    messagesPerMonth: number
    tokensPerMonth: number
    costPerMonthUsd: number
  }
}

// Input do record
type RecordUsageInput = {
  tenantId: string
  channel: Channel
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

// Erros
type UsageLimitError =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'TENANT_NOT_FOUND'

// Interfaces
interface IUsageLimiter {
  check(input: CheckUsageLimitInput): Promise<CheckUsageLimitOutput>
}

interface IUsageRecorder {
  record(input: RecordUsageInput): Promise<void>
}

interface ITenantUsageLimitRepository {
  findByTenant(tenantId: string): Promise<TenantUsageLimit | null>
  save(limit: TenantUsageLimit): Promise<void>
  update(tenantId: string, partial: Partial<TenantUsageLimit>): Promise<void>
}

interface ITenantUsageCurrentRepository {
  findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null>
  increment(tenantId: string, yearMonth: string, delta: {
    messages?: number
    inputTokens?: number
    outputTokens?: number
    estimatedCostUsd?: number
  }): Promise<void>
}
```

---

## 9. Impacto arquitetural

- [x] Nova entidade: `TenantUsageLimit` — `src/domains/usage-limits/entities/TenantUsageLimit.ts`
- [x] Nova entidade: `TenantUsageCurrent` — `src/domains/usage-limits/entities/TenantUsageCurrent.ts`
- [x] Nova interface: `IUsageLimiter` — `src/domains/usage-limits/IUsageLimiter.ts`
- [x] Nova interface: `IUsageRecorder` — `src/domains/usage-limits/IUsageRecorder.ts`
- [x] Novo use-case: `CheckAndEnforceUsageLimit` — `src/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit.ts`
- [x] Novo use-case: `RecordUsage` — `src/domains/usage-limits/use-cases/RecordUsage.ts`
- [x] Nova infra: `InMemoryUsageLimiter` — `src/infrastructure/rate-limit/InMemoryUsageLimiter.ts`
- [x] Nova infra: `InMemoryUsageRecorder` — `src/infrastructure/rate-limit/InMemoryUsageRecorder.ts`
- [x] Nova infra: `PrismaTenantUsageLimitRepository`
- [x] Nova infra: `PrismaTenantUsageCurrentRepository`
- [x] Modificação: `OrchestrateInboundMessage` chama `IUsageLimiter.check()` antes de LLM
- [x] Modificação: `OrchestrateInboundMessage` chama `IUsageRecorder.record()` após execução
- [x] Novas tabelas Prisma: `tenant_usage_limits`, `tenant_usage_current`
- [x] Nova API route: `GET /api/v1/tenants/usage` — retorna uso do mês corrente (TENANT_ADMIN)
- [x] Nova API route: `PATCH /api/v1/tenants/:id/usage-limit` — configura limites (PLATFORM_ADMIN)
- [x] DI: registrar `IUsageLimiter` e `IUsageRecorder`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Contadores de uso ficarem desatualizados (race condition) | Média | Médio | Operação INCREMENT atômica no banco; Redis com INCR no futuro |
| Tenant legítimo atingir limite padrão muito cedo | Média | Médio | Limites padrão generosos no MVP; tenant pode solicitar aumento |
| messagesLastMinute impreciso com InMemory | Alta | Baixo | InMemory usa Date.now(); Redis sorted sets para precisão em produção |
| Reset mensal falhar | Baixa | Médio | Job cron diário verifica e reseta se necessário; month-keyed por yearMonth |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/usage-limits/`):**
- [x] `CheckAndEnforceUsageLimit deve retornar allowed=false quando messagesPerMonth excedido`
- [x] `CheckAndEnforceUsageLimit deve retornar allowed=false quando costPerMonthUsd excedido`
- [x] `CheckAndEnforceUsageLimit deve retornar allowed=true quando dentro dos limites`
- [x] `CheckAndEnforceUsageLimit deve aplicar limites padrão quando tenant sem configuração`
- [x] `RecordUsage deve incrementar messages, tokens e custo no mês corrente`
- [x] `RecordUsage deve marcar needsNotification=true ao atingir 80% da quota`
- [x] `TenantUsageCurrent deve resetar contadores no novo yearMonth`

**Integração (`tests/integration/usage-limits/`):**
- [x] `tenant A com quota excedida não deve afetar tenant B`
- [x] `GET /api/v1/tenants/usage deve retornar uso apenas do tenant autenticado`
- [x] `PATCH /api/v1/tenants/:id/usage-limit deve requerer role PLATFORM_ADMIN`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** contadores de uso agregados (tokens, custo, mensagens) — sem conteúdo
- **Finalidade:** controle de custo, billing, proteção da plataforma
- **Retenção:** `TenantUsageCurrent` mantido por 24 meses para histórico de billing
- **Exclusão:** dados de uso deletados com o tenant
- **Dados sensíveis:** apenas números agregados — sem PII
- **KDL:** uso médio por nicho (tokens/conversa, custo médio) pode informar pricing de planos

---

## 13. Critérios de isolamento multi-tenant

- `TenantUsageLimit` e `TenantUsageCurrent` isolados por tenantId ✅
- `IUsageLimiter.check()` sempre recebe tenantId explícito ✅
- Contadores de tenant A nunca afetam tenant B ✅
- RLS nas tabelas de uso com policy por tenantId ✅
- API de uso requer sessão autenticada com tenantId do token ✅
