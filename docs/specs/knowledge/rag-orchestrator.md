# RAG Orchestrator — Orquestração do Contexto para o LLM

> **Status:** APPROVED
> **Domínio:** knowledge
> **Autor:** @arnaldo
> **Data:** 2026-05-29
> **Depende de:** ADR 003 (embedding e chunking), ADR 004 (prompt hierárquico), spec knowledge-ingest

---

## 1. Objetivo

Montar o contexto completo de uma conversa — system prompt do agente + chunks relevantes das 4 layers de KB + histórico de mensagens — e enviá-lo ao LLM, retornando a resposta do agente.

---

## 2. Contexto de negócio

Quando um usuário envia uma mensagem ao agente, a plataforma precisa: (1) encontrar os trechos de conhecimento mais relevantes nas bases disponíveis, (2) montar o prompt hierárquico conforme ADR 004, (3) enviar ao LLM, e (4) retornar a resposta. Este use-case é o coração funcional da plataforma — sem ele, o agente não responde.

---

## 3. Problema que resolve

Sem um orquestrador, cada chamada ao LLM precisaria reimplementar a busca vetorial, a montagem do prompt e o roteamento de modelo. O RAG Orchestrator centraliza essa lógica em um único use-case reutilizável por todos os canais (API, widget, WhatsApp futuro).

---

## 4. Regras de negócio

1. O `tenantId` e o `agentId` são obrigatórios e validados contra a sessão — nunca aceitos de body ou query param.
2. O agente deve estar com status `ACTIVE` para receber mensagens; agentes `DRAFT` ou `ARCHIVED` retornam erro.
3. A busca de chunks é executada em paralelo nas 4 layers (Global, Industry, Tenant, Agent).
4. O número total de tokens de KB no prompt não deve exceder 4100 tokens (conforme ADR 004). Chunks com menor score são removidos primeiro em caso de estouro.
5. O histórico de conversa inclui no máximo as últimas 10 mensagens (configurável no AgentConfig no futuro).
6. A resposta do LLM e os metadados da chamada (model, tokensUsed) são retornados ao caller — a persistência da mensagem é responsabilidade do domínio `conversation` (Fase 1 posterior).
7. Toda chamada ao LLM gera um audit log com: `tenantId`, `agentId`, `model`, `tokensUsed`, `chunkCount`, timestamp.
8. Se nenhum chunk relevante for encontrado (score < 0.7), o prompt é montado apenas com o system prompt e o histórico — o agente ainda responde.
9. O `ILLMProvider` é injetado via DI — a implementação concreta (OpenAI) fica em `infrastructure/`.
10. Industry KB (Layer 2) é ignorada na Fase 1 (sem KDL ainda) — o orquestrador já prepara o slot mas não busca chunks nessa layer.

---

## 5. Fluxos principais

```
1. Caller invoca BuildRAGContext com { tenantId, agentId, message, conversationHistory }
2. Use-case valida tenantId e agentId
3. Use-case busca o agente (GetAgent) — valida status ACTIVE
4. Use-case gera embedding do message (via IEmbeddingProvider)
5. Use-case busca chunks em paralelo:
   a. Global KB  → IKnowledgeRepository.searchGlobal(embedding, budget=800)
   b. Industry KB → skip (Fase 1)
   c. Tenant KB   → IKnowledgeRepository.search(tenantId, KnowledgeLayer.TENANT, embedding, budget=1500)
   d. Agent KB    → IKnowledgeRepository.search(tenantId, KnowledgeLayer.AGENT, agentId, embedding, budget=800)
6. Use-case aplica token budget — remove chunks de menor score se necessário
7. Use-case monta systemPrompt final (ADR 004):
   {agent.systemPrompt}
   ---CONHECIMENTO RELEVANTE---
   [Boas Práticas] {global_chunks}
   [Base de Conhecimento] {tenant_chunks}
   [Instruções Específicas] {agent_chunks}
8. Use-case chama ILLMProvider.complete({ systemPrompt, messages: conversationHistory + message, model })
9. Use-case registra audit log
10. Use-case retorna { reply, model, tokensUsed, chunksUsed }
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Agente não encontrado | Retorna 404 (`AGENT_NOT_FOUND`) |
| Agente com status DRAFT ou ARCHIVED | Retorna 422 (`AGENT_NOT_ACTIVE`) |
| Agente de outro tenant | Retorna 404 (não revela existência) |
| Falha no LLM provider | Retorna 502 (`LLM_PROVIDER_ERROR`) |
| Falha no embedding | Retorna 502 (`EMBEDDING_ERROR`) |
| conversationHistory ausente | Usa array vazio — sem histórico |
| Nenhum chunk encontrado (score < 0.7) | Responde apenas com system prompt + mensagem |
| message vazio | Retorna 422 (`VALIDATION_ERROR`) |

---

## 7. Critérios de aceite

- Dado agente ACTIVE, quando message válida enviada, então retorna `{ reply, model, tokensUsed, chunksUsed }`
- Dado agente DRAFT, quando message enviada, então retorna erro `AGENT_NOT_ACTIVE`
- Dado agente de outro tenant, quando agentId usado, então retorna 404
- Dado budget excedido (>4100 tokens de KB), quando chunks montados, então chunks de menor score são removidos
- Dado nenhum chunk com score ≥ 0.7, quando busca executada, então prompt é montado sem seção de KB
- Dado LLM provider falhando, quando complete() chamado, então retorna erro `LLM_PROVIDER_ERROR`
- Dado chamada bem-sucedida, quando LLM responde, então audit log é registrado com tenantId, agentId, model, tokensUsed

---

## 8. Contratos de entrada e saída

```typescript
// Input
type BuildRAGContextInput = {
  tenantId: string           // extraído da sessão
  agentId: string
  message: string            // mensagem atual do usuário
  conversationHistory?: {
    role: 'user' | 'assistant'
    content: string
  }[]
}

