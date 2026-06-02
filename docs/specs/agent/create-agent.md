# Agent Builder — Criar e Gerenciar Agentes

> **Status:** REVIEW
> **Domínio:** agent
> **Autor:** @arnaldo
> **Data:** 2026-05-29

---

## 1. Objetivo

Permitir que um tenant crie, configure, versione e gerencie agentes de IA especializados (SDR, Helpdesk, Negociação, Onboarding, Suporte, Atendimento Comercial) vinculados exclusivamente ao seu contexto.

---

## 2. Contexto de negócio

O agente é o produto central da plataforma. Cada tenant configura seus próprios agentes com prompt, personalidade, base de conhecimento e canal de atendimento. Um agente SDR da Devolus tem comportamento diferente de um SDR da Fast4Sign. O sistema de prompts é versionado para permitir rollback, auditoria e experimentação (A/B de prompts).

---

## 3. Problema que resolve

Sem o Agent Builder, o tenant não consegue criar agentes customizados para seu negócio. Sem versionamento de prompts, qualquer mudança de comportamento é irrastreável e irreversível.

---

## 4. Regras de negócio

1. Um agente pertence a exatamente um tenant — isolamento obrigatório.
2. O nome do agente deve ser único dentro do mesmo tenant.
3. Um agente é criado com status `DRAFT` e deve ser explicitamente ativado (`ACTIVE`).
4. Agentes com status `ARCHIVED` não aceitam novas conversas.
5. O system prompt é versionado: cada publicação cria uma `AgentPromptVersion` imutável.
6. Um agente sempre tem exatamente uma versão de prompt `ACTIVE` por vez.
7. Ao publicar uma nova versão, a anterior muda para `SUPERSEDED` automaticamente.
8. Um tenant pode ter no máximo **10 agentes ativos** simultaneamente (configurável por plano).
9. O campo `slug` do agente é único por tenant e segue o padrão `[a-z0-9-]+`.
10. Um agente deve ter pelo menos um `AgentType` definido.
11. Ao arquivar um agente, conversas em andamento são finalizadas no próximo turno.
12. Somente usuários com role `TENANT_ADMIN` ou `TENANT_OPERATOR` podem criar e editar agentes.

---

## 5. Fluxos principais

### Criar agente
```
1. Operador preenche: nome, slug, tipo, canal, prompt inicial
2. Sistema valida unicidade do slug dentro do tenant
3. Sistema valida limite de agentes ativos do plano
4. Sistema cria Agent com status DRAFT
5. Sistema cria AgentPromptVersion v1 com status DRAFT
6. Retorna agent com promptVersion
```

### Publicar prompt (ativar versão)
```
1. Operador submete novo system prompt
2. Sistema cria AgentPromptVersion com status DRAFT
3. Operador aprova → Sistema marca versão anterior como SUPERSEDED
4. Nova versão recebe status ACTIVE
5. Agente passa para status ACTIVE (se estava DRAFT)
```

### Arquivar agente
```
1. Admin/Operador solicita arquivamento
2. Sistema verifica se há conversas ativas
3. Sistema marca agente como ARCHIVED
4. Conversas ativas recebem flag para encerrar no próximo turno
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Slug duplicado no tenant | 409 com `SLUG_ALREADY_TAKEN` |
| Nome duplicado no tenant | 409 com `AGENT_NAME_TAKEN` |
| Limite de agentes ativos atingido | 422 com `AGENT_LIMIT_REACHED` |
| Agente não encontrado | 404 com `AGENT_NOT_FOUND` |
| Agente de outro tenant | 404 (nunca 403 — não revela existência) |
| Usuário sem permissão | 403 com `FORBIDDEN` |
| Publicar prompt em agente ARCHIVED | 422 com `AGENT_ARCHIVED` |
| Prompt vazio ou menor que 10 chars | 422 com `VALIDATION_ERROR` |

---

## 7. Critérios de aceite

- Dado tenant válido e dados corretos, quando criar agente, então agente criado com status `DRAFT` e prompt v1 associado
- Dado nome duplicado no mesmo tenant, quando criar agente, então retorna `AGENT_NAME_TAKEN`
- Dado slug duplicado no mesmo tenant, quando criar agente, então retorna `SLUG_ALREADY_TAKEN`
- Dado agente de outro tenant, quando buscar por ID, então retorna 404 (isolamento)
- Dado operador sem role adequada, quando criar agente, então retorna 403
- Dado agente em DRAFT, quando publicar prompt, então agente muda para ACTIVE e prompt para ACTIVE
- Dado nova versão publicada, quando já existe ACTIVE, então anterior muda para SUPERSEDED
- Dado limite de plano atingido, quando criar agente, então retorna `AGENT_LIMIT_REACHED`
- Dado agente ARCHIVED, quando publicar prompt, então retorna `AGENT_ARCHIVED`
- Dado agente ACTIVE, quando arquivar, então status muda para ARCHIVED

---

## 8. Contratos de entrada e saída

```typescript
// POST /api/v1/agents
type CreateAgentInput = {
  name: string          // 3–100 chars
  slug: string          // 3–50 chars, [a-z0-9-]+
  type: AgentType
  description?: string  // até 500 chars
  systemPrompt: string  // mínimo 10 chars
}

