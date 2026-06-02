# Conversation Audit — Persistência de Conversas e Mensagens

> **Status:** APPROVED
> **Domínio:** conversation
> **Autor:** @arnaldo
> **Data:** 2026-05-29
> **Depende de:** spec rag-orchestrator (BuildRAGContext), spec agent-builder

---

## 1. Objetivo

Persistir cada conversa entre um usuário final e um agente, registrando todas as mensagens trocadas com metadados (modelo usado, tokens, chunks) para fins de auditoria, histórico e futura Knowledge Distillation.

---

## 2. Contexto de negócio

Hoje o `BuildRAGContext` retorna uma resposta mas não salva nada. Sem persistência: (a) o histórico de conversa precisa ser enviado integralmente pelo cliente a cada turno — ineficiente; (b) não há como auditar interações; (c) a KDL não tem material para aprender. O Conversation Audit resolve os três problemas.

Cada tenant tem suas próprias conversas — isolamento obrigatório. Um cliente final (usuário do chat, não do dashboard) pode ter múltiplas conversas com o mesmo agente.

---

## 3. Problema que resolve

Sem persistência de conversa:
- O cliente do widget precisa reenviar todo o histórico a cada mensagem (payload cresce indefinidamente)
- Não há registro de qualidade das respostas para o tenant analisar
- A KDL não tem dados para distilação futura

---

## 4. Regras de negócio

1. Uma `Conversation` pertence a um `tenantId` e a um `agentId` — ambos obrigatórios.
2. Uma `Conversation` pode ter um `externalUserId` opcional (identificador do usuário final no sistema do tenant).
3. Cada turno gera duas `Message`: uma com `role: USER` e outra com `role: ASSISTANT`.
4. A mensagem `ASSISTANT` armazena metadados do LLM: `model`, `tokensUsed`, `chunksUsed`.
5. Uma conversa encerrada (`status: CLOSED`) não aceita novas mensagens — retorna `CONVERSATION_CLOSED`.
6. `tenantId` é sempre extraído da sessão JWT (canal dashboard) ou do contexto do widget (canal público).
7. O histórico recente de uma conversa é recuperado por `conversationId` — o RAG Orchestrator usa esse histórico nas próximas chamadas ao LLM.
8. Máximo de **200 mensagens por conversa** (100 turnos). Ao atingir o limite, a conversa é fechada automaticamente e uma nova deve ser criada.
9. Apenas `TENANT_ADMIN` e `TENANT_OPERATOR` podem listar conversas no dashboard.
10. Conversa de outro tenant retorna 404 (não revela existência).
11. Toda operação de criação e fechamento gera audit log.

---

## 5. Fluxos principais

### Enviar mensagem (turno completo)
```
1. Caller invoca SendMessage com { conversationId?, tenantId, agentId, message, externalUserId? }
2. Se conversationId ausente → cria nova Conversation (status OPEN)
3. Se conversationId presente → busca e valida (tenantId, status OPEN)
4. Persiste Message { role: USER, content: message }
5. Busca últimas N mensagens da conversa para montar histórico
6. Chama BuildRAGContext com { tenantId, agentId, message, conversationHistory }
7. Persiste Message { role: ASSISTANT, content: reply, metadata: { model, tokensUsed, chunksUsed } }
8. Se total de mensagens atingiu 200 → fecha conversa automaticamente
9. Registra audit log
10. Retorna { conversationId, reply, model, tokensUsed, messageId }
```

### Listar conversas do tenant (dashboard)
```
1. Operador autenticado solicita GET /api/v1/conversations?agentId=X&page=1
2. Sistema retorna lista paginada de conversas com contagem de mensagens
```

### Buscar histórico de conversa
```
1. Caller solicita GET /api/v1/conversations/:id/messages
2. Sistema valida tenantId e retorna mensagens ordenadas por createdAt
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| conversationId não encontrado | 404 `CONVERSATION_NOT_FOUND` |
| Conversa de outro tenant | 404 `CONVERSATION_NOT_FOUND` (não revela existência) |
| Conversa com status CLOSED | 422 `CONVERSATION_CLOSED` |
| message vazio | 422 `VALIDATION_ERROR` |
| Agente não encontrado ou inativo | Propaga erro do BuildRAGContext (404/422) |
| Falha no LLM após persistir mensagem do USER | Persiste mensagem de erro no ASSISTANT + status `FAILED` na mensagem |
| Limite de 200 mensagens atingido | Fecha conversa e retorna `conversationId` novo na próxima chamada |

---

## 7. Critérios de aceite

- Dado primeira mensagem sem conversationId, quando enviada, então nova conversa criada e reply retornado
- Dado conversationId existente, quando nova mensagem enviada, então mensagem adicionada à conversa existente
- Dado conversa CLOSED, quando nova mensagem enviada, então retorna CONVERSATION_CLOSED
- Dado conversationId de outro tenant, quando consultado, então retorna 404
- Dado conversa com 200 mensagens, quando mais uma enviada no mesmo ID, então retorna CONVERSATION_CLOSED
- Dado conversa ativa, quando histórico consultado, então retorna mensagens ordenadas por createdAt ASC
- Dado falha no LLM, quando mensagem enviada, então mensagem USER persiste e ASSISTANT recebe status FAILED
- Dado SendMessage bem-sucedido, quando auditado, então log registra tenantId, agentId, conversationId, tokensUsed

---

## 8. Contratos de entrada e saída

```typescript
// POST /api/v1/conversations/message
type SendMessageInput = {
  conversationId?: string     // ausente = nova conversa
  agentId: string
  message: string
  externalUserId?: string     // identificador do usuário final
}

