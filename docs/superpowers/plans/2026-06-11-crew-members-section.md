# Crew Members Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Membros da Equipe" section to the crew detail page that lets users view, add, and remove agents from a crew without leaving the page.

**Architecture:** New `CrewMembersSection` component handles all member state. The parent page extracts `loadCrew()` as a reusable function and passes it as `onRefresh` so the Test Lab always shows fresh members after mutations.

**Tech Stack:** React (useState, useCallback), Next.js App Router, Tailwind CSS, shadcn/base-ui primitives, `src/lib/api.ts` (already has all needed endpoints).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/crews/CrewMembersSection.tsx` | **Create** | List members + remove confirmation + add modal |
| `src/app/(dashboard)/dashboard/crews/[id]/page.tsx` | **Modify** | Extract `loadCrew`, add `id` to `CrewMember` type, render `CrewMembersSection` |

---

### Task 1: Extend `CrewMember` type and extract `loadCrew` in the page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/crews/[id]/page.tsx`

- [ ] **Step 1.1: Add `id` to `CrewMember` type and extract `loadCrew`**

In `src/app/(dashboard)/dashboard/crews/[id]/page.tsx`, replace:

```tsx
type CrewMember = {
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}
```

With:

```tsx
type CrewMember = {
  id: string
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}
```

- [ ] **Step 1.2: Extract `loadCrew` function**

Replace the `useEffect` block (lines ~51–71) with:

```tsx
const loadCrew = useCallback(() => {
  api.crews.get(id as string)
    .then((res) => {
      const crew = res.crew
      setName(crew.name)
      setObjective(crew.objective ?? '')
      setDescription(crew.description ?? '')
      setStatus(crew.status)
      const mappedMembers = ((res as any).members ?? []).map((m: any) => ({
        id: m.id,
        agentId: m.agentId,
        agentName: m.agent?.name ?? m.agentId,
        role: m.role,
      }))
      setMembers(mappedMembers)
    })
    .catch((err) => {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError('Erro ao carregar crew.')
    })
    .finally(() => setLoading(false))
}, [id])

useEffect(() => { loadCrew() }, [loadCrew])
```

Add `useCallback` to the imports from `'react'`.

- [ ] **Step 1.3: Verify the page still loads correctly**

Run the dev server and navigate to `/dashboard/crews/[some-id]`. The page should load the crew data exactly as before.

- [ ] **Step 1.4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/crews/[id]/page.tsx"
git commit -m "refactor(crew-page): extract loadCrew, add id to CrewMember type"
```

---

### Task 2: Create `CrewMembersSection` — list and remove

**Files:**
- Create: `src/components/crews/CrewMembersSection.tsx`

- [ ] **Step 2.1: Create the component file**

Create `src/components/crews/CrewMembersSection.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { api, ApiError, type AgentListItem } from '@/lib/api'

export type CrewMember = {
  id: string
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}

type Props = {
  crewId: string
  members: CrewMember[]
  onRefresh: () => void
}

const ROLE_LABEL: Record<string, string> = {
  DIRECTOR: '🎯 DIRETOR',
  MEMBER: 'MEMBRO',
  OBSERVER: 'OBSERVADOR',
}

const ROLE_COLORS: Record<string, { border: string; badge: string; text: string }> = {
  DIRECTOR: { border: '#7C3AED', badge: 'bg-purple-500/10 text-purple-400', text: 'text-purple-400' },
  MEMBER:   { border: '#06C8E8', badge: 'bg-cyan-500/10 text-cyan-400',    text: 'text-cyan-400' },
  OBSERVER: { border: '#6B7280', badge: 'bg-gray-500/10 text-gray-400',    text: 'text-gray-400' },
}

