---
trigger: always_on
---

# Execution Workflow — CrewOmni

Status: Mandatory

Priority: MAXIMUM

Applies To:

* Claude
* Gemini
* Codex
* Superpowers Agents
* Future CrewOmni Agents

---

# Objetivo

Garantir que todos os agentes trabalhem de forma consistente, previsível, auditável e alinhada à visão do produto CrewOmni.

Nenhum agente pode iniciar implementação sem seguir o fluxo definido neste documento.

---

# Ordem Obrigatória de Leitura

Antes de qualquer tarefa, os agentes DEVEM ler os documentos abaixo na ordem exata.

## Etapa 1 — Entendimento do Produto

Ler:

```text
/docs/product/product-charter.md
```

Objetivo:

Entender:

* propósito
* visão
* missão
* princípios
* limites
* estratégia

Se houver conflito entre qualquer documento e o Product Charter:

O Product Charter sempre vence.

---

## Etapa 2 — Entendimento do Projeto Atual

Ler:

```text
CONTEXT.md
```

Objetivo:

Entender:

* arquitetura atual
* stack atual
* módulos implementados
* APIs existentes
* roadmap
* decisões técnicas

---

## Etapa 3 — Entendimento Arquitetural

Ler:

```text
/docs/adr/*
```

Objetivo:

Entender:

* decisões técnicas aprovadas
* padrões arquiteturais
* restrições do projeto

Nenhum agente pode violar uma ADR aprovada sem propor nova ADR.

---

## Etapa 4 — Entendimento da Feature

Ler:

```text
/docs/specs/<dominio>/<feature>.md
```

Objetivo:

Entender:

* regras de negócio
* fluxos
* critérios de aceite
* requisitos LGPD
* isolamento multi-tenant

---

# Fluxo Obrigatório SDD

Toda funcionalidade deve seguir:

```text
Ideia
 ↓
Spec
 ↓
Review
 ↓
Approval
 ↓
Tests
 ↓
Implementation
 ↓
Review
 ↓
Merge
```

Implementação antes da spec é proibida.

---

# Fluxo Obrigatório TDD

Toda funcionalidade deve seguir:

```text
Spec aprovada
 ↓
Testes
 ↓
Falha dos testes (RED)
 ↓
Implementação
 ↓
Testes passando (GREEN)
 ↓
Refatoração
```

---

# Uso Obrigatório das Skills Superpowers

Sempre que disponível, os agentes devem utilizar as skills do Superpowers.

---

## Planejamento

Antes de iniciar qualquer implementação:

Executar:

```text
plan
```

Objetivo:

* decompor tarefas
* identificar dependências
* identificar riscos
* validar impacto arquitetural

Nenhuma implementação deve iniciar sem planejamento.

---

## Code Review

Após qualquer implementação:

Executar:

```text
code-review
```

Objetivo:

* detectar bugs
* validar padrões
* validar aderência ao Product Charter
* validar aderência ao CONTEXT
* validar aderência às ADRs
* validar aderência às specs

---

## Security Review

Sempre que houver:

* autenticação
* autorização
* LGPD
* APIs
* integrações externas

Executar:

```text
security-review
```

---

## Architecture Review

Sempre que houver:

* novos domínios
* novos módulos
* novas integrações
* alterações estruturais

Executar:

```text
architecture-review
```

---

## Test Review

Sempre que houver novos testes:

Executar:

```text
test-review
```

---

# Critérios de Bloqueio

O agente deve interromper imediatamente a execução quando:

* não existir Product Charter
* não existir CONTEXT atualizado
* não existir spec aprovada
* existir conflito com ADR
* existir risco de violação multi-tenant
* existir risco LGPD
* existir risco de vazamento de dados

---

# Regras Específicas do CrewOmni

Nunca:

* compartilhar dados entre tenants
* acessar conhecimento privado de outro tenant
* ignorar isolamento multi-tenant
* ignorar LGPD
* criar implementação sem testes
* criar implementação sem spec

Sempre:

* registrar decisões importantes em ADR
* registrar novas funcionalidades em specs
* atualizar CONTEXT quando necessário
* atualizar Product Charter somente com aprovação humana

---

# Ordem de Execução Oficial

```text
1. Product Charter
        ↓
2. CONTEXT
        ↓
3. ADRs
        ↓
4. Spec
        ↓
5. Planejamento (Superpowers)
        ↓
6. Testes
        ↓
7. Implementação
        ↓
8. Code Review (Superpowers)
        ↓
9. Security Review (Superpowers)
        ↓
10. Atualização da documentação
```

Esta ordem é obrigatória para todos os agentes do projeto.
