# Crew Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o dashboard UI de Crews — lista com filtro por department, criação de crew e página de detalhe com gestão completa de membros via modal.

**Architecture:** 3 novas páginas no App Router (`/dashboard/crews`, `/dashboard/crews/new`, `/dashboard/crews/[id]`), adições a `api.ts` e `layout.tsx`. Usa padrões existentes do projeto (cards de department, formulário de new agent). Modal de membros usa shadcn Dialog (a ser instalado).

**Tech Stack:** Next.js 16 App Router, React, TypeScript 5, shadcn/ui (Button, Input, Label, Textarea, Select, DropdownMenu, Dialog), Tailwind 4, lucide-react.

**Worktree:** `/Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard`

---

## File Map

### Novos arquivos
```
src/app/(dashboard)/dashboard/crews/page.tsx
src/app/(dashboard)/dashboard/crews/new/page.tsx
src/app/(dashboard)/dashboard/crews/[id]/page.tsx
src/components/ui/dialog.tsx                        ← instalar via shadcn
```

### Arquivos modificados
```
src/lib/api.ts                                      ← + tipos + seção crews
src/app/(dashboard)/dashboard/layout.tsx            ← + "Crews" no NAV
CONTEXT.md                                          ← atualizar estado
```

---

## Task 1: Dialog Component + api.ts

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Instalar Dialog do shadcn**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && npx shadcn@latest add dialog --yes 2>&1 | tail -5
```

Esperado: `✔ Done` — arquivo `src/components/ui/dialog.tsx` criado.

- [ ] **Step 2: Adicionar tipos ao api.ts**

Ler `src/lib/api.ts`. Após o último bloco de tipos (após `SendMessageOutput`), adicionar:

```typescript
export type CrewItem = {
  id: string; tenantId: string; departmentId: string
  name: string; slug: string; description: string | null
  objective: string | null; status: 'DRAFT' | 'ACTIVE' | 'INACTIVE'
  createdAt: string; updatedAt: string
}

export type CrewMemberItem = {
  id: string; tenantId: string; crewId: string; agentId: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
  order: number; isRequired: boolean; createdAt: string
}

export type CreateCrewPayload = {
  departmentId: string; name: string; description?: string; objective?: string
}