// Output
type BuildRAGContextOutput = {
  reply: string
  model: string
  tokensUsed: number
  chunksUsed: {
    layer: 'GLOBAL' | 'TENANT' | 'AGENT'
    count: number
    totalScore: number
  }[]
}

// Erros esperados
type BuildRAGContextError =
  | 'AGENT_NOT_FOUND'
  | 'AGENT_NOT_ACTIVE'
  | 'VALIDATION_ERROR'
  | 'LLM_PROVIDER_ERROR'
  | 'EMBEDDING_ERROR'
```

---

## 9. Impacto arquitetural

- [ ] Nova interface: `IEmbeddingProvider` em `src/shared/types/IEmbeddingProvider.ts`
- [ ] Nova interface: `ILLMProvider` em `src/shared/types/ILLMProvider.ts`
- [ ] Novo use-case: `BuildRAGContext` em `src/domains/knowledge/use-cases/BuildRAGContext.ts`
- [ ] Novo adapter: `OpenAIEmbeddingProvider` em `src/infrastructure/llm/OpenAIEmbeddingProvider.ts`
- [ ] Novo adapter: `OpenAILLMProvider` em `src/infrastructure/llm/OpenAILLMProvider.ts`
- [ ] Extensão em `IKnowledgeRepository`: método `searchGlobal(embedding, limit)` + filtro por layer
- [ ] Atualização no DI container: registrar `IEmbeddingProvider` e `ILLMProvider`
- [ ] Nova API route: `POST /api/v1/agents/:id/chat`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Latência alta (embedding + busca + LLM em série) | Alta | Alto | Paralelizar busca nas layers; cache de embeddings de mensagens repetidas (Fase 2) |
| Custo de tokens descontrolado | Média | Alto | Budget fixo por layer (ADR 004); audit log com tokensUsed para monitoramento |
| LLM provider fora do ar | Baixa | Crítico | Retry com backoff exponencial; fallback para mensagem de erro amigável |
| Chunks irrelevantes contaminando o prompt | Média | Médio | Score threshold ≥ 0.7 + truncagem por score |
| Vazamento de dados entre tenants via KB | Baixa | Crítico | `tenantId` em todas as queries + RLS no Postgres |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/knowledge/`):**
- [ ] `deve retornar reply quando agente ACTIVE e message válida`
- [ ] `deve lançar AGENT_NOT_ACTIVE quando agente DRAFT`
- [ ] `deve lançar AGENT_NOT_ACTIVE quando agente ARCHIVED`
- [ ] `deve lançar AGENT_NOT_FOUND quando agentId não existe`
- [ ] `deve lançar AGENT_NOT_FOUND quando agentId pertence a outro tenant`
- [ ] `deve montar prompt com chunks quando score >= 0.7`
- [ ] `deve montar prompt sem seção KB quando nenhum chunk com score >= 0.7`
- [ ] `deve remover chunks de menor score quando budget excedido`
- [ ] `deve incluir histórico de conversa nas messages[]`
- [ ] `deve lançar LLM_PROVIDER_ERROR quando ILLMProvider falha`
- [ ] `deve registrar audit log com tenantId, agentId, model, tokensUsed`
- [ ] `deve retornar chunksUsed com contagem por layer`
- [ ] `deve usar array vazio de histórico quando conversationHistory ausente`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve receber chunks de tenant B no prompt`
- [ ] `contrato de API: POST /api/v1/agents/:id/chat retorna shape correto`
- [ ] `POST /api/v1/agents/:id/chat com agente DRAFT retorna 422`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** mensagem do usuário, histórico de conversa, reply do LLM, tokens usados
- **Finalidade:** prestar o serviço de atendimento automatizado contratado pelo tenant
- **Retenção:** mensagens armazenadas pelo domínio `conversation` (spec futura) — retenção configurável por tenant
- **Exclusão:** exclusão em cascata ao deletar tenant (direito ao esquecimento)
- **Dados sensíveis:** mensagens podem conter dados pessoais de clientes do tenant — trafegados via HTTPS, nunca logados em plain text no audit log
- **KDL:** respostas do agente podem gerar insights para o Industry KB — apenas metadados anonimizados (Fase 2, com consentimento explícito do tenant)

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todas as queries de busca de chunks? ✅ (parâmetro obrigatório no repository)
- RLS cobre as tabelas de KB? ✅ (herdado da spec knowledge-ingest)
- Vector store usa namespace do tenant? ✅ (pgvector com filtro `tenantId`; Qdrant com coleção por tenant na Fase 3)
- Cache usa prefixo do tenant? N/A (sem cache na Fase 1)
- Audit log registra o `tenantId` em todos os eventos? ✅
- Testes de isolamento escritos? ✅ (listados na seção 11)
