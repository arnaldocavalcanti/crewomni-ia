# Conversation Lifecycle

> **Status:** APPROVED  
> **Domínio:** conversation-lifecycle  
> **Autor:** @arnaldo  
> **Data:** 2026-06-07  
> **Fase:** 2.5 — Agent Harness Core  
> **Depende de:** inbound-event-processing spec, ADR 006

---

## 1. Objetivo

Definir e controlar o ciclo de vida de uma conversa com estados explícitos, transições validadas e regras claras sobre quando o agente pode responder — especialmente para prevenir que o agente responda durante atendimento humano.

---

## 2. Contexto de negócio

O status atual `OPEN | CLOSED` não é suficiente para canais assíncronos como WhatsApp. Uma conversa pode:
- Ficar aguardando resposta do usuário por horas
- Ser transferida para um humano (handoff)
- Ser reaberta depois de fechada quando o usuário manda nova mensagem
- Estar em processo de fechamento (tempo de inatividade configurável)

Sem estados explícitos e transições validadas, o sistema não sabe em que situação a conversa está, e o agente pode responder em momentos inadequados — como quando um operador humano já está atendendo.

---

## 3. Problema que resolve

- Agente responde quando conversa está em atendimento humano (double-response)
- Conversa encerrada fica "morta" para sempre — usuário que volta não consegue ser atendido
- Sem estado de "aguardando humano", o sistema não sabe que precisa notificar um operador
- Sem registro de motivo de handoff, operadores não têm contexto ao assumir
- Sem histórico de transições, é impossível auditar como uma conversa evoluiu

---

## 4. Regras de negócio

1. Cada conversa tem exatamente um `ConversationStatus` em qualquer momento.
2. Transições inválidas lançam `AppError('INVALID_LIFECYCLE_TRANSITION')`.
3. **Quando status é `WAITING_HUMAN` ou `HANDOFF_ACCEPTED`: o agente NÃO responde**. `OrchestrateInboundMessage` deve verificar antes de chamar `SendMessage`.
4. Quando usuário envia mensagem em conversa com status `CLOSED` ou `ARCHIVED`: status transita automaticamente para `REOPENED`.
5. Conversa `REOPENED` aceita mensagens como `ACTIVE`.
6. `HANDOFF_REQUESTED` requer `handoffReason` obrigatório.
7. `HANDOFF_ACCEPTED` requer `handoffOperatorId` (id do operador humano que assumiu).
8. Transição para `CLOSED` gera evento de fechamento no audit log.
9. Transição para `ARCHIVED` é irreversível — conversa não pode ser reaberta.
10. O `tenantId` está presente em todas as operações de lifecycle.
11. Toda transição é registrada em `ConversationLifecycleEvent` com timestamp, ator e motivo.

---

## 5. Fluxos principais

### Transições válidas

```
ACTIVE ──────────────────────────────────────────────────────────────────────────► WAITING_USER
ACTIVE ──────────────────────────────────────────────────────────────────────────► HANDOFF_REQUESTED
ACTIVE ──────────────────────────────────────────────────────────────────────────► CLOSED
WAITING_USER ────────────────────────────────────────────────────────────────────► ACTIVE (usuário responde)
WAITING_USER ────────────────────────────────────────────────────────────────────► CLOSED (timeout)
WAITING_AGENT ───────────────────────────────────────────────────────────────────► ACTIVE
HANDOFF_REQUESTED ───────────────────────────────────────────────────────────────► HANDOFF_ACCEPTED
HANDOFF_REQUESTED ───────────────────────────────────────────────────────────────► ACTIVE (cancelou handoff)
HANDOFF_ACCEPTED ────────────────────────────────────────────────────────────────► ACTIVE (devolveu para agente)
HANDOFF_ACCEPTED ────────────────────────────────────────────────────────────────► CLOSED (humano fechou)
CLOSED ──────────────────────────────────────────────────────────────────────────► REOPENED (usuário responde)
REOPENED ────────────────────────────────────────────────────────────────────────► ACTIVE
CLOSED ──────────────────────────────────────────────────────────────────────────► ARCHIVED (após 90 dias)
```

### Fluxo de handoff

```
1. Agente detecta baixa confiança / intenção sensível / reclamação
2. Agente chama RequestHumanHandoff(conversationId, reason, triggeredBy)
3. Lifecycle transita: ACTIVE → HANDOFF_REQUESTED
4. Sistema notifica operadores disponíveis (pool do tenant)
5. Operador aceita: AcceptHumanHandoff(conversationId, operatorId)
6. Lifecycle transita: HANDOFF_REQUESTED → HANDOFF_ACCEPTED
7. Operador responde manualmente via dashboard
8. Ao finalizar: ReturnToAgent ou CloseConversation

Em HANDOFF_REQUESTED e HANDOFF_ACCEPTED:
→ OrchestrateInboundMessage detecta status
→ NÃO chama SendMessage
→ Registra mensagem do usuário no histórico
→ Notifica operador de nova mensagem
```

