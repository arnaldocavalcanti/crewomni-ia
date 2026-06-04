# Design: Fase 1.3 — Crew Dashboard

**Data:** 2026-06-04
**Status:** APPROVED
**Branch:** feat/fase-1-3-crew-dashboard
**Próxima fase:** 1.4 — Crew Chat básico

---

## Contexto

A Fase 1.2 implementou o backend completo de Crew e CrewMember (8 use-cases, 8 APIs). A Fase 1.3 implementa o dashboard UI para que os tenants possam criar, visualizar e gerenciar crews e seus membros.

---

## Decisões do brainstorming

| Decisão | Escolha | Motivo |
|---|---|---|
| Navegação para Crews | Item "Crews" na sidebar | Acesso direto, consistente com Agents/Departments |
| Gerenciamento de membros | Modal inline na página de detalhe | UX fluida sem perder contexto |
| Filtro de crews | Tabs por department na lista | Hierarquia visível sem sub-navegação |
| Criar crew | Página `/dashboard/crews/new` | Padrão estabelecido pelo projeto |

---

## Arquitetura de UI

### Novas rotas

```
src/app/(dashboard)/dashboard/crews/
├── page.tsx              ← lista com filtro por department
├── new/
│   └── page.tsx          ← formulário de criação
└── [id]/
    └── page.tsx          ← detalhe + membros + modal
```

### Modificações em arquivos existentes

```
src/app/(dashboard)/dashboard/layout.tsx  ← + "Crews" no NAV
src/lib/api.ts                            ← + seção crews + tipos
```

---

## api.ts — Adições

### Tipos novos

```typescript
export type CrewItem = {
  id: string
  tenantId: string
  departmentId: string
  name: string
  slug: string
  description: string | null
  objective: string | null
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export type CrewMemberItem = {
  id: string
  tenantId: string
  crewId: string
  agentId: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
  order: number
  isRequired: boolean
  createdAt: string
}

export type CreateCrewPayload = {
  departmentId: string
  name: string
  description?: string
  objective?: string
}

export type AddCrewMemberPayload = {
  agentId: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
  order: number
  isRequired?: boolean
}
```

### Seção crews no objeto api

