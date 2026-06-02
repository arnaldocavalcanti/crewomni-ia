# Crew Builder

> **Status:** APPROVED
> **Domínio:** crew
> **Autor:** @crewomni
> **Data:** 2026-06-02

---

## 1. Objetivo

Permitir que cada tenant crie Crews (equipes de agentes com objetivo comum) dentro de um Department, com membros que têm papéis definidos (DIRECTOR, MEMBER, OBSERVER) e ordem no workflow.

---

## 2. Contexto de negócio

Uma Crew representa uma equipe de agentes trabalhando em conjunto para um objetivo de negócio. Ex: Crew Comercial com Lead Hunter → SDR → Negotiator → Closer. O Director orquestra a crew sem necessariamente conversar com o cliente final.

---

## 3. Problema que resolve

Sem Crew, os agentes existem isolados. Com Crew, o tenant pode montar equipes coesas, definir papéis, ordem de atuação e um orquestrador (Director) — base para o Crew Chat e Workflow das fases seguintes.

---

## 4. Regras de negócio

1. Uma Crew pertence a exatamente um Tenant e um Department.
2. O Department deve pertencer ao mesmo Tenant da Crew.
3. O name deve ser único dentro do tenant.
4. O slug é gerado automaticamente do name.
5. Status padrão é DRAFT.
6. Um Agent pode pertencer a múltiplas Crews (N:N via CrewMember).
7. O mesmo Agent não pode entrar duas vezes na mesma Crew (UNIQUE crewId+agentId).
8. Máximo 1 membro com role=DIRECTOR por Crew.
9. Um Agent de outro tenant não pode ser adicionado à Crew.
10. Deletar uma Crew com membros é proibido.
11. tenantId vem exclusivamente da sessão JWT.
12. Busca de recurso de outro tenant retorna 404.

---

## 5. Fluxos principais

### Criar Crew
1. POST /api/v1/crews com { departmentId, name, description?, objective? }
2. Valida department pertence ao tenant.
3. Gera slug. Valida unicidade de name.
4. Persiste em status DRAFT.

### Adicionar Agente à Crew
1. POST /api/v1/crews/:id/members com { agentId, role, order, isRequired? }
2. Valida crew e agent pertencem ao tenant.
3. Valida UNIQUE(crewId, agentId).
4. Valida max 1 DIRECTOR por crew.
5. Persiste CrewMember.

### Remover Agente da Crew
1. DELETE /api/v1/crews/:id/members/:memberId
2. Valida membro pertence ao tenant.
3. Hard-delete.

---

## 6. Fluxos alternativos

- name duplicado → 409 CREW_NAME_TAKEN
- departmentId de outro tenant → 404 DEPARTMENT_NOT_FOUND
- crew de outro tenant → 404 CREW_NOT_FOUND
- agent de outro tenant → 404 AGENT_NOT_FOUND
- duplicate (crewId+agentId) → 409 AGENT_ALREADY_IN_CREW
- segundo DIRECTOR → 409 CREW_ALREADY_HAS_DIRECTOR
- delete com membros → 422 CREW_HAS_MEMBERS

---

## 7. Critérios de aceite

- [ ] POST /api/v1/crews cria crew com status DRAFT.
- [ ] GET /api/v1/crews retorna apenas crews do tenant.
- [ ] GET /api/v1/crews/:id retorna crew com members incluídos.
- [ ] POST /api/v1/crews/:id/members adiciona agent com role e order.
- [ ] Não é possível adicionar 2 DIRECTORs na mesma crew.
- [ ] Não é possível usar agent de outro tenant.
- [ ] DELETE /api/v1/crews/:id falha se crew tiver membros.

---

## 8. Contratos

POST /api/v1/crews → 201 Crew
GET /api/v1/crews?departmentId=X → 200 Crew[]
GET /api/v1/crews/:id → 200 Crew & { members: CrewMember[] }
POST /api/v1/crews/:id/members → 201 CrewMember
DELETE /api/v1/crews/:id/members/:memberId → 204

---

## 9. Impacto arquitetural

- Novo domínio: src/domains/crew/
- Novas tabelas: crews, crew_members
- Fase 1.3: dashboard UI
- Fase 1.4: StartCrewConversation usa crew para rotear ao DIRECTOR
- Fase 1.5: handoffRules adicionado ao CrewMember via migration

---

## 10. Riscos

- Segundo DIRECTOR acidental: mitigado pelo guard countDirectors no AddAgentToCrew.
- Delete de crew com membros ativos: mitigado pelo guard countByCrew no DeleteCrew.

---

## 11. Testes esperados

Ver tests/unit/domains/crew/*.test.ts — 8 arquivos cobrindo todos os use-cases.

---

## 12. Critérios LGPD

Crew e CrewMember não contêm dados pessoais. Cascade delete ao deletar tenant.

---

## 13. Critérios de isolamento multi-tenant

- tenantId da sessão JWT.
- findById(id, tenantId) filtra por ambos.
- Agent de outro tenant → 404.
- Department de outro tenant → 404.
