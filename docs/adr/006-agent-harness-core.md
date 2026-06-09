# ADR 006 — Agent Harness Core

> **Status:** ACCEPTED  
> **Data:** 2026-06-07  
> **Contexto:** Fase 2.5 — preparar arquitetura para WhatsApp e canais assíncronos  
> **Depende de:** ADR 001 (decisões técnicas), ADR 002 (tenant resolution), ADR 004 (prompt hierárquico)

---

## Contexto

O projeto possui uma implementação sólida de Agent Builder, Crew Builder, RAG Orchestrator e Conversation Audit. O fluxo atual é:

```
HTTP Request → SendMessage → LLM → HTTP Response
```

Esse modelo funciona para o dashboard (chat síncrono, latência tolerável). Não funciona para WhatsApp por razões estruturais:

1. **Janela de 5 segundos**: Meta exige resposta ao webhook em < 5s. LLM pode levar 8–30s.
2. **Reenvio de webhooks**: Timeout faz o Meta reenviar o mesmo evento — sem idempotência, isso cria respostas duplicadas.
3. **Canal sem sessão HTTP**: WhatsApp não tem "request/response" persistente. É um evento unidirecional.
4. **Lifecycle complexo**: Uma conversa pode durar dias, ter handoff humano, ser reaberta, ter mudança de agente.
5. **Volume e picos**: WhatsApp pode receber rajadas de mensagens simultâneas de múltiplos tenants.

Além disso, a arquitetura atual não possui:
- Identidade de contato persistida (um número de WhatsApp é só uma string)
- Política explícita de contexto (sem summary, sem memória durável)
- Observabilidade por execução (sem trace de tokens/custo/tempo)
- Controle de uso por tenant (sem quotas)
- Abstração de canal (tudo hardcoded para HTTP)

---

## Decisão

**Criar uma camada de Agent Harness Core** como intermediário entre os canais de entrada e o pipeline de processamento do agente.

### Princípio fundamental

```
Canal → Harness → Agente
```

O Harness não substitui o `SendMessage`. Ele o **envolve** com:
- validação de entrada
- idempotência
- fila
- lifecycle
- contexto
- observabilidade

O `SendMessage` continua sendo o executor de LLM. A harness é a **camada operacional** que o alimenta.

---

## Por que webhook não pode chamar LLM diretamente

### Problema de timeout

```
POST /webhook (Meta)
  → Deve responder em < 5s
  → LLM call: 8-30s
  → Meta marca como falha, reenvia
  → Agente processa 2x, 3x, N vezes
```

### Solução: fire-and-forget com fila

```
POST /webhook (Meta)
  → Valida assinatura (50ms)
  → Armazena evento bruto (100ms)
  → Verifica idempotência (50ms)
  → Enfileira job (20ms)
  → Responde 200 OK (< 300ms total)

[Background worker]
  → Consome job da fila
  → Resolve tenant, contact, conversation
  → Aplica lifecycle e contexto
  → Chama SendMessage → LLM
  → Enfileira resposta de saída
  → Worker de saída envia via WhatsApp API
```

---

## Por que idempotência é obrigatória

O Meta WhatsApp Business API **garante** o seguinte comportamento:
- Se o webhook não receber 200 em 5s, ele reenvia
- O mesmo evento pode ser entregue 2–3 vezes em caso de instabilidade de rede
- A ordem de entrega não é garantida

Sem `InboundEvent` com índice único `(tenantId, provider, providerMessageId)`:
- Mensagem duplicada → 2 respostas do agente → cliente confuso
- Mensagem duplicada → 2 chamadas LLM → custo dobrado

A idempotência deve ser verificada **antes** de qualquer processamento, incluindo antes de enfileirar.

---

## Por que usar fila

### Razões técnicas
1. **Desacoplamento**: webhook responde imediatamente; processamento acontece em background
2. **Retry**: falha no LLM ou no banco não perde a mensagem — ela fica na fila para retry
3. **Dead Letter Queue**: após N falhas, mensagem vai para DLQ para inspeção manual
4. **Backpressure**: fila absorve picos de tráfego sem derrubar o serviço
5. **Observabilidade**: posição na fila, tempo de espera, tempo de processamento são mensuráveis

### Decisão de implementação
- **Fase inicial**: `InMemoryQueueProvider` — síncrono, sem dependências externas, para desenvolvimento e testes
- **Fase produção**: `BullMQQueueProvider` — Redis-backed, retry nativo, DLQ, dashboard
- **Interface**: `IQueueProvider` — domínio nunca importa BullMQ diretamente

---

## Como isso prepara WhatsApp

O webhook do WhatsApp é apenas um adapter que chama `ReceiveInboundEvent`:

