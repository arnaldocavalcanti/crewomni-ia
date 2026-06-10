# Listagem de Agentes - Adaptação de Tipo para Papel (UX/UI)

> **Status:** REVIEW
> **Domínio:** agent
> **Autor:** @antigravity
> **Data:** 2026-06-10

---

## 1. Objetivo

Modificar o campo "Tipo" na listagem de agentes (`/dashboard/agents`) para exibir o "Papel" (Role) real de cada agente em vez do tipo estático (SDR) que vinha sendo renderizado incorretamente, aplicando uma adaptação de layout responsiva e robusta que comporta nomes de papéis longos sem quebrar ou desalinhamento da tabela.

---

## 2. Contexto de negócio

Os agentes na plataforma possuem papéis personalizados (`AgentRole`, ex: "Message Strategist", "Senior Backend Architect", "DBA") que definem sua especialidade e contexto operacional de forma muito mais precisa que a categoria genérica de tipo. A listagem de agentes atual exibia erroneamente o campo genérico de `AgentType` (SDR) para todos. Corrigir esse campo para exibir o Papel traz mais clareza operacional para o tenant sobre quais agentes estão configurados.

---

## 3. Problema que resolve

Evita que a listagem de agentes mostre informações incorretas/padronizadas ("SDR" para agentes que são de suporte, negociação, etc.). Resolve também o problema de quebra de layout visual da tabela caso o usuário configure papéis com nomes longos (como "Agente de Vendas e Negociação de Contratos de Real Estate"), garantindo que a interface permaneça limpa, profissional e alinhada ao design system **Gradient Shell**.

---

## 4. Regras de negócio

1. O campo "Tipo" na cabeçalho da tabela de listagem de agentes deve ser renomeado para "Papel".
2. O valor exibido na coluna "Papel" deve refletir o nome do papel associado ao agente (`roleName`).
3. Se o papel de um agente não for localizado, deve ser exibido o fallback "N/A".
4. Caso o nome do papel seja longo, o layout da tabela não deve sofrer quebras e o nome do papel deve ser truncado com reticências.
5. Ao passar o mouse (hover) sobre o papel truncado, o nome completo deve ser exibido por meio de uma dica de contexto (tooltip ou atributo native HTML `title`).

---

## 5. Fluxos principais

### Visualizar lista de agentes atualizada
```
1. Usuário acessa /dashboard/agents
2. O frontend chama GET /api/v1/agents
3. O use-case ListAgents resolve a listagem carregando os papéis de cada agente
4. O frontend renderiza a tabela com a coluna "Papel" preenchida com o nome real do papel
5. Se o nome do papel exceder o espaço disponível, o CSS o trunca adicionando "..." e exibe o tooltip com o nome completo ao passar o mouse
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Agente sem papel (roleId inválido ou deletado) | Retorna o fallback "N/A" |
| Nome do papel muito curto | Exibe o nome completo normalmente sem truncamento |

---

## 7. Critérios de aceite

- Dado um tenant com agentes com papéis customizados, quando listar os agentes, então a coluna "Papel" deve exibir o nome real do papel em vez de "SDR".
- Dado um papel com nome longo (ex: "Agente de Resolução de Conflitos"), quando visualizado na listagem, o texto deve ser truncado dinamicamente para não estourar o layout da tabela.
- Dado um papel truncado na listagem, quando o usuário realizar hover sobre ele, então o nome completo do papel deve ser visível.
- Dado que o use-case `ListAgents` é executado, então ele deve conter o campo `roleName` preenchido a partir do repositório de papéis.

---

## 8. Contratos de entrada e saída

```typescript
// GET /api/v1/agents
// Resposta estendida com campo roleName no AgentListItem
type AgentListItem = {
  id: string
  tenantId: string
  name: string
  slug: string
  type: string
  description: string | null
  status: string
  category: string
  roleId: string
  operationalFunction: string
  roleName: string // Novo campo obrigatório
  createdAt: string
  updatedAt: string
  activePromptVersion: {
    id: string
    version: number
    status: string
    createdAt: string
  } | null
}
```

---

## 9. Impacto arquitetural

- [ ] Alteração no use-case: `ListAgents` — injetar `IAgentRoleRepository` para mapear `roleName` nos agentes.
- [ ] Alteração nas assinaturas de teste de `ListAgents` para injetar o novo mock do repositório de papéis.
- [ ] Alteração no tipo `AgentListItem` em `src/domains/agent/use-cases/ListAgents.ts` e `src/lib/api.ts`.
- [ ] Alteração na página UI: `src/app/(dashboard)/dashboard/agents/page.tsx` — alterar coluna, texto e aplicar classes CSS de truncamento e acessibilidade.

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Lentidão ao buscar papéis para cada agente | Baixa | Baixo | Buscar todos os papéis do tenant em uma única query `roleRepo.list(tenantId)` e fazer o mapeamento em memória na aplicação. |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/agent/`):**
- [ ] `GetAndListAgents.test.ts`: atualizar teste de `ListAgents` para incluir a validação do `roleName` mapeado corretamente.

**Integração (`tests/integration/`):**
- [ ] `agent-isolation.test.ts`: atualizar injeção do use-case `ListAgents` incluindo o mock do `IAgentRoleRepository`.

---

## 12. Critérios LGPD e privacidade

Não há impacto adicional em LGPD, pois o nome do papel do agente é uma configuração estática do negócio e não contém dados de leads ou informações pessoais identificáveis.

---

## 13. Critérios de isolamento multi-tenant

Os papéis são buscados estritamente sob o escopo do `tenantId` fornecido na requisição (`roleRepo.list(tenantId)`), garantindo que nomes de papéis personalizados de um tenant A nunca sejam expostos para um tenant B.