type SendMessageOutput = {
  conversationId: string
  messageId: string           // ID da mensagem ASSISTANT criada
  reply: string
  model: string
  tokensUsed: number
  isNewConversation: boolean
}

// GET /api/v1/conversations?agentId=X&page=1&limit=20
type ListConversationsOutput = {
  conversations: {
    id: string
    agentId: string
    externalUserId: string | null
    status: ConversationStatus
    messageCount: number
    createdAt: string
    updatedAt: string
  }[]
  total: number
  page: number
}

// GET /api/v1/conversations/:id/messages
type GetConversationMessagesOutput = {
  conversationId: string
  agentId: string
  status: ConversationStatus
  messages: {
    id: string
    role: MessageRole
    content: string
    metadata: MessageMetadata | null
    createdAt: string
  }[]
}

enum ConversationStatus {
  OPEN   = 'OPEN',
  CLOSED = 'CLOSED',
}

enum MessageRole {
  USER      = 'USER',
  ASSISTANT = 'ASSISTANT',
}

type MessageMetadata = {
  model?: string
  tokensUsed?: number
  chunksUsed?: { layer: string; count: number; totalScore: number }[]
  failed?: boolean
}

// Erros
type ConversationError =
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_CLOSED'
  | 'VALIDATION_ERROR'
  | 'AGENT_NOT_FOUND'
  | 'AGENT_NOT_ACTIVE'
  | 'LLM_PROVIDER_ERROR'
```

---

## 9. Impacto arquitetural

- [ ] Nova entidade: `Conversation` em `src/domains/conversation/entities/Conversation.ts`
- [ ] Nova entidade: `Message` em `src/domains/conversation/entities/Message.ts`
- [ ] Nova interface: `IConversationRepository` em `src/domains/conversation/repositories/`
- [ ] Novo use-case: `SendMessage` em `src/domains/conversation/use-cases/SendMessage.ts`
- [ ] Novo use-case: `ListConversations` em `src/domains/conversation/use-cases/ListConversations.ts`
- [ ] Novo use-case: `GetConversationMessages` em `src/domains/conversation/use-cases/GetConversationMessages.ts`
- [ ] Nova infra: `InMemoryConversationRepository`
- [ ] Nova infra: `PrismaConversationRepository` (futuro — requer migração)
- [ ] Novas API routes:
  - `POST /api/v1/conversations/message`
  - `GET /api/v1/conversations`
  - `GET /api/v1/conversations/:id/messages`
- [ ] Prisma schema: `Conversation` e `Message` (com campo `metadata` JSON)
- [ ] `SendMessage` orquestra `BuildRAGContext` — recebe instância via DI

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Falha no LLM após persistir mensagem USER (inconsistência) | Média | Médio | Persistir mensagem ASSISTANT com `metadata.failed: true` ao invés de lançar erro |
| Conversa crescendo indefinidamente | Baixa | Médio | Limite de 200 mensagens com fechamento automático |
| Histórico muito longo sobrecarregando o prompt | Baixa | Médio | BuildRAGContext usa apenas as últimas 10 mensagens (ADR 004) |
| Dados de conversa cruzando tenants | Baixa | Crítico | `tenantId` obrigatório em todas as queries + RLS |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/conversation/`):**
- [ ] `deve criar nova conversa quando conversationId ausente`
- [ ] `deve adicionar mensagem a conversa existente quando conversationId fornecido`
- [ ] `deve lançar CONVERSATION_NOT_FOUND para conversationId inexistente`
- [ ] `deve lançar CONVERSATION_NOT_FOUND para conversa de outro tenant`
- [ ] `deve lançar CONVERSATION_CLOSED para conversa fechada`
- [ ] `deve lançar VALIDATION_ERROR quando message vazia`
- [ ] `deve fechar conversa automaticamente ao atingir 200 mensagens`
- [ ] `deve persistir mensagem ASSISTANT com metadata de LLM`
- [ ] `deve persistir mensagem ASSISTANT com failed:true quando LLM falha`
- [ ] `deve retornar isNewConversation:true na primeira mensagem`
- [ ] `deve retornar isNewConversation:false em mensagens subsequentes`
- [ ] `deve registrar audit log com tenantId, agentId, conversationId, tokensUsed`
- [ ] `deve buscar histórico das últimas 10 mensagens para o RAG`
- [ ] `deve listar apenas conversas do tenant correto`
- [ ] `deve retornar mensagens ordenadas por createdAt ASC`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve acessar conversas de tenant B`
- [ ] `contrato: POST /api/v1/conversations/message retorna SendMessageOutput correto`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** conteúdo das mensagens do usuário final e do agente, metadados do LLM
- **Finalidade:** auditoria do atendimento, histórico de contexto para o agente, futura KDL
- **Retenção:** configurável por tenant (padrão: 90 dias); expiração automática via cron (Fase 2)
- **Exclusão:** exclusão em cascata ao deletar tenant; endpoint de exclusão por conversationId
- **Dados sensíveis:** mensagens podem conter dados pessoais dos clientes finais do tenant — acesso restrito ao tenant owner; logs sem PII
- **KDL:** apenas metadados anonimizados (modelo, tokens, scores) alimentam a KDL — nunca o conteúdo bruto

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todas as queries de `Conversation` e `Message`?  ✅
- RLS cobre as tabelas `conversations` e `messages`? ✅ (a implementar na migration)
- Busca de conversa por ID sempre inclui `WHERE tenant_id = $tenantId`? ✅
- Conversa de outro tenant retorna 404 (não 403)? ✅
- Audit log registra `tenantId` em todos os eventos? ✅
- Testes de isolamento escritos? ✅ (listados na seção 11)