enum AgentType {
  SDR          = 'SDR',
  HELPDESK     = 'HELPDESK',
  NEGOTIATION  = 'NEGOTIATION',
  ONBOARDING   = 'ONBOARDING',
  SUPPORT      = 'SUPPORT',
  SALES        = 'SALES',
}

enum AgentStatus {
  DRAFT    = 'DRAFT',
  ACTIVE   = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

enum PromptVersionStatus {
  DRAFT      = 'DRAFT',
  ACTIVE     = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}

type AgentOutput = {
  id: string
  tenantId: string
  name: string
  slug: string
  type: AgentType
  description: string | null
  status: AgentStatus
  activePromptVersion: {
    id: string
    version: number
    status: PromptVersionStatus
    createdAt: string
  } | null
  createdAt: string
  updatedAt: string
}

// PATCH /api/v1/agents/:id/prompt
type PublishPromptInput = {
  systemPrompt: string   // mínimo 10 chars
}

// PATCH /api/v1/agents/:id/status
type UpdateAgentStatusInput = {
  status: 'ACTIVE' | 'ARCHIVED'
}

// Erros
type AgentError =
  | 'AGENT_NOT_FOUND'
  | 'AGENT_NAME_TAKEN'
  | 'SLUG_ALREADY_TAKEN'
  | 'AGENT_LIMIT_REACHED'
  | 'AGENT_ARCHIVED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
```

---

## 9. Impacto arquitetural

- [ ] Nova tabela: `agents` — id, tenantId, name, slug, type, description, status
- [ ] Nova tabela: `agent_prompt_versions` — id, agentId, tenantId, systemPrompt, version (int), status
- [ ] Nova entidade: `Agent`
- [ ] Nova entidade: `AgentPromptVersion`
- [ ] Novos use-cases: `CreateAgent`, `PublishAgentPrompt`, `UpdateAgentStatus`, `GetAgent`, `ListAgents`
- [ ] Novas API routes:
  - `POST /api/v1/agents`
  - `GET /api/v1/agents`
  - `GET /api/v1/agents/:id`
  - `PATCH /api/v1/agents/:id/prompt`
  - `PATCH /api/v1/agents/:id/status`
- [ ] Prisma schema: adicionar `Agent` e `AgentPromptVersion`
- [ ] RLS: `agents` e `agent_prompt_versions` filtrados por `tenantId`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Tenant acessa agente de outro tenant | Baixa | Crítico | `tenantId` em todas as queries; retorna 404 sempre |
| Prompt injection via systemPrompt | Média | Alto | Sanitização + auditoria de prompts; aprovação para produção |
| Limite de agentes ignorado por race condition | Baixa | Médio | Unique constraint + transação no banco |
| Rollback de prompt quebrando conversa em andamento | Baixa | Médio | Conversa armazena ID da versão usada — não é afetada por rollback |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/agent/`):**
- [ ] `deve criar agente com status DRAFT e prompt v1`
- [ ] `deve rejeitar nome duplicado no mesmo tenant`
- [ ] `deve rejeitar slug duplicado no mesmo tenant`
- [ ] `deve rejeitar quando limite de agentes ativos for atingido`
- [ ] `deve rejeitar usuário sem permissão (TENANT_ADMIN ou TENANT_OPERATOR)`
- [ ] `deve publicar prompt e mover agente para ACTIVE`
- [ ] `deve mover versão anterior para SUPERSEDED ao publicar nova`
- [ ] `deve rejeitar publicação de prompt em agente ARCHIVED`
- [ ] `deve arquivar agente corretamente`
- [ ] `deve retornar null para agente de outro tenant`
- [ ] `deve listar apenas agentes do tenant da sessão`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve acessar agentes de tenant B`
- [ ] `contrato: POST /api/v1/agents retorna AgentOutput correto`
- [ ] `contrato: systemPrompt nunca é retornado em listagem`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** nome, descrição e system prompt do agente (dados do tenant, não dados pessoais de clientes)
- **Finalidade:** configuração do agente para atendimento
- **Retenção:** enquanto o tenant existir; excluído em cascata no `DeleteTenant`
- **Dados sensíveis:** system prompt pode conter estratégias de negócio — tratado como dado confidencial do tenant
- **Audit log:** toda criação, edição e publicação de prompt registrada com `userId` e `tenantId`
- **KDL:** prompts e configurações de agentes NÃO entram na KDL — são dados privados de negócio do tenant

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todas as queries de `agents` e `agent_prompt_versions`
- Busca por ID sempre inclui `WHERE tenantId = session.tenantId` — retorna 404 se não encontrado (nunca 403)
- RLS no PostgreSQL: `agents` e `agent_prompt_versions` têm policy por `tenantId`
- Listagem filtra exclusivamente pelo `tenantId` da sessão — sem parâmetro de query para mudar tenant
- Testes de isolamento: agentes de tenant A invisíveis para tenant B em todos os use-cases