```typescript
crews: {
  list: (departmentId?: string) => request<CrewItem[]>(
    `/crews${departmentId ? `?departmentId=${departmentId}` : ''}`
  ),
  get: (id: string) => request<{ crew: CrewItem; members: CrewMemberItem[] }>(`/crews/${id}`),
  create: (data: CreateCrewPayload) =>
    request<CrewItem>('/crews', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<CrewItem, 'name' | 'description' | 'objective' | 'status'>>) =>
    request<CrewItem>(`/crews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addMember: (crewId: string, data: AddCrewMemberPayload) =>
    request<CrewMemberItem>(`/crews/${crewId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  listMembers: (crewId: string) =>
    request<CrewMemberItem[]>(`/crews/${crewId}/members`),
  removeMember: (crewId: string, memberId: string) =>
    request<void>(`/crews/${crewId}/members/${memberId}`, { method: 'DELETE' }),
},
```

---

## layout.tsx — Modificação

Adicionar `Users` ao import do lucide-react e inserir no array NAV após Departments:

```typescript
{ href: '/dashboard/crews', label: 'Crews', icon: Users },
```

---

## Página 1: Lista de Crews (`/dashboard/crews`)

### Comportamento

- Carrega departments via `api.departments.list()` para montar as tabs
- Tab "Todos" chama `api.crews.list()` (sem filtro)
- Tabs de department chamam `api.crews.list(departmentId)`
- Skeleton loading de 3 cards durante fetch
- Estado vazio com ícone `Users` e CTA "Criar primeira crew"

### Layout

```
Header: "Crews" + subtítulo + botão [+ Nova Crew]
Tabs: [Todos] [dept-1] [dept-2] ...
Grid: 3 colunas → cards com:
  - borda esquerda colorida por status (emerald=ACTIVE, cinza=outros)
  - nome da crew (bold)
  - nome do department (muted)
  - slug em font-mono com ícone Hash
  - contagem de membros (via GET /crews/:id ou campo futuro)
  - badge de status
  - click no card → /dashboard/crews/:id
```

**Nota:** a contagem de membros na lista requer um GET por crew. Para MVP, omitir contagem na lista e exibir apenas na página de detalhe. Alternativa: buscar todos e mostrar "N membros" quando disponível via campo membro da API de detalhe.

**Decisão MVP:** exibir cards sem contagem de membros — a contagem aparece na página de detalhe.

---

## Página 2: Criar Crew (`/dashboard/crews/new`)

### Campos

| Campo | Tipo | Regra |
|---|---|---|
| Department | Select (required) | Carregado via api.departments.list() |
| Nome | Input (required) | min 2, max 100 |
| Objetivo | Input (optional) | max 500 |
| Descrição | Textarea (optional) | max 500, com contador |

### Comportamento

- Slug preview em tempo real (mesmo `generateSlug` do frontend de Departments)
- Após criação bem-sucedida → redirect para `/dashboard/crews/:id`
- Erro `CREW_NAME_TAKEN` → mensagem inline abaixo do campo Nome
- Erro `DEPARTMENT_NOT_FOUND` → mensagem inline (edge case)
- Select de department desabilitado e com spinner enquanto carrega

---

## Página 3: Detalhe da Crew (`/dashboard/crews/[id]`)

### Seções

**Header da crew:**
- Nome (h1)
- Nome do department + slug em mono
- Objetivo (se existir)
- Dropdown de status (DRAFT/ACTIVE/INACTIVE) — chama api.crews.update inline

**Seção Membros:**
- Título "Membros (N)" + botão [+ Adicionar Agente]
- Lista ordenada por `order` ASC
- Cada linha: ícone `★` para DIRECTOR / número para outros · nome do agente · badge de role · botão `🗑` remover
- Director destacado com cor diferente (amber/yellow)
- Estado vazio: "Nenhum membro — adicione agentes para compor a crew"

**Modal "Adicionar Agente"** (shadcn Dialog):
- Select de agente: carregado via `api.agents.list()`, filtra agentes já na crew client-side
- Radio group de role: DIRECTOR / MEMBER / OBSERVER
- Input de order: default = número de membros atuais
- Botão [Adicionar] → chama api.crews.addMember → fecha modal → atualiza lista
- Erros inline no modal:
  - `CREW_ALREADY_HAS_DIRECTOR` → "Esta crew já possui um Director"
  - `AGENT_ALREADY_IN_CREW` → "Este agente já está na crew"

**Remover membro:**
- Click no `🗑` → confirm via `window.confirm` simples → chama api.crews.removeMember → atualiza lista

---

## Testes

Esta fase é UI — sem novos testes unitários de domínio. Os 231 testes existentes não são alterados.

Verificação manual:
- [ ] Lista de crews exibe por department
- [ ] Criar crew redireciona para detalhe
- [ ] Adicionar agente com role DIRECTOR funciona
- [ ] Segundo DIRECTOR mostra erro no modal
- [ ] Remover membro atualiza lista
- [ ] Crew de outro tenant retorna 404 (via API)

---

## LGPD e isolamento

- UI nunca exibe tenantId
- Todos os requests passam JWT via api.ts (token automático)
- Nenhum dado de outro tenant é acessível — garantido pelo backend

---

## Impacto em Fase 1.4

A página `/dashboard/crews/:id` será a base da Fase 1.4 (Crew Chat), que adicionará uma seção de "Chat de teste" abaixo dos membros.

---

## Ordem de implementação

```
1. api.ts — adicionar tipos e seção crews
2. layout.tsx — adicionar "Crews" ao NAV
3. /dashboard/crews/page.tsx — lista com tabs
4. /dashboard/crews/new/page.tsx — formulário de criação
5. /dashboard/crews/[id]/page.tsx — detalhe + modal
6. CONTEXT.md — atualizar estado
```
