# ADR 001 — Decisões Técnicas Iniciais

> **Status:** ACCEPTED
> **Data:** 2026-05-28
> **Contexto:** Início do projeto AI Agent Hub

---

## Contexto

Plataforma SaaS multi-tenant, multi-nicho e multiagente para criação de agentes de IA especializados.
Requer isolamento total entre tenants, múltiplas camadas de conhecimento (RAG), Knowledge Distillation Layer e conformidade com LGPD.

---

## Decisões

### ORM — Prisma
**Motivo:** Type-safe end-to-end, migrations versionadas, suporte a PostgreSQL e pgvector, geração automática de tipos alinhada com TypeScript.

### Vector store — pgvector (MVP) → Qdrant (escala)
**Motivo:** pgvector simplifica a infraestrutura no MVP (um banco só). Quando o volume de vetores justificar, migrar para Qdrant sem impacto no domínio via `IVectorRepository`.

### LLM provider — Interface `ILLMProvider`
**Motivo:** Abstração permite troca de OpenAI por Anthropic, Gemini ou modelo local sem alterar domínio. Implementação inicial: OpenAI.

### Model routing por complexidade
**Motivo:** Redução de 40–70% de custo. Roteamento:
- `gpt-4o-mini` / `claude-haiku` → FAQ, saudação, intenções simples
- `gpt-4o` / `claude-sonnet` → SDR, suporte, onboarding
- `gpt-4o` / `claude-opus` → negociação, jurídico, decisões complexas
- Batch API → jobs de distillation e embedding assíncronos

### Prompt caching
**Motivo:** System prompt e Industry KB raramente mudam. Cache de prefixo (Anthropic/OpenAI) reduz 60–80% dos tokens repetidos por conversa.

### RAG com limite de chunks — BM25 → vector → top-3 por layer
**Motivo:** Keyword search filtra candidatos antes do vector search, reduzindo tokens enviados ao LLM em 30–50%. Limite de top-3 por layer evita context overflow.

### Cache de respostas — Redis com hash(agentId + pergunta normalizada)
**Motivo:** Perguntas frequentes e idênticas não chamam o LLM. Redução de 20–40% em tenants com alto volume de FAQ. TTL configurável por tenant.

### Orçamento por tenant — cota de tokens mensais por plano
**Motivo:** Custo previsível por tenant. Downgrade automático de modelo ao se aproximar do limite (antes de bloquear). Facilita modelo de pricing.

### Auth — NextAuth.js + JWT
**Motivo:** Integração nativa com Next.js App Router, suporte a múltiplos providers, sessão server-side segura.

### Filas — BullMQ + Redis
**Motivo:** Jobs de distillation, embedding e indexação são assíncronos por natureza. BullMQ oferece retry, prioridade e monitoramento.

### Versionamento de prompts — entidade `AgentPromptVersion`
**Motivo:** Rollback de prompts, A/B testing, auditoria de mudanças de comportamento do agente.

### API versioning — `/api/v1/` desde o início
**Motivo:** Evita breaking changes para tenants que integrarem via API diretamente.

### Testes — Vitest + Testing Library + Playwright
**Motivo:** Vitest é mais rápido que Jest e compatível com Next.js e ESM. Testing Library para componentes. Playwright para E2E.

### Isolamento de tenant — RLS no PostgreSQL + namespace no vector store
**Motivo:** Defense in depth. Código filtra por `tenantId`; banco bloqueia no RLS; vector store isola por namespace. Três camadas independentes.

---

## Consequências

- `ILLMProvider` deve ser implementado antes de qualquer feature que chame LLM
- `IVectorRepository` deve ser implementado antes de qualquer feature de knowledge
- Todo repository deve receber `tenantId` como parâmetro obrigatório
- Toda tabela com dados de tenant deve ter RLS habilitado desde a primeira migration

---

## Próximas decisões a documentar

- ADR 002 — Estratégia de autenticação multi-tenant (subdomínio vs. slug)
- ADR 003 — Estratégia de embedding (modelo, dimensões, chunking)
- ADR 004 — Estrutura do prompt hierárquico (5 layers)
- ADR 005 — Pipeline da Knowledge Distillation Layer