```typescript
// src/infrastructure/channels/whatsapp/WhatsAppWebhookAdapter.ts
1. Valida assinatura HMAC-SHA256 do Meta
2. Itera pelos entries/changes do payload
3. Para cada mensagem: chama ReceiveInboundEvent com canal=WHATSAPP
```

O domínio não sabe que é WhatsApp. Sabe apenas que chegou um `InboundEvent` pelo canal `WHATSAPP`.

---

## Como isso prepara e-mail e outros canais

```
E-mail recebido → EmailWebhookAdapter → ReceiveInboundEvent(channel: EMAIL)
SMS recebido   → SMSWebhookAdapter   → ReceiveInboundEvent(channel: SMS)
```

Toda a lógica de processamento (lifecycle, contexto, LLM, resposta) é **idêntica** para todos os canais. Apenas o adapter de entrada e o dispatcher de saída mudam.

---

## Como isso prepara LangGraph e workflows visuais (Fase 3.3)

O use-case `OrchestrateInboundMessage` (Fase 2.5) define um passo claro:

```
ResolveConversation → ApplyLifecycle → ApplyMemoryPolicy → RouteToAgent → ExecuteLLM
```

Na Fase 3.3, `RouteToAgent` pode ser substituído por `ExecuteLangGraphWorkflow` sem mudar nenhuma outra etapa da harness. A interface é a mesma.

---

## Como preservar Clean Architecture

### Regra de dependência mantida

```
app/ → domains/ → shared/
infrastructure/ → domains/ (implementa interfaces)
domains/ NÃO importam infrastructure/
domains/ NÃO importam WhatsApp, BullMQ ou Redis
```

### Novos domínios adicionados

```
domains/channel/          — InboundEvent, Channel enum (puro, sem dependências)
domains/contact/          — Contact, ContactChannelIdentity
domains/conversation-lifecycle/ — estados e transições
domains/memory-policy/    — IMemoryPolicyEngine, ApplyMemoryPolicy
domains/observability/    — ConversationTrace, ITraceRepository
```

### Novos adapters de infraestrutura

```
infrastructure/channels/whatsapp/ — adapter de entrada e saída
infrastructure/queues/            — IQueueProvider, InMemoryQueueProvider
infrastructure/rate-limit/        — IUsageLimiter
infrastructure/observability/     — PrismaTraceRepository
```

---

## Alternativas consideradas

### Alternativa 1: Expandir SendMessage com flags WhatsApp

**Rejeitada.** Violaria SRP. `SendMessage` ficaria enorme. Nenhuma separação entre recebimento e processamento. Idempotência impossível sem um repositório dedicado. Lifecycle se tornaria uma máquina de estados dentro de SendMessage.

### Alternativa 2: Usar LangGraph como harness desde o início

**Rejeitada para Fase 2.5.** LangGraph introduz complexidade significativa (novo paradigma, graphs, state machines). A harness pode ser implementada sem LangGraph e depois LangGraph pode ser plugado como executor na Fase 3.3. Prematuridade desnecessária.

### Alternativa 3: Serverless functions dedicadas para WhatsApp

**Rejeitada.** Fragmentaria o projeto em múltiplos deployments. Next.js já suporta background jobs via route handlers e BullMQ workers. Manter tudo em um único repositório facilita desenvolvimento e deploy.

### Alternativa 4: Usar um serviço de terceiros (Twilio, MessageBird)

**Adiada.** Pode ser considerada no futuro como adapter. Não muda a arquitetura interna da harness.

---

## Consequências

### Positivas
- WhatsApp funciona de forma confiável em produção
- Canal genérico — e-mail, SMS, voz plugáveis sem mudar domínio
- Retry e DLQ — zero perda de mensagens
- Observabilidade por execução — debug e custo mensuráveis
- Lifecycle explícito — handoff humano sem risco de double-response
- Memória durável — agente "lembra" de conversas anteriores
- Quotas — controle de custo por tenant
- Preparado para LangGraph — orquestrador pode ser trocado

### Negativas / Trade-offs
- Complexidade operacional maior — Redis adicional em produção
- Latência de entrega da resposta — resposta não é instantânea (vai para fila)
- Mais código a manter — 8 novos domínios/subdomínios
- Debugging mais complexo — trace distribuído exige ferramentas adequadas

### Mitigações
- InMemoryQueueProvider para desenvolvimento local (Redis não é necessário no dev)
- Latência aceitável para WhatsApp (usuários não esperam resposta instantânea)
- Cada domínio é pequeno e focado — YAGNI aplicado em cada um

---

## Status das decisões subsidiárias (de ADR 005)

As regras de isolamento multi-tenant do ADR 005 se aplicam integralmente:
- `InboundEvent.tenantId` sempre vem do provider secret/API key — nunca do body
- `Contact.tenantId` isolado por tenant
- Trace e métricas separados por tenant
- Quotas aplicadas por tenant