export type AddCrewMemberPayload = {
  agentId: string; role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
  order: number; isRequired?: boolean
}
```

- [ ] **Step 3: Adicionar seção crews ao api.ts**

No objeto `api`, após a seção `departments`, adicionar:

```typescript
  // ─── Crews ────────────────────────────────────────────────────────────────

  crews: {
    list: (departmentId?: string) =>
      request<CrewItem[]>(departmentId ? `/crews?departmentId=${departmentId}` : '/crews'),
    get: (id: string) =>
      request<{ crew: CrewItem; members: CrewMemberItem[] }>(`/crews/${id}`),
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

- [ ] **Step 4: Commit**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && git add src/components/ui/dialog.tsx src/lib/api.ts && git commit -m "feat(crew-ui): add Dialog component and crew API client types"
```

---

## Task 2: Layout — Crews no sidebar

**Files:**
- Modify: `src/app/(dashboard)/dashboard/layout.tsx`

- [ ] **Step 1: Atualizar layout.tsx**

Ler o arquivo. A linha de import do lucide-react é:
```typescript
import { Bot, MessageSquare, LayoutDashboard, LogOut, Building2 } from 'lucide-react'
```

Alterar para adicionar `Users`:
```typescript
import { Bot, MessageSquare, LayoutDashboard, LogOut, Building2, Users } from 'lucide-react'
```

O array NAV atual é:
```typescript
const NAV = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/agents', label: 'Agentes', icon: Bot },
  { href: '/dashboard/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/dashboard/departments', label: 'Departments', icon: Building2 },
]
```

Alterar para:
```typescript
const NAV = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/agents', label: 'Agentes', icon: Bot },
  { href: '/dashboard/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/dashboard/departments', label: 'Departments', icon: Building2 },
  { href: '/dashboard/crews', label: 'Crews', icon: Users },
]
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && git add src/app/\(dashboard\)/dashboard/layout.tsx && git commit -m "feat(crew-ui): add Crews to sidebar navigation"
```

---

## Task 3: Crews List Page

**Files:**
- Create: `src/app/(dashboard)/dashboard/crews/page.tsx`

- [ ] **Step 1: Criar o diretório**

```bash
mkdir -p /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard/src/app/\(dashboard\)/dashboard/crews
```

- [ ] **Step 2: Criar src/app/(dashboard)/dashboard/crews/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type CrewItem, type DepartmentItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Hash, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CrewsPage() {
  const [crews, setCrews]           = useState<CrewItem[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [activeTab, setActiveTab]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    api.departments.list()
      .then(setDepartments)
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    api.crews.list(activeTab ?? undefined)
      .then(setCrews)
      .catch(() => setCrews([]))
      .finally(() => setLoading(false))
  }, [activeTab])

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Crews</h1>
          <p className="text-sm text-muted-foreground mt-1">Equipes de agentes organizadas por departamento</p>
        </div>
        <Link href="/dashboard/crews/new">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Crew
          </Button>
        </Link>
      </div>

      {/* Department tabs */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setActiveTab(null)}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm transition-colors',
            activeTab === null
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
        >
          Todos
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveTab(d.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              activeTab === d.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-border bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : crews.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma crew criada ainda</p>
          <Link href="/dashboard/crews/new">
            <Button size="sm" variant="outline">Criar primeira crew</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((crew, i) => {
            const dept = departments.find((d) => d.id === crew.departmentId)
            return (
              <Link key={crew.id} href={`/dashboard/crews/${crew.id}`}>
                <div
                  className="relative rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-border/80 hover:bg-secondary/30 cursor-pointer h-full"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-1',
                      crew.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : crew.status === 'DRAFT'
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground/30',
                    )}
                  />
                  <div className="pl-5 pr-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-tight">{crew.name}</p>
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                          crew.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : crew.status === 'DRAFT'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {crew.status}
                      </span>
                    </div>
                    {dept && (
                      <p className="text-xs text-muted-foreground">{dept.name}</p>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Hash className="w-3 h-3" />
                      <span className="text-xs font-mono">{crew.slug}</span>
                    </div>
                    {crew.objective && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{crew.objective}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && git add src/app/\(dashboard\)/dashboard/crews/page.tsx && git commit -m "feat(crew-ui): add crews list page with department filter tabs"
```

---

## Task 4: Crews New Page

**Files:**
- Create: `src/app/(dashboard)/dashboard/crews/new/page.tsx`

- [ ] **Step 1: Criar o diretório**

```bash
mkdir -p /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard/src/app/\(dashboard\)/dashboard/crews/new
```