export function CrewMembersSection({ crewId, members, onRefresh }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const handleRemove = useCallback(async (memberId: string) => {
    setRemoving(true)
    setRemoveError(null)
    try {
      await api.crews.removeMember(crewId, memberId)
      setConfirmingId(null)
      onRefresh()
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : 'Erro ao remover membro.')
    } finally {
      setRemoving(false)
    }
  }, [crewId, onRefresh])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Membros da Equipe</h3>
          <p className="text-xs text-muted-foreground">{members.length} agente{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#4F6EF7] text-white hover:opacity-90 transition-opacity"
        >
          + Adicionar Agente
        </button>
      </div>

      {removeError && (
        <p className="text-xs text-destructive">{removeError}</p>
      )}

      {members.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          Nenhum agente adicionado ainda. Clique em "+ Adicionar Agente" para começar.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const colors = ROLE_COLORS[m.role] ?? ROLE_COLORS.OBSERVER
            const isConfirming = confirmingId === m.id
            return (
              <div
                key={m.id}
                className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2.5 border border-border"
                style={{ borderLeft: `3px solid ${colors.border}` }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: `${colors.border}18`, border: `1px solid ${colors.border}40` }}
                  >
                    🤖
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.agentName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${colors.badge}`}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Remover?</span>
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={removing}
                        className="text-destructive font-semibold hover:underline disabled:opacity-50"
                      >
                        {removing ? '...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setConfirmingId(m.id); setRemoveError(null) }}
                      className="text-muted-foreground hover:text-destructive transition-colors text-base leading-none px-1"
                      title="Remover da crew"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddMemberModal
          crewId={crewId}
          existingMemberAgentIds={members.map((m) => m.agentId)}
          hasDirector={members.some((m) => m.role === 'DIRECTOR')}
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); onRefresh() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2.2: Verify the component renders without the modal**

This will be verified after wiring into the page in Task 3. Leave this step for then.

---

### Task 3: Create `AddMemberModal` — add to `CrewMembersSection.tsx`

**Files:**
- Modify: `src/components/crews/CrewMembersSection.tsx` (append `AddMemberModal` component)

- [ ] **Step 3.1: Append `AddMemberModal` to the same file**

Add at the bottom of `src/components/crews/CrewMembersSection.tsx` (add `useEffect` to the react import at the top of the file first):

```tsx
type ModalProps = {
  crewId: string
  existingMemberAgentIds: string[]
  hasDirector: boolean
  onClose: () => void
  onAdded: () => void
}

function AddMemberModal({ crewId, existingMemberAgentIds, hasDirector, onClose, onAdded }: ModalProps) {
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [role, setRole] = useState<'DIRECTOR' | 'MEMBER'>('MEMBER')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available agents on mount
  useEffect(() => {
    api.agents.list()
      .then((list) => {
        const available = list.filter((a) => !existingMemberAgentIds.includes(a.id))
        setAgents(available)
        if (available.length > 0) setSelectedAgentId(available[0].id)
      })
      .catch(() => setError('Erro ao carregar agentes.'))
      .finally(() => setLoadingAgents(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!selectedAgentId) return
    setIsAdding(true)
    setError(null)
    try {
      await api.crews.addMember(crewId, { agentId: selectedAgentId, role, order: 0 })
      onAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao adicionar membro.')
      setIsAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Adicionar Agente à Crew</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {loadingAgents ? (
          <p className="text-sm text-muted-foreground">Carregando agentes…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os agentes disponíveis já são membros desta crew.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agente</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4F6EF7]"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.type} ({a.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Papel na Crew</label>
              <div className="flex gap-2">
                {(['MEMBER', 'DIRECTOR'] as const).map((r) => {
                  const disabled = r === 'DIRECTOR' && hasDirector
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setRole(r)}
                      title={disabled ? 'Já existe um Diretor nesta equipe' : undefined}
                      className={[
                        'flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors',
                        role === r && !disabled
                          ? r === 'DIRECTOR'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                            : 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : disabled
                          ? 'border-border bg-secondary/20 text-muted-foreground/40 cursor-not-allowed'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/40',
                      ].join(' ')}
                    >
                      {r === 'DIRECTOR' ? '🎯 Diretor' : 'Membro'}
                    </button>
                  )
                })}
              </div>
              {hasDirector && (
                <p className="text-[11px] text-muted-foreground">Já existe um Diretor nesta equipe.</p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={isAdding || !selectedAgentId}
                className="flex-1 py-2 rounded-lg bg-[#4F6EF7] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isAdding ? 'Adicionando…' : 'Adicionar'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary/40 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

> **Atenção:** O import de `useEffect` no topo de `CrewMembersSection.tsx` deve ser atualizado para `import { useState, useCallback, useEffect } from 'react'`.

---

### Task 4: Wire `CrewMembersSection` into the crew page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/crews/[id]/page.tsx`

- [ ] **Step 4.1: Import `CrewMembersSection`**

Add to the imports at the top of `page.tsx`:

```tsx
import { CrewMembersSection } from '@/components/crews/CrewMembersSection'
```

Remove the local `type CrewMember` declaration from `page.tsx` and import it from the component instead:

```tsx
import { CrewMembersSection, type CrewMember } from '@/components/crews/CrewMembersSection'
```

- [ ] **Step 4.2: Add `CrewMembersSection` to the Overview tab**

In the Overview tab section of `page.tsx`, add the component after `</form>` and before `<div className="pt-8 mt-8 border-t ...">` (the VisualWorkflowBuilder block):

```tsx
<div className="pt-8 mt-8 border-t border-border">
  <CrewMembersSection
    crewId={id as string}
    members={members}
    onRefresh={loadCrew}
  />
</div>

<div className="pt-8 mt-8 border-t border-border">
  <VisualWorkflowBuilder crewId={id as string} />
</div>
```

- [ ] **Step 4.3: Test the full flow manually**

1. Navigate to `/dashboard/crews/[id]` with a crew that has at least one member
2. Confirm members are listed with correct role badges and colored borders
3. Click ✕ on a member → confirm inline prompt appears → click "Cancelar" → confirm nothing changed
4. Click ✕ on a member → click "Confirmar" → confirm member is removed and list updates
5. Click "+ Adicionar Agente" → modal opens with dropdown of available agents
6. Select an agent, choose role, click "Adicionar" → modal closes, member appears in list
7. Verify that if a DIRECTOR exists, the DIRECTOR role button is disabled in the modal
8. Switch to "🧪 Test Lab" tab → confirm the members panel reflects the updated list

- [ ] **Step 4.4: Fix TypeScript errors (if any)**

Run:

```bash
/usr/local/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep "crews\[id\]\|CrewMembers" | head -20
```

Fix any type errors before committing.

- [ ] **Step 4.5: Commit**

```bash
git add "src/components/crews/CrewMembersSection.tsx" "src/app/(dashboard)/dashboard/crews/[id]/page.tsx"
git commit -m "feat(crew): add members section with add/remove modal on crew detail page"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Lista vertical ✓ · borda colorida por role ✓ · badge de role ✓ · remoção com confirmação inline ✓ · modal de adição ✓ · dropdown filtra membros existentes ✓ · DIRECTOR bloqueado se já existe ✓ · sincronização com Test Lab via `onRefresh` ✓
- [x] **No placeholders:** Todos os steps têm código completo
- [x] **Type consistency:** `CrewMember.id` adicionado em Task 1 e usado em Task 2; `api.crews.removeMember(crewId, memberId)` usa `m.id`; `api.crews.addMember` usa os campos corretos do tipo existente em `api.ts`
- [x] **`useEffect` para load de agentes:** corrigido de `useState` (padrão errado) para `useEffect` no `AddMemberModal`
