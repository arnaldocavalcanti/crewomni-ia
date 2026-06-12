# Spec: Seção de Membros da Crew na Página de Detalhe

**Data:** 2026-06-11  
**Status:** APPROVED  
**Contexto:** A gestão de membros de uma Crew estava escondida no formulário do agente, tornando impossível descobrir como adicionar agentes a uma crew a partir da própria página da crew.

---

## Objetivo

Adicionar uma seção **"Membros da Equipe"** na aba "Visão Geral" de `/dashboard/crews/:id` que permita visualizar, adicionar e remover agentes da crew sem sair da página.

---

## Comportamento

### Listagem

- Seção abaixo do formulário de edição, acima do `VisualWorkflowBuilder`
- Cada membro exibido em uma linha com:
  - Borda-left colorida: roxo `#7C3AED` para DIRECTOR, ciano `#06C8E8` para MEMBER
  - Nome do agente, tipo e status (Ativo / Rascunho)
  - Badge de role (🎯 DIRETOR / MEMBRO)
  - Botão ✕ para remover com confirmação inline

### Confirmação de remoção

- Ao clicar em ✕, a linha exibe: `"Remover [nome]?"` + botão `"Confirmar"` + link `"Cancelar"`
- Confirmação chama `DELETE /api/v1/crews/:id/members/:memberId`
- Sem reload — atualiza estado local

### Adicionar agente (Modal)

- Botão **"+ Adicionar Agente"** no topo direito da seção
- Abre modal com:
  - Dropdown de agentes do tenant que **não são membros desta crew**
  - Seletor de role: DIRECTOR / MEMBER
  - Se já existe DIRECTOR: opção DIRECTOR desabilitada com tooltip `"Já existe um Diretor nesta equipe"`
  - Botão "Adicionar" — chama `POST /api/v1/crews/:id/members`
  - Fecha modal e atualiza lista local

### Sincronização com Test Lab

- A página extrai `loadCrew()` como função reutilizável do `useEffect` atual
- Após adicionar/remover membro, chama `loadCrew()` para re-sincronizar `members` (compartilhado com `CrewTestLab`)

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/crews/CrewMembersSection.tsx` | Novo componente |
| `src/app/(dashboard)/dashboard/crews/[id]/page.tsx` | Importa componente; extrai `loadCrew`; passa `onMembersChange` callback |

---

## Contratos de API usados

Todos já existem em `src/lib/api.ts`:

- `api.crews.get(id)` → `{ crew, members[] }` — carrega membros atuais
- `api.agents.list()` → lista todos os agentes do tenant (para o dropdown)
- `api.crews.addMember(crewId, { agentId, role, order })` → adiciona membro
- `api.crews.removeMember(crewId, memberId)` → remove membro

---

## Estados do componente

```
members: MemberItem[]           // lista atual de membros
availableAgents: AgentItem[]    // agentes do tenant não membros desta crew
showModal: boolean
selectedAgentId: string
selectedRole: 'DIRECTOR' | 'MEMBER'
removingId: string | null       // id do membro em confirmação de remoção
isAdding: boolean               // loading do POST
```

---

## Regras de negócio

1. Não pode ter mais de 1 DIRECTOR por crew — opção bloqueada no modal se já existe
2. Remoção do único membro é permitida (a crew ficará sem membros — aviso no Test Lab já existe)
3. Dropdown de adição filtra agentes já membros desta crew

---

## Não está no escopo

- Reordenação de membros (drag-and-drop)
- Edição de role inline após adição (usuário remove e re-adiciona se quiser mudar)
- Paginação (equipes raramente têm mais de 10 agentes)