### Fluxo de reabertura

```
1. Conversa está CLOSED
2. Usuário envia nova mensagem via WhatsApp
3. InboundEvent processado → OrchestrateInboundMessage detecta status CLOSED
4. ApplyLifecycleTransition(CLOSED → REOPENED)
5. REOPENED → ACTIVE (automático)
6. Mensagem processada normalmente pelo agente
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Transição inválida (ex: ARCHIVED → ACTIVE) | Lança INVALID_LIFECYCLE_TRANSITION |
| Handoff sem reason | Lança HANDOFF_REASON_REQUIRED |
| AcceptHandoff sem operatorId | Lança OPERATOR_ID_REQUIRED |
| Mensagem em conversa ARCHIVED | Lança CONVERSATION_ARCHIVED — nova conversa deve ser criada |
| WAITING_HUMAN recebe mensagem de usuário | Armazena mensagem, notifica operador — agente NÃO responde |
| Timeout de WAITING_USER (configurável por tenant) | Lifecycle transita para CLOSED automaticamente |

---

## 7. Critérios de aceite

- Dado conversa em ACTIVE, quando agente solicita handoff com reason, então status transita para HANDOFF_REQUESTED
- Dado conversa em HANDOFF_REQUESTED, quando operador aceita, então status transita para HANDOFF_ACCEPTED
- Dado conversa em WAITING_HUMAN ou HANDOFF_ACCEPTED, quando usuário envia mensagem, então agente NÃO responde e mensagem é armazenada
- Dado conversa em CLOSED, quando usuário envia nova mensagem, então status transita para REOPENED e agente processa normalmente
- Dado conversa em ARCHIVED, quando qualquer transição é tentada, então lança INVALID_LIFECYCLE_TRANSITION
- Dado qualquer transição, quando executada, então ConversationLifecycleEvent é registrado com timestamp e ator
- Dado transição inválida (ex: CLOSED → HANDOFF_REQUESTED), quando tentada, então lança INVALID_LIFECYCLE_TRANSITION

---

## 8. Contratos de entrada e saída

```typescript
// Enum expandido (substitui OPEN|CLOSED existente)
type ConversationStatus =
  | 'ACTIVE'           // agente pode responder
  | 'WAITING_USER'     // aguardando resposta do usuário
  | 'WAITING_AGENT'    // aguardando disponibilidade do agente
  | 'HANDOFF_REQUESTED' // agente solicitou humano
  | 'HANDOFF_ACCEPTED'  // humano assumiu — agente NÃO responde
  | 'CLOSED'           // encerrada
  | 'REOPENED'         // reaberta pelo usuário (transita para ACTIVE)
  | 'ARCHIVED'         // arquivada — irreversível

// Evento de lifecycle (imutável — append-only)
type ConversationLifecycleEvent = {
  id: string
  tenantId: string
  conversationId: string
  fromStatus: ConversationStatus
  toStatus: ConversationStatus
  actor: 'AGENT' | 'USER' | 'OPERATOR' | 'SYSTEM'
  actorId?: string
  reason?: string
  createdAt: Date
}

// Input do use-case
type ApplyLifecycleTransitionInput = {
  tenantId: string
  conversationId: string
  toStatus: ConversationStatus
  actor: 'AGENT' | 'USER' | 'OPERATOR' | 'SYSTEM'
  actorId?: string
  reason?: string        // obrigatório para HANDOFF_REQUESTED
  operatorId?: string    // obrigatório para HANDOFF_ACCEPTED
}

// Output
type ApplyLifecycleTransitionOutput = {
  conversationId: string
  previousStatus: ConversationStatus
  currentStatus: ConversationStatus
  eventId: string
}

// Input do use-case RequestHumanHandoff
type RequestHumanHandoffInput = {
  tenantId: string
  conversationId: string
  reason: string
  triggeredBy: 'AGENT' | 'OPERATOR' | 'USER'
  triggeredById?: string
  confidence?: number    // 0-1 score de confiança do agente
}

// Erros esperados
type LifecycleError =
  | 'CONVERSATION_NOT_FOUND'
  | 'INVALID_LIFECYCLE_TRANSITION'
  | 'HANDOFF_REASON_REQUIRED'
  | 'OPERATOR_ID_REQUIRED'
  | 'CONVERSATION_ARCHIVED'