- [ ] **Step 2: Criar src/app/(dashboard)/dashboard/crews/new/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError, type DepartmentItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Hash } from 'lucide-react'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function NewCrewPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [name, setName]               = useState('')
  const [objective, setObjective]     = useState('')
  const [description, setDescription] = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    api.departments.list()
      .then((depts) => {
        setDepartments(depts)
        if (depts.length > 0) setDepartmentId(depts[0].id)
      })
      .catch(() => setDepartments([]))
  }, [])

  const slugPreview = name ? toSlug(name) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !departmentId) return
    setError(null)
    setSubmitting(true)
    try {
      const crew = await api.crews.create({
        departmentId,
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
      })
      router.push(`/dashboard/crews/${crew.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'CREW_NAME_TAKEN'
          ? 'Já existe uma crew com este nome.'
          : err.message)
      } else {
        setError('Erro inesperado. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-lg space-y-6">
      <Link
        href="/dashboard/crews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Crews
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nova Crew</h1>
        <p className="text-sm text-muted-foreground mt-1">Crie uma equipe de agentes com objetivo comum</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Department */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Departamento <span className="text-destructive">*</span>
          </Label>
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={departments.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={departments.length === 0 ? 'Carregando…' : 'Selecione um departamento'} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Comercial IA, Helpdesk, Onboarding"
            required
            minLength={2}
            maxLength={100}
            autoFocus
          />
          {slugPreview && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="w-3 h-3" />
              <span className="font-mono">{slugPreview}</span>
            </div>
          )}
        </div>

        {/* Objective */}
        <div className="space-y-1.5">
          <Label htmlFor="objective" className="text-sm font-medium">
            Objetivo <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex: Qualificação e fechamento de leads"
            maxLength={500}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <span className="text-xs text-muted-foreground">{description.length} / 500</span>
          </div>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva a finalidade desta crew"
            maxLength={500}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={submitting || !name.trim() || !departmentId}>
            {submitting ? 'Criando…' : 'Criar Crew'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && git add src/app/\(dashboard\)/dashboard/crews/new/page.tsx && git commit -m "feat(crew-ui): add crew creation page"
```

---

## Task 5: Crew Detail Page

**Files:**
- Create: `src/app/(dashboard)/dashboard/crews/[id]/page.tsx`

- [ ] **Step 1: Criar o diretório**

```bash
mkdir -p "/Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard/src/app/(dashboard)/dashboard/crews/[id]"
```

- [ ] **Step 2: Criar src/app/(dashboard)/dashboard/crews/[id]/page.tsx**

```tsx
'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, ApiError, type CrewItem, type CrewMemberItem, type AgentListItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Plus, Star, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type CrewStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
type MemberRole = 'DIRECTOR' | 'MEMBER' | 'OBSERVER'

const STATUS_COLORS: Record<CrewStatus, string> = {
  DRAFT:    'bg-amber-500/10 text-amber-400',
  ACTIVE:   'bg-emerald-500/10 text-emerald-400',
  INACTIVE: 'bg-muted text-muted-foreground',
}

const ROLE_COLORS: Record<MemberRole, string> = {
  DIRECTOR: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  MEMBER:   'bg-secondary text-muted-foreground',
  OBSERVER: 'bg-secondary text-muted-foreground',
}

export default function CrewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [crew, setCrew]       = useState<CrewItem | null>(null)
  const [members, setMembers] = useState<CrewMemberItem[]>([])
  const [agents, setAgents]   = useState<AgentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Modal state
  const [modalOpen, setModalOpen]         = useState(false)
  const [addAgentId, setAddAgentId]       = useState('')
  const [addRole, setAddRole]             = useState<MemberRole>('MEMBER')
  const [addOrder, setAddOrder]           = useState(0)
  const [addError, setAddError]           = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  const loadCrew = useCallback(async () => {
    try {
      const data = await api.crews.get(id)
      setCrew(data.crew)
      setMembers(data.members)
    } catch {
      setError('Crew não encontrada.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadCrew() }, [loadCrew])

  useEffect(() => {
    api.agents.list()
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [])

  function openModal() {
    const nextOrder = members.length
    setAddAgentId('')
    setAddRole('MEMBER')
    setAddOrder(nextOrder)
    setAddError(null)
    setModalOpen(true)
  }

  async function handleAddMember() {
    if (!addAgentId) return
    setAddError(null)
    setAddSubmitting(true)
    try {
      await api.crews.addMember(id, { agentId: addAgentId, role: addRole, order: addOrder })
      setModalOpen(false)
      await loadCrew()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CREW_ALREADY_HAS_DIRECTOR') setAddError('Esta crew já possui um Director.')
        else if (err.code === 'AGENT_ALREADY_IN_CREW')  setAddError('Este agente já está nesta crew.')
        else setAddError(err.message)
      } else {
        setAddError('Erro inesperado. Tente novamente.')
      }
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!window.confirm('Remover este agente da crew?')) return
    try {
      await api.crews.removeMember(id, memberId)
      await loadCrew()
    } catch { /* ignore */ }
  }

  async function handleStatusChange(status: CrewStatus) {
    if (!crew) return
    try {
      const updated = await api.crews.update(id, { status })
      setCrew(updated)
    } catch { /* ignore */ }
  }

  // Agents not yet in this crew
  const memberAgentIds = new Set(members.map((m) => m.agentId))
  const availableAgents = agents.filter((a) => !memberAgentIds.has(a.id))

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
  if (error || !crew) return <div className="p-8 text-sm text-destructive">{error ?? 'Crew não encontrada.'}</div>

  return (
    <div className="p-8 max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/crews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Crews
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{crew.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">#{crew.slug}</p>
          {crew.objective && <p className="text-sm text-muted-foreground">{crew.objective}</p>}
        </div>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', STATUS_COLORS[crew.status as CrewStatus])}>
                {crew.status}
              </span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['DRAFT', 'ACTIVE', 'INACTIVE'] as CrewStatus[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)} disabled={s === crew.status}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Members section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Membros {members.length > 0 && <span className="text-muted-foreground font-normal">({members.length})</span>}
          </h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openModal}>
            <Plus className="w-4 h-4" />
            Adicionar Agente
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">Nenhum membro — adicione agentes para compor a crew</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {members.map((m) => {
              const agent = agents.find((a) => a.id === m.agentId)
              const isDirector = m.role === 'DIRECTOR'
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/30 transition-colors">
                  <div className="w-6 text-center flex-shrink-0">
                    {isDirector
                      ? <Star className="w-4 h-4 text-amber-400 mx-auto" />
                      : <span className="text-xs text-muted-foreground">{m.order}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {agent?.name ?? m.agentId}
                    </p>
                    {agent?.type && (
                      <p className="text-xs text-muted-foreground">{agent.type}</p>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', ROLE_COLORS[m.role as MemberRole])}>
                    {m.role}
                  </span>
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    title="Remover membro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Agente à Crew</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Agent select */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Agente <span className="text-destructive">*</span>
              </Label>
              <Select value={addAgentId} onValueChange={setAddAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.length === 0
                    ? <SelectItem value="_none" disabled>Todos os agentes já estão na crew</SelectItem>
                    : availableAgents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Papel</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECTOR">DIRECTOR — Orquestra a crew</SelectItem>
                  <SelectItem value="MEMBER">MEMBER — Agente ativo</SelectItem>
                  <SelectItem value="OBSERVER">OBSERVER — Monitora sem agir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order */}
            <div className="space-y-1.5">
              <Label htmlFor="order" className="text-sm font-medium">Ordem no workflow</Label>
              <input
                id="order"
                type="number"
                min={0}
                value={addOrder}
                onChange={(e) => setAddOrder(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddMember} disabled={addSubmitting || !addAgentId}>
              {addSubmitting ? 'Adicionando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && git add "src/app/(dashboard)/dashboard/crews/[id]/page.tsx" && git commit -m "feat(crew-ui): add crew detail page with member management modal"
```

---

## Task 6: CONTEXT.md + Testes finais

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Rodar suite de testes para confirmar que nada quebrou**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && npx vitest run 2>&1 | tail -6
```

Esperado: `231 tests passed` — zero regressões.

- [ ] **Step 2: Atualizar CONTEXT.md**

Na seção "✅ Crew Builder — Fase 1.2", adicionar após "Regras:":

```markdown
### ✅ Crew Dashboard — Fase 1.3 (IMPLEMENTED)
**Telas:**
- `/dashboard/crews` — lista de crews com filtro por department (tabs) + cards de status
- `/dashboard/crews/new` — formulário de criação com select de department + preview de slug
- `/dashboard/crews/:id` — detalhe com dropdown de status + lista de membros + modal de adição
**Componente:** `Dialog` do shadcn adicionado
**api.ts:** seção `crews` com tipos `CrewItem`, `CrewMemberItem`, `CreateCrewPayload`, `AddCrewMemberPayload`
```

Na seção "Fases futuras", marcar Fase 1.3 como implementada:
```markdown
| **✅ Fase 1.3** | Crew Dashboard — IMPLEMENTADO |
```

- [ ] **Step 3: Commit final**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-3-crew-dashboard && git add CONTEXT.md && git commit -m "docs: mark Crew Dashboard as IMPLEMENTED and update CONTEXT.md"
```