// Mapa de transições válidas
const VALID_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  ACTIVE: ['WAITING_USER', 'WAITING_AGENT', 'HANDOFF_REQUESTED', 'CLOSED'],
  WAITING_USER: ['ACTIVE', 'CLOSED'],
  WAITING_AGENT: ['ACTIVE', 'CLOSED'],
  HANDOFF_REQUESTED: ['HANDOFF_ACCEPTED', 'ACTIVE'],
  HANDOFF_ACCEPTED: ['ACTIVE', 'CLOSED'],
  CLOSED: ['REOPENED', 'ARCHIVED'],
  REOPENED: ['ACTIVE'],
  ARCHIVED: [],
}

// Regra: agente pode processar?
function canAgentProcess(status: ConversationStatus): boolean {
  return ['ACTIVE', 'WAITING_USER', 'REOPENED'].includes(status)
}
```

---

## 9. Impacto arquitetural

- [x] Entidade `Conversation` modificada: `status` expandido de `OPEN|CLOSED` para 8 estados
- [x] Migration Prisma: coluna `status` do tipo String (ENUM ou VARCHAR) — `DEFAULT 'ACTIVE'`; `OPEN` mapeado para `ACTIVE` em migration
- [x] Nova entidade: `ConversationLifecycleEvent` — `src/domains/conversation-lifecycle/entities/ConversationLifecycleEvent.ts`
- [x] Novo use-case: `ApplyLifecycleTransition` — `src/domains/conversation-lifecycle/use-cases/ApplyLifecycleTransition.ts`
- [x] Novo use-case: `RequestHumanHandoff` — `src/domains/conversation-lifecycle/use-cases/RequestHumanHandoff.ts`
- [x] Novo use-case: `AcceptHumanHandoff` — `src/domains/conversation-lifecycle/use-cases/AcceptHumanHandoff.ts`
- [x] Nova interface: `IConversationLifecycleRepository` — para persistir eventos de lifecycle
- [x] Modificação: `OrchestrateInboundMessage` verifica `canAgentProcess(status)` antes de chamar `SendMessage`
- [x] Nova tabela Prisma: `ConversationLifecycleEvent`
- [x] DI: registrar novos use-cases

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Migration quebrar conversas existentes com status OPEN | Alta | Alto | DEFAULT 'ACTIVE' na migration; script UPDATE conversas OPEN → ACTIVE |
| Race condition: dois eventos simultâneos tentam transição | Média | Médio | Lock otimista no update; índice em (conversationId, updatedAt) |
| Operador não aceitar handoff — conversa fica em HANDOFF_REQUESTED indefinidamente | Média | Médio | Timeout configurável → auto-close após N minutos sem resposta |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/conversation-lifecycle/`):**
- [x] `ApplyLifecycleTransition deve transitar ACTIVE para HANDOFF_REQUESTED com reason`
- [x] `ApplyLifecycleTransition deve lançar INVALID_LIFECYCLE_TRANSITION para ARCHIVED → ACTIVE`
- [x] `ApplyLifecycleTransition deve lançar HANDOFF_REASON_REQUIRED quando reason ausente em HANDOFF_REQUESTED`
- [x] `RequestHumanHandoff deve criar lifecycle event e atualizar status`
- [x] `canAgentProcess deve retornar false para HANDOFF_ACCEPTED`
- [x] `canAgentProcess deve retornar true para ACTIVE`
- [x] `Conversa CLOSED deve transitar para REOPENED quando usuário responde`
- [x] `Todas as transições inválidas devem lançar INVALID_LIFECYCLE_TRANSITION`

**Integração (`tests/integration/conversation-lifecycle/`):**
- [x] `tenant A não deve transitar lifecycle de conversa de tenant B`
- [x] `OrchestrateInboundMessage não deve chamar SendMessage quando status HANDOFF_ACCEPTED`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** histórico de estados da conversa, motivo de handoff, id do operador
- **Finalidade:** auditoria, qualidade do atendimento, análise de handoffs
- **Retenção:** `ConversationLifecycleEvent` retido enquanto conversa existe + 90 dias após ARCHIVED
- **Exclusão:** cascata de FK — exclusão da conversa exclui lifecycle events
- **Dados sensíveis:** `reason` do handoff pode conter dados do cliente — não expor em logs públicos
- **KDL:** padrões de handoff (motivos mais comuns) podem ser anonimizados para Industry KB

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` em todas as queries de lifecycle ✅
- `ConversationLifecycleEvent` sempre carrega `tenantId` ✅
- Transição de status de outra tenant retorna 404 ✅
- Audit log registra `tenantId` em todos os eventos de transição ✅
- RLS na tabela `conversation_lifecycle_events` com policy por `tenantId` ✅
