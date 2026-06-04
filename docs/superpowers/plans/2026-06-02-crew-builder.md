# Crew Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Crew e CrewMember — a camada de equipes de agentes dentro de Departments, com CRUD completo, associação N:N de agentes e role DIRECTOR|MEMBER|OBSERVER.

**Architecture:** Novo domínio `src/domains/crew/` com duas entidades (Crew, CrewMember), repositórios InMemory + Prisma, 8 use-cases com TDD, APIs REST em `/api/v1/crews`. Reutiliza `generateSlug` do domínio organization. Sem UI — deferida para Fase 1.3.

**Tech Stack:** TypeScript 5, Next.js 16 App Router, Prisma 7 (adapter-pg), Vitest 4, Zod.

**Worktree:** `/Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.worktrees/feat/fase-1-2-crew-builder`

**Test command:** `npx vitest run tests/unit/domains/crew/` (rodar de dentro do worktree)

---

## File Map

### Novos arquivos

```
docs/specs/crew/crew-builder.md
src/domains/crew/entities/Crew.ts
src/domains/crew/entities/CrewMember.ts
src/domains/crew/repositories/ICrewRepository.ts
src/domains/crew/repositories/ICrewMemberRepository.ts
src/domains/crew/use-cases/CreateCrew.ts
src/domains/crew/use-cases/ListCrews.ts
src/domains/crew/use-cases/GetCrew.ts
src/domains/crew/use-cases/UpdateCrew.ts
src/domains/crew/use-cases/DeleteCrew.ts
src/domains/crew/use-cases/AddAgentToCrew.ts
src/domains/crew/use-cases/RemoveAgentFromCrew.ts
src/domains/crew/use-cases/ListCrewMembers.ts
src/infrastructure/db/repositories/InMemoryCrewRepository.ts
src/infrastructure/db/repositories/InMemoryCrewMemberRepository.ts
src/infrastructure/db/repositories/PrismaCrewRepository.ts
src/infrastructure/db/repositories/PrismaCrewMemberRepository.ts
tests/unit/domains/crew/CreateCrew.test.ts
tests/unit/domains/crew/ListCrews.test.ts
tests/unit/domains/crew/GetCrew.test.ts
tests/unit/domains/crew/UpdateCrew.test.ts
tests/unit/domains/crew/DeleteCrew.test.ts
tests/unit/domains/crew/AddAgentToCrew.test.ts
tests/unit/domains/crew/RemoveAgentFromCrew.test.ts
tests/unit/domains/crew/ListCrewMembers.test.ts
src/app/api/v1/crews/route.ts
src/app/api/v1/crews/[id]/route.ts
src/app/api/v1/crews/[id]/members/route.ts
src/app/api/v1/crews/[id]/members/[memberId]/route.ts
```

### Arquivos modificados

```
prisma/schema.prisma           ← + enums + models Crew + CrewMember + relações
src/shared/utils/apiResponse.ts ← + 6 novos error codes
src/infrastructure/di/index.ts ← + crewRepo + crewMemberRepo + 8 use-cases
CONTEXT.md                     ← atualizar estado implementado
```

---

## Task 1: SDD Spec

**Files:**
- Create: `docs/specs/crew/crew-builder.md`

- [ ] **Step 1: Criar pasta e spec**

```bash
mkdir -p docs/specs/crew
```

Criar `docs/specs/crew/crew-builder.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/crew/crew-builder.md
git commit -m "docs(spec): add crew-builder spec - APPROVED"
```

---

## Task 2: Prisma Schema + Directories

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Criar estrutura de pastas**

```bash
mkdir -p src/domains/crew/entities
mkdir -p src/domains/crew/repositories
mkdir -p src/domains/crew/use-cases
mkdir -p tests/unit/domains/crew
```

- [ ] **Step 2: Adicionar ao schema.prisma**

Abrir `prisma/schema.prisma`. Após o bloco `// ─── Organization ─────`, adicionar:

```prisma
// ─── Crew ─────────────────────────────────────────────────────────────────────

enum CrewStatus {
  DRAFT
  ACTIVE
  INACTIVE
}

enum CrewMemberRole {
  DIRECTOR
  MEMBER
  OBSERVER
}

model Crew {
  id           String     @id @default(uuid())
  tenantId     String
  departmentId String
  name         String
  slug         String
  description  String?
  objective    String?
  status       CrewStatus @default(DRAFT)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  department Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  members    CrewMember[]

  @@unique([tenantId, name])
  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([departmentId])
  @@map("crews")
}

model CrewMember {
  id         String         @id @default(uuid())
  tenantId   String
  crewId     String
  agentId    String
  role       CrewMemberRole @default(MEMBER)
  order      Int            @default(0)
  isRequired Boolean        @default(true)
  createdAt  DateTime       @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  crew   Crew   @relation(fields: [crewId], references: [id], onDelete: Cascade)
  agent  Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([crewId, agentId])
  @@index([tenantId])
  @@index([crewId])
  @@map("crew_members")
}
```

No model `Tenant`, adicionar após `departments Department[]`:
```prisma
  crews        Crew[]
  crewMembers  CrewMember[]
```

No model `Department`, adicionar após o último campo:
```prisma
  crews Crew[]
```

No model `Agent`, adicionar após `conversations Conversation[]`:
```prisma
  crewMemberships CrewMember[]
```

- [ ] **Step 3: Rodar prisma generate**

```bash
npx prisma generate
```

Esperado: `✔ Generated Prisma Client` sem erros.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(crew): add Crew and CrewMember to Prisma schema"
```

---

## Task 3: Entidades + Repositório Interfaces

**Files:**
- Create: `src/domains/crew/entities/Crew.ts`
- Create: `src/domains/crew/entities/CrewMember.ts`
- Create: `src/domains/crew/repositories/ICrewRepository.ts`
- Create: `src/domains/crew/repositories/ICrewMemberRepository.ts`

- [ ] **Step 1: Criar src/domains/crew/entities/Crew.ts**

```typescript
export enum CrewStatus {
  DRAFT    = 'DRAFT',
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Crew {
  id:           string
  tenantId:     string
  departmentId: string
  name:         string
  slug:         string
  description:  string | null
  objective:    string | null
  status:       CrewStatus
  createdAt:    Date
  updatedAt:    Date
}

export interface CreateCrewData {
  tenantId:     string
  departmentId: string
  name:         string
  slug:         string
  description?: string
  objective?:   string
}

export interface UpdateCrewData {
  name?:        string
  slug?:        string
  description?: string
  objective?:   string
  status?:      CrewStatus
}
```

- [ ] **Step 2: Criar src/domains/crew/entities/CrewMember.ts**

```typescript
export enum CrewMemberRole {
  DIRECTOR = 'DIRECTOR',
  MEMBER   = 'MEMBER',
  OBSERVER = 'OBSERVER',
}

export interface CrewMember {
  id:         string
  tenantId:   string
  crewId:     string
  agentId:    string
  role:       CrewMemberRole
  order:      number
  isRequired: boolean
  createdAt:  Date
}

export interface CreateCrewMemberData {
  tenantId:    string
  crewId:      string
  agentId:     string
  role:        CrewMemberRole
  order:       number
  isRequired?: boolean
}
```

- [ ] **Step 3: Criar src/domains/crew/repositories/ICrewRepository.ts**

```typescript
import type { Crew, CreateCrewData, UpdateCrewData } from '../entities/Crew'

export interface ICrewRepository {
  create(data: CreateCrewData): Promise<Crew>
  findById(id: string, tenantId: string): Promise<Crew | null>
  findByName(name: string, tenantId: string): Promise<Crew | null>
  findAllByTenant(tenantId: string): Promise<Crew[]>
  findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]>
  update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew>
  delete(id: string, tenantId: string): Promise<void>
}
```

- [ ] **Step 4: Criar src/domains/crew/repositories/ICrewMemberRepository.ts**

```typescript
import type { CrewMember, CreateCrewMemberData } from '../entities/CrewMember'

export interface ICrewMemberRepository {
  create(data: CreateCrewMemberData): Promise<CrewMember>
  findById(id: string, tenantId: string): Promise<CrewMember | null>
  findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null>
  findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]>
  findDirector(crewId: string, tenantId: string): Promise<CrewMember | null>
  countDirectors(crewId: string, tenantId: string): Promise<number>
  countByCrew(crewId: string, tenantId: string): Promise<number>
  delete(id: string, tenantId: string): Promise<void>
}
```

- [ ] **Step 5: Commit**

```bash
git add src/domains/crew/
git commit -m "feat(crew): add Crew and CrewMember entities and repository interfaces"
```

---

## Task 4: InMemory Repositories

**Files:**
- Create: `src/infrastructure/db/repositories/InMemoryCrewRepository.ts`
- Create: `src/infrastructure/db/repositories/InMemoryCrewMemberRepository.ts`

- [ ] **Step 1: Criar InMemoryCrewRepository.ts**

```typescript
import { randomUUID } from 'crypto'
import type { Crew, CreateCrewData, UpdateCrewData } from '@/domains/crew/entities/Crew'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'

const store = new Map<string, Crew>()

export class InMemoryCrewRepository implements ICrewRepository {
  async create(data: CreateCrewData): Promise<Crew> {
    const crew: Crew = {
      id:           randomUUID(),
      tenantId:     data.tenantId,
      departmentId: data.departmentId,
      name:         data.name,
      slug:         data.slug,
      description:  data.description ?? null,
      objective:    data.objective ?? null,
      status:       CrewStatus.DRAFT,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    }
    store.set(crew.id, crew)
    return crew
  }

  async findById(id: string, tenantId: string): Promise<Crew | null> {
    const crew = store.get(id)
    return crew?.tenantId === tenantId ? crew : null
  }

  async findByName(name: string, tenantId: string): Promise<Crew | null> {
    return Array.from(store.values()).find(
      (c) => c.name === name && c.tenantId === tenantId,
    ) ?? null
  }

  async findAllByTenant(tenantId: string): Promise<Crew[]> {
    return Array.from(store.values())
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]> {
    return Array.from(store.values())
      .filter((c) => c.departmentId === departmentId && c.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew> {
    const crew = store.get(id)
    if (!crew || crew.tenantId !== tenantId) throw new Error('Not found')
    const updated: Crew = { ...crew, ...data, updatedAt: new Date() }
    store.set(id, updated)
    return updated
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const crew = store.get(id)
    if (crew?.tenantId === tenantId) store.delete(id)
  }

  clear(): void { store.clear() }
}
```

- [ ] **Step 2: Criar InMemoryCrewMemberRepository.ts**

```typescript
import { randomUUID } from 'crypto'
import type { CrewMember, CreateCrewMemberData } from '@/domains/crew/entities/CrewMember'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'

const store = new Map<string, CrewMember>()

export class InMemoryCrewMemberRepository implements ICrewMemberRepository {
  async create(data: CreateCrewMemberData): Promise<CrewMember> {
    const member: CrewMember = {
      id:         randomUUID(),
      tenantId:   data.tenantId,
      crewId:     data.crewId,
      agentId:    data.agentId,
      role:       data.role,
      order:      data.order,
      isRequired: data.isRequired ?? true,
      createdAt:  new Date(),
    }
    store.set(member.id, member)
    return member
  }

  async findById(id: string, tenantId: string): Promise<CrewMember | null> {
    const m = store.get(id)
    return m?.tenantId === tenantId ? m : null
  }

  async findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null> {
    return Array.from(store.values()).find(
      (m) => m.crewId === crewId && m.agentId === agentId && m.tenantId === tenantId,
    ) ?? null
  }

  async findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]> {
    return Array.from(store.values())
      .filter((m) => m.crewId === crewId && m.tenantId === tenantId)
      .sort((a, b) => a.order - b.order)
  }

  async findDirector(crewId: string, tenantId: string): Promise<CrewMember | null> {
    return Array.from(store.values()).find(
      (m) => m.crewId === crewId && m.tenantId === tenantId && m.role === CrewMemberRole.DIRECTOR,
    ) ?? null
  }

  async countDirectors(crewId: string, tenantId: string): Promise<number> {
    return Array.from(store.values()).filter(
      (m) => m.crewId === crewId && m.tenantId === tenantId && m.role === CrewMemberRole.DIRECTOR,
    ).length
  }

  async countByCrew(crewId: string, tenantId: string): Promise<number> {
    return Array.from(store.values()).filter(
      (m) => m.crewId === crewId && m.tenantId === tenantId,
    ).length
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const m = store.get(id)
    if (m?.tenantId === tenantId) store.delete(id)
  }

  clear(): void { store.clear() }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/repositories/InMemoryCrewRepository.ts src/infrastructure/db/repositories/InMemoryCrewMemberRepository.ts
git commit -m "feat(crew): add InMemory repositories for Crew and CrewMember"
```

---

## Task 5: CreateCrew (TDD)

**Files:**
- Create: `tests/unit/domains/crew/CreateCrew.test.ts`
- Create: `src/domains/crew/use-cases/CreateCrew.ts`

- [ ] **Step 1: Escrever o teste (RED)**

```typescript
// tests/unit/domains/crew/CreateCrew.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateCrew } from '@/domains/crew/use-cases/CreateCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return { tenantId: 'tenant-1', departmentId: 'dept-1', name: 'Comercial IA', ...overrides }
}

function makeCrewRepo(): ICrewRepository {
  return {
    create:               vi.fn().mockResolvedValue(makeCrew()),
    findById:             vi.fn().mockResolvedValue(null),
    findByName:           vi.fn().mockResolvedValue(null),
    findAllByTenant:      vi.fn().mockResolvedValue([]),
    findAllByDepartment:  vi.fn().mockResolvedValue([]),
    update:               vi.fn(),
    delete:               vi.fn(),
  }
}

function makeDeptRepo(found: any = makeDept()): IDepartmentRepository {
  return {
    create: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findById:   vi.fn().mockResolvedValue(found),
    findByName: vi.fn().mockResolvedValue(null),
  }
}

describe('CreateCrew', () => {
  let crewRepo: ICrewRepository
  let deptRepo: IDepartmentRepository
  let audit: IAuditLogger
  let useCase: CreateCrew

  beforeEach(() => {
    crewRepo = makeCrewRepo()
    deptRepo = makeDeptRepo()
    audit    = { log: vi.fn() }
    useCase  = new CreateCrew(crewRepo, deptRepo, audit)
  })

  it('cria crew com dados válidos', async () => {
    const result = await useCase.execute(makeInput())
    expect(result.name).toBe('Comercial IA')
    expect(result.slug).toBe('comercial-ia')
    expect(result.status).toBe(CrewStatus.DRAFT)
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.created' }))
  })

  it('gera slug do name com acentos', async () => {
    vi.mocked(crewRepo.create).mockResolvedValue(makeCrew({ name: 'Jurídico IA', slug: 'juridico-ia' }))
    const result = await useCase.execute(makeInput({ name: 'Jurídico IA' }))
    expect(result.slug).toBe('juridico-ia')
  })

  it('rejeita name duplicado no tenant', async () => {
    vi.mocked(crewRepo.findByName).mockResolvedValue(makeCrew())
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'CREW_NAME_TAKEN' })
  })

  it('rejeita departmentId de outro tenant', async () => {
    vi.mocked(deptRepo.findById).mockResolvedValue(null)
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })

  it('aceita mesmo name em tenant diferente', async () => {
    vi.mocked(crewRepo.findByName).mockImplementation(async (_name, tenantId) =>
      tenantId === 'tenant-2' ? makeCrew({ tenantId: 'tenant-2' }) : null,
    )
    await expect(useCase.execute(makeInput({ tenantId: 'tenant-1' }))).resolves.toBeDefined()
  })
})
```

- [ ] **Step 2: Rodar e confirmar FAIL**

```bash
npx vitest run tests/unit/domains/crew/CreateCrew.test.ts
```

Esperado: `FAIL — Cannot find module '@/domains/crew/use-cases/CreateCrew'`

- [ ] **Step 3: Implementar CreateCrew.ts**

```typescript
// src/domains/crew/use-cases/CreateCrew.ts
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Crew } from '../entities/Crew'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { generateSlug } from '@/domains/organization/utils/generateSlug'

type Input = {
  tenantId:     string
  departmentId: string
  name:         string
  description?: string
  objective?:   string
}

export class CreateCrew {
  constructor(
    private crewRepo: ICrewRepository,
    private deptRepo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Crew> {
    const dept = await this.deptRepo.findById(input.departmentId, input.tenantId)
    if (!dept) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')

    const existing = await this.crewRepo.findByName(input.name, input.tenantId)
    if (existing) throw new AppError('CREW_NAME_TAKEN', 'Já existe uma crew com este nome')

    const slug = generateSlug(input.name)

    const crew = await this.crewRepo.create({
      tenantId:     input.tenantId,
      departmentId: input.departmentId,
      name:         input.name,
      slug,
      description:  input.description,
      objective:    input.objective,
    })

    await this.auditLogger.log({
      action: 'crew.created', tenantId: input.tenantId,
      resourceId: crew.id, resourceType: 'crew',
      metadata: { name: crew.name, departmentId: crew.departmentId },
    })

    return crew
  }
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

```bash
npx vitest run tests/unit/domains/crew/CreateCrew.test.ts
```

Esperado: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/unit/domains/crew/CreateCrew.test.ts src/domains/crew/use-cases/CreateCrew.ts
git commit -m "feat(crew): implement CreateCrew use-case with TDD"
```

---

## Task 6: ListCrews + GetCrew (TDD)

**Files:**
- Create: `tests/unit/domains/crew/ListCrews.test.ts`
- Create: `src/domains/crew/use-cases/ListCrews.ts`
- Create: `tests/unit/domains/crew/GetCrew.test.ts`
- Create: `src/domains/crew/use-cases/GetCrew.ts`

- [ ] **Step 1: Criar tests/unit/domains/crew/ListCrews.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { ListCrews } from '@/domains/crew/use-cases/ListCrews'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(crews = [makeCrew()]): ICrewRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByName: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findAllByTenant:     vi.fn().mockResolvedValue(crews),
    findAllByDepartment: vi.fn().mockResolvedValue(crews.filter(c => c.departmentId === 'dept-1')),
  }
}

describe('ListCrews', () => {
  it('lista crews do tenant', async () => {
    const repo = makeRepo([makeCrew(), makeCrew({ id: 'crew-2', name: 'Suporte IA', slug: 'suporte-ia' })])
    const result = await new ListCrews(repo).execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(2)
    expect(repo.findAllByTenant).toHaveBeenCalledWith('tenant-1')
  })

  it('filtra por departmentId quando fornecido', async () => {
    const repo = makeRepo()
    await new ListCrews(repo).execute({ tenantId: 'tenant-1', departmentId: 'dept-1' })
    expect(repo.findAllByDepartment).toHaveBeenCalledWith('dept-1', 'tenant-1')
  })

  it('retorna lista vazia', async () => {
    const repo = makeRepo([])
    const result = await new ListCrews(repo).execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Criar src/domains/crew/use-cases/ListCrews.ts**

```typescript
import type { Crew } from '../entities/Crew'
import type { ICrewRepository } from '../repositories/ICrewRepository'

export class ListCrews {
  constructor(private repo: ICrewRepository) {}

  async execute(input: { tenantId: string; departmentId?: string }): Promise<Crew[]> {
    if (input.departmentId) {
      return this.repo.findAllByDepartment(input.departmentId, input.tenantId)
    }
    return this.repo.findAllByTenant(input.tenantId)
  }
}
```

- [ ] **Step 3: Criar tests/unit/domains/crew/GetCrew.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GetCrew } from '@/domains/crew/use-cases/GetCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(overrides = {}) {
  return {
    id: 'mem-1', tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1',
    role: CrewMemberRole.MEMBER, order: 0, isRequired: true, createdAt: new Date(),
    ...overrides,
  }
}

function makeCrewRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
  }
}

function makeMemberRepo(members = [makeMember()]): ICrewMemberRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
    findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), delete: vi.fn(),
    findAllByCrew: vi.fn().mockResolvedValue(members),
  }
}

describe('GetCrew', () => {
  it('retorna crew com members', async () => {
    const crewRepo   = makeCrewRepo()
    const memberRepo = makeMemberRepo()
    const result = await new GetCrew(crewRepo, memberRepo).execute({ id: 'crew-1', tenantId: 'tenant-1' })
    expect(result.crew.id).toBe('crew-1')
    expect(result.members).toHaveLength(1)
    expect(memberRepo.findAllByCrew).toHaveBeenCalledWith('crew-1', 'tenant-1')
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    const crewRepo   = makeCrewRepo(null)
    const memberRepo = makeMemberRepo([])
    await expect(new GetCrew(crewRepo, memberRepo).execute({ id: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })

  it('lança CREW_NOT_FOUND para id inexistente', async () => {
    const crewRepo   = makeCrewRepo(null)
    const memberRepo = makeMemberRepo([])
    await expect(new GetCrew(crewRepo, memberRepo).execute({ id: 'nope', tenantId: 'tenant-1' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
```

- [ ] **Step 4: Criar src/domains/crew/use-cases/GetCrew.ts**

```typescript
import { AppError } from '@/shared/errors/AppError'
import type { Crew } from '../entities/Crew'
import type { CrewMember } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

type Output = { crew: Crew; members: CrewMember[] }

export class GetCrew {
  constructor(
    private crewRepo: ICrewRepository,
    private memberRepo: ICrewMemberRepository,
  ) {}

  async execute(input: { id: string; tenantId: string }): Promise<Output> {
    const crew = await this.crewRepo.findById(input.id, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    const members = await this.memberRepo.findAllByCrew(input.id, input.tenantId)
    return { crew, members }
  }
}
```

- [ ] **Step 5: Rodar e confirmar GREEN**

```bash
npx vitest run tests/unit/domains/crew/ListCrews.test.ts tests/unit/domains/crew/GetCrew.test.ts
```

Esperado: `6 tests passed`

- [ ] **Step 6: Commit**

```bash
git add tests/unit/domains/crew/ListCrews.test.ts src/domains/crew/use-cases/ListCrews.ts \
        tests/unit/domains/crew/GetCrew.test.ts src/domains/crew/use-cases/GetCrew.ts
git commit -m "feat(crew): implement ListCrews and GetCrew use-cases with TDD"
```

---

## Task 7: UpdateCrew + DeleteCrew (TDD)

**Files:**
- Create: `tests/unit/domains/crew/UpdateCrew.test.ts`
- Create: `src/domains/crew/use-cases/UpdateCrew.ts`
- Create: `tests/unit/domains/crew/DeleteCrew.test.ts`
- Create: `src/domains/crew/use-cases/DeleteCrew.ts`

- [ ] **Step 1: Criar tests/unit/domains/crew/UpdateCrew.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateCrew } from '@/domains/crew/use-cases/UpdateCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findAllByTenant: vi.fn(), findAllByDepartment: vi.fn(), delete: vi.fn(),
    findById:   vi.fn().mockResolvedValue(found),
    findByName: vi.fn().mockResolvedValue(null),
    update:     vi.fn().mockImplementation(async (_id, _t, data) => ({ ...found, ...data, updatedAt: new Date() })),
  }
}

describe('UpdateCrew', () => {
  let repo: ICrewRepository
  let audit: IAuditLogger
  let useCase: UpdateCrew

  beforeEach(() => {
    repo  = makeRepo()
    audit = { log: vi.fn() }
    useCase = new UpdateCrew(repo, audit)
  })

  it('atualiza name e regenera slug', async () => {
    await useCase.execute({ id: 'crew-1', tenantId: 'tenant-1', name: 'Jurídico IA' })
    expect(repo.update).toHaveBeenCalledWith('crew-1', 'tenant-1',
      expect.objectContaining({ name: 'Jurídico IA', slug: 'juridico-ia' }))
  })

  it('atualiza status para ACTIVE', async () => {
    await useCase.execute({ id: 'crew-1', tenantId: 'tenant-1', status: CrewStatus.ACTIVE })
    expect(repo.update).toHaveBeenCalledWith('crew-1', 'tenant-1',
      expect.objectContaining({ status: CrewStatus.ACTIVE }))
  })

  it('lança CREW_NAME_TAKEN se novo name já existe no tenant', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(makeCrew({ id: 'crew-2' }))
    await expect(useCase.execute({ id: 'crew-1', tenantId: 'tenant-1', name: 'Suporte IA' }))
      .rejects.toMatchObject({ code: 'CREW_NAME_TAKEN' })
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null)
    await expect(useCase.execute({ id: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Criar src/domains/crew/use-cases/UpdateCrew.ts**

```typescript
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Crew, CrewStatus, UpdateCrewData } from '../entities/Crew'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import { generateSlug } from '@/domains/organization/utils/generateSlug'

type Input = {
  id:           string
  tenantId:     string
  name?:        string
  description?: string
  objective?:   string
  status?:      CrewStatus
}

export class UpdateCrew {
  constructor(
    private repo: ICrewRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Crew> {
    const existing = await this.repo.findById(input.id, input.tenantId)
    if (!existing) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    const updateData: UpdateCrewData = {}

    if (input.name !== undefined) {
      const byName = await this.repo.findByName(input.name, input.tenantId)
      if (byName && byName.id !== input.id) throw new AppError('CREW_NAME_TAKEN', 'Já existe uma crew com este nome')
      updateData.name = input.name
      updateData.slug = generateSlug(input.name)
    }

    if (input.description !== undefined) updateData.description = input.description
    if (input.objective   !== undefined) updateData.objective   = input.objective
    if (input.status      !== undefined) updateData.status      = input.status

    const updated = await this.repo.update(input.id, input.tenantId, updateData)

    await this.auditLogger.log({
      action: 'crew.updated', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'crew',
      metadata: updateData as Record<string, unknown>,
    })

    return updated
  }
}
```

- [ ] **Step 3: Criar tests/unit/domains/crew/DeleteCrew.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { DeleteCrew } from '@/domains/crew/use-cases/DeleteCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeCrewRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(), update: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    delete:   vi.fn().mockResolvedValue(undefined),
  }
}

function makeMemberRepo(count = 0): ICrewMemberRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
    findAllByCrew: vi.fn(), findDirector: vi.fn(), countDirectors: vi.fn(), delete: vi.fn(),
    countByCrew: vi.fn().mockResolvedValue(count),
  }
}

describe('DeleteCrew', () => {
  it('deleta crew sem membros', async () => {
    const crewRepo   = makeCrewRepo()
    const memberRepo = makeMemberRepo(0)
    const audit: IAuditLogger = { log: vi.fn() }
    await new DeleteCrew(crewRepo, memberRepo, audit).execute({ id: 'crew-1', tenantId: 'tenant-1' })
    expect(crewRepo.delete).toHaveBeenCalledWith('crew-1', 'tenant-1')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.deleted' }))
  })

  it('rejeita deletar crew com membros', async () => {
    const crewRepo   = makeCrewRepo()
    const memberRepo = makeMemberRepo(2)
    const audit: IAuditLogger = { log: vi.fn() }
    await expect(new DeleteCrew(crewRepo, memberRepo, audit).execute({ id: 'crew-1', tenantId: 'tenant-1' }))
      .rejects.toMatchObject({ code: 'CREW_HAS_MEMBERS' })
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    const crewRepo   = makeCrewRepo(null)
    const memberRepo = makeMemberRepo(0)
    const audit: IAuditLogger = { log: vi.fn() }
    await expect(new DeleteCrew(crewRepo, memberRepo, audit).execute({ id: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
```

- [ ] **Step 4: Criar src/domains/crew/use-cases/DeleteCrew.ts**

```typescript
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

export class DeleteCrew {
  constructor(
    private crewRepo:   ICrewRepository,
    private memberRepo: ICrewMemberRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: { id: string; tenantId: string }): Promise<void> {
    const crew = await this.crewRepo.findById(input.id, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    const memberCount = await this.memberRepo.countByCrew(input.id, input.tenantId)
    if (memberCount > 0) throw new AppError('CREW_HAS_MEMBERS', 'Não é possível deletar uma crew com membros')

    await this.crewRepo.delete(input.id, input.tenantId)

    await this.auditLogger.log({
      action: 'crew.deleted', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'crew',
      metadata: { name: crew.name },
    })
  }
}
```

- [ ] **Step 5: Rodar e confirmar GREEN**

```bash
npx vitest run tests/unit/domains/crew/UpdateCrew.test.ts tests/unit/domains/crew/DeleteCrew.test.ts
```

Esperado: `7 tests passed`

- [ ] **Step 6: Commit**

```bash
git add tests/unit/domains/crew/UpdateCrew.test.ts src/domains/crew/use-cases/UpdateCrew.ts \
        tests/unit/domains/crew/DeleteCrew.test.ts src/domains/crew/use-cases/DeleteCrew.ts
git commit -m "feat(crew): implement UpdateCrew and DeleteCrew use-cases with TDD"
```

---

## Task 8: AddAgentToCrew + RemoveAgentFromCrew + ListCrewMembers (TDD)

**Files:**
- Create: `tests/unit/domains/crew/AddAgentToCrew.test.ts`
- Create: `src/domains/crew/use-cases/AddAgentToCrew.ts`
- Create: `tests/unit/domains/crew/RemoveAgentFromCrew.test.ts`
- Create: `src/domains/crew/use-cases/RemoveAgentFromCrew.ts`
- Create: `tests/unit/domains/crew/ListCrewMembers.test.ts`
- Create: `src/domains/crew/use-cases/ListCrewMembers.ts`

- [ ] **Step 1: Criar tests/unit/domains/crew/AddAgentToCrew.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddAgentToCrew } from '@/domains/crew/use-cases/AddAgentToCrew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import { AgentStatus, AgentType } from '@/domains/agent/entities/Agent'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeAgent(overrides = {}) {
  return {
    id: 'agent-1', tenantId: 'tenant-1', name: 'SDR', slug: 'sdr',
    type: AgentType.SDR, description: null, status: AgentStatus.ACTIVE,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(overrides = {}) {
  return {
    id: 'mem-1', tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1',
    role: CrewMemberRole.MEMBER, order: 0, isRequired: true, createdAt: new Date(),
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return { tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1', role: CrewMemberRole.MEMBER, order: 0, ...overrides }
}

function makeCrewRepo(found: any = makeCrew()): ICrewRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
  }
}

function makeMemberRepo(overrides: Partial<ICrewMemberRepository> = {}): ICrewMemberRepository {
  return {
    findById: vi.fn(), findAllByCrew: vi.fn(), findDirector: vi.fn(), delete: vi.fn(),
    create:              vi.fn().mockResolvedValue(makeMember()),
    findByCrewAndAgent:  vi.fn().mockResolvedValue(null),
    countDirectors:      vi.fn().mockResolvedValue(0),
    countByCrew:         vi.fn().mockResolvedValue(0),
    ...overrides,
  }
}

function makeAgentRepo(found: any = makeAgent()): IAgentRepository {
  return {
    findBySlug: vi.fn(), findByName: vi.fn(), countActive: vi.fn(),
    listByTenant: vi.fn(), create: vi.fn(), updateStatus: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
  }
}

describe('AddAgentToCrew', () => {
  let crewRepo:   ICrewRepository
  let memberRepo: ICrewMemberRepository
  let agentRepo:  IAgentRepository
  let audit:      IAuditLogger
  let useCase:    AddAgentToCrew

  beforeEach(() => {
    crewRepo   = makeCrewRepo()
    memberRepo = makeMemberRepo()
    agentRepo  = makeAgentRepo()
    audit      = { log: vi.fn() }
    useCase    = new AddAgentToCrew(crewRepo, memberRepo, agentRepo, audit)
  })

  it('adiciona agent como MEMBER', async () => {
    const result = await useCase.execute(makeInput())
    expect(result.role).toBe(CrewMemberRole.MEMBER)
    expect(memberRepo.create).toHaveBeenCalledOnce()
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.member_added' }))
  })

  it('adiciona agent como DIRECTOR quando não há director', async () => {
    vi.mocked(memberRepo.create).mockResolvedValue(makeMember({ role: CrewMemberRole.DIRECTOR }))
    const result = await useCase.execute(makeInput({ role: CrewMemberRole.DIRECTOR }))
    expect(result.role).toBe(CrewMemberRole.DIRECTOR)
  })

  it('rejeita agent de outro tenant', async () => {
    vi.mocked(agentRepo.findById).mockResolvedValue(null)
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' })
  })

  it('rejeita duplicate (mesmo agent na mesma crew)', async () => {
    vi.mocked(memberRepo.findByCrewAndAgent).mockResolvedValue(makeMember())
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'AGENT_ALREADY_IN_CREW' })
  })

  it('rejeita segundo DIRECTOR na mesma crew', async () => {
    vi.mocked(memberRepo.countDirectors).mockResolvedValue(1)
    await expect(useCase.execute(makeInput({ role: CrewMemberRole.DIRECTOR })))
      .rejects.toMatchObject({ code: 'CREW_ALREADY_HAS_DIRECTOR' })
  })

  it('permite DIRECTOR em crews diferentes', async () => {
    vi.mocked(memberRepo.countDirectors).mockResolvedValue(0)
    vi.mocked(memberRepo.create).mockResolvedValue(makeMember({ crewId: 'crew-2', role: CrewMemberRole.DIRECTOR }))
    await expect(useCase.execute(makeInput({ crewId: 'crew-2', role: CrewMemberRole.DIRECTOR }))).resolves.toBeDefined()
  })

  it('rejeita se crew de outro tenant', async () => {
    vi.mocked(crewRepo.findById).mockResolvedValue(null)
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Criar src/domains/crew/use-cases/AddAgentToCrew.ts**

```typescript
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { CrewMember, CrewMemberRole } from '../entities/CrewMember'
import { CrewMemberRole as Role } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'

type Input = {
  tenantId:    string
  crewId:      string
  agentId:     string
  role:        CrewMemberRole
  order:       number
  isRequired?: boolean
}

export class AddAgentToCrew {
  constructor(
    private crewRepo:   ICrewRepository,
    private memberRepo: ICrewMemberRepository,
    private agentRepo:  IAgentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<CrewMember> {
    const [crew, agent] = await Promise.all([
      this.crewRepo.findById(input.crewId, input.tenantId),
      this.agentRepo.findById(input.agentId, input.tenantId),
    ])

    if (!crew)  throw new AppError('CREW_NOT_FOUND',  'Crew não encontrada')
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'Agente não encontrado')

    const duplicate = await this.memberRepo.findByCrewAndAgent(input.crewId, input.agentId, input.tenantId)
    if (duplicate) throw new AppError('AGENT_ALREADY_IN_CREW', 'Este agente já está nesta crew')

    if (input.role === Role.DIRECTOR) {
      const directorCount = await this.memberRepo.countDirectors(input.crewId, input.tenantId)
      if (directorCount > 0) throw new AppError('CREW_ALREADY_HAS_DIRECTOR', 'Esta crew já possui um director')
    }

    const member = await this.memberRepo.create({
      tenantId:   input.tenantId,
      crewId:     input.crewId,
      agentId:    input.agentId,
      role:       input.role,
      order:      input.order,
      isRequired: input.isRequired,
    })

    await this.auditLogger.log({
      action: 'crew.member_added', tenantId: input.tenantId,
      resourceId: member.id, resourceType: 'crew_member',
      metadata: { crewId: input.crewId, agentId: input.agentId, role: input.role },
    })

    return member
  }
}
```

- [ ] **Step 3: Criar tests/unit/domains/crew/RemoveAgentFromCrew.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { RemoveAgentFromCrew } from '@/domains/crew/use-cases/RemoveAgentFromCrew'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

function makeMember(overrides = {}) {
  return {
    id: 'mem-1', tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1',
    role: CrewMemberRole.MEMBER, order: 0, isRequired: true, createdAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeMember()): ICrewMemberRepository {
  return {
    create: vi.fn(), findByCrewAndAgent: vi.fn(), findAllByCrew: vi.fn(),
    findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    delete:   vi.fn().mockResolvedValue(undefined),
  }
}

describe('RemoveAgentFromCrew', () => {
  it('remove membro existente', async () => {
    const repo = makeRepo()
    const audit: IAuditLogger = { log: vi.fn() }
    await new RemoveAgentFromCrew(repo, audit).execute({ memberId: 'mem-1', tenantId: 'tenant-1' })
    expect(repo.delete).toHaveBeenCalledWith('mem-1', 'tenant-1')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'crew.member_removed' }))
  })

  it('lança CREW_MEMBER_NOT_FOUND para membro de outro tenant', async () => {
    const repo = makeRepo(null)
    const audit: IAuditLogger = { log: vi.fn() }
    await expect(new RemoveAgentFromCrew(repo, audit).execute({ memberId: 'mem-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_MEMBER_NOT_FOUND' })
  })
})
```

- [ ] **Step 4: Criar src/domains/crew/use-cases/RemoveAgentFromCrew.ts**

```typescript
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

export class RemoveAgentFromCrew {
  constructor(
    private memberRepo: ICrewMemberRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: { memberId: string; tenantId: string }): Promise<void> {
    const member = await this.memberRepo.findById(input.memberId, input.tenantId)
    if (!member) throw new AppError('CREW_MEMBER_NOT_FOUND', 'Membro não encontrado')

    await this.memberRepo.delete(input.memberId, input.tenantId)

    await this.auditLogger.log({
      action: 'crew.member_removed', tenantId: input.tenantId,
      resourceId: input.memberId, resourceType: 'crew_member',
      metadata: { crewId: member.crewId, agentId: member.agentId },
    })
  }
}
```

- [ ] **Step 5: Criar tests/unit/domains/crew/ListCrewMembers.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { ListCrewMembers } from '@/domains/crew/use-cases/ListCrewMembers'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1', tenantId: 'tenant-1', departmentId: 'dept-1',
    name: 'Comercial IA', slug: 'comercial-ia', description: null,
    objective: null, status: CrewStatus.DRAFT, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(overrides = {}) {
  return {
    id: 'mem-1', tenantId: 'tenant-1', crewId: 'crew-1', agentId: 'agent-1',
    role: CrewMemberRole.MEMBER, order: 0, isRequired: true, createdAt: new Date(),
    ...overrides,
  }
}

describe('ListCrewMembers', () => {
  it('retorna membros ordenados por order', async () => {
    const crewRepo: ICrewRepository = {
      create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
      findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeCrew()),
    }
    const memberRepo: ICrewMemberRepository = {
      create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
      findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), delete: vi.fn(),
      findAllByCrew: vi.fn().mockResolvedValue([
        makeMember({ id: 'mem-2', order: 1 }),
        makeMember({ id: 'mem-1', order: 0 }),
      ]),
    }
    const result = await new ListCrewMembers(crewRepo, memberRepo).execute({ crewId: 'crew-1', tenantId: 'tenant-1' })
    expect(result).toHaveLength(2)
    expect(memberRepo.findAllByCrew).toHaveBeenCalledWith('crew-1', 'tenant-1')
  })

  it('lança CREW_NOT_FOUND para crew de outro tenant', async () => {
    const crewRepo: ICrewRepository = {
      create: vi.fn(), findByName: vi.fn(), findAllByTenant: vi.fn(),
      findAllByDepartment: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
    }
    const memberRepo: ICrewMemberRepository = {
      create: vi.fn(), findById: vi.fn(), findByCrewAndAgent: vi.fn(),
      findAllByCrew: vi.fn(), findDirector: vi.fn(), countDirectors: vi.fn(), countByCrew: vi.fn(), delete: vi.fn(),
    }
    await expect(new ListCrewMembers(crewRepo, memberRepo).execute({ crewId: 'crew-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'CREW_NOT_FOUND' })
  })
})
```

- [ ] **Step 6: Criar src/domains/crew/use-cases/ListCrewMembers.ts**

```typescript
import { AppError } from '@/shared/errors/AppError'
import type { CrewMember } from '../entities/CrewMember'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'

export class ListCrewMembers {
  constructor(
    private crewRepo:   ICrewRepository,
    private memberRepo: ICrewMemberRepository,
  ) {}

  async execute(input: { crewId: string; tenantId: string }): Promise<CrewMember[]> {
    const crew = await this.crewRepo.findById(input.crewId, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')
    return this.memberRepo.findAllByCrew(input.crewId, input.tenantId)
  }
}
```

- [ ] **Step 7: Rodar todos os testes de crew**

```bash
npx vitest run tests/unit/domains/crew/
```

Esperado: todos passando.

- [ ] **Step 8: Commit**

```bash
git add tests/unit/domains/crew/AddAgentToCrew.test.ts src/domains/crew/use-cases/AddAgentToCrew.ts \
        tests/unit/domains/crew/RemoveAgentFromCrew.test.ts src/domains/crew/use-cases/RemoveAgentFromCrew.ts \
        tests/unit/domains/crew/ListCrewMembers.test.ts src/domains/crew/use-cases/ListCrewMembers.ts
git commit -m "feat(crew): implement AddAgentToCrew, RemoveAgentFromCrew, ListCrewMembers with TDD"
```

---

## Task 9: Prisma Repositories

**Files:**
- Create: `src/infrastructure/db/repositories/PrismaCrewRepository.ts`
- Create: `src/infrastructure/db/repositories/PrismaCrewMemberRepository.ts`

- [ ] **Step 1: Criar PrismaCrewRepository.ts**

```typescript
import { randomUUID } from 'crypto'
import type { Crew, CreateCrewData, UpdateCrewData } from '@/domains/crew/entities/Crew'
import { CrewStatus } from '@/domains/crew/entities/Crew'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaCrewRepository implements ICrewRepository {
  private get db() { return getPrismaClient() }

  async create(data: CreateCrewData): Promise<Crew> {
    const r = await this.db.crew.create({
      data: { id: randomUUID(), tenantId: data.tenantId, departmentId: data.departmentId,
              name: data.name, slug: data.slug, description: data.description, objective: data.objective },
    })
    return this.toEntity(r)
  }

  async findById(id: string, tenantId: string): Promise<Crew | null> {
    const r = await this.db.crew.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string): Promise<Crew | null> {
    const r = await this.db.crew.findFirst({ where: { name, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findAllByTenant(tenantId: string): Promise<Crew[]> {
    const records = await this.db.crew.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
    return records.map((r) => this.toEntity(r))
  }

  async findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]> {
    const records = await this.db.crew.findMany({ where: { departmentId, tenantId }, orderBy: { name: 'asc' } })
    return records.map((r) => this.toEntity(r))
  }

  async update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew> {
    await this.db.crew.updateMany({ where: { id, tenantId }, data })
    const updated = await this.db.crew.findFirst({ where: { id, tenantId } })
    return this.toEntity(updated!)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.crew.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): Crew {
    return {
      id: r.id, tenantId: r.tenantId, departmentId: r.departmentId,
      name: r.name, slug: r.slug, description: r.description, objective: r.objective,
      status: r.status as CrewStatus, createdAt: r.createdAt, updatedAt: r.updatedAt,
    }
  }
}
```

- [ ] **Step 2: Criar PrismaCrewMemberRepository.ts**

```typescript
import { randomUUID } from 'crypto'
import type { CrewMember, CreateCrewMemberData } from '@/domains/crew/entities/CrewMember'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'
import type { ICrewMemberRepository } from '@/domains/crew/repositories/ICrewMemberRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaCrewMemberRepository implements ICrewMemberRepository {
  private get db() { return getPrismaClient() }

  async create(data: CreateCrewMemberData): Promise<CrewMember> {
    const r = await this.db.crewMember.create({
      data: { id: randomUUID(), tenantId: data.tenantId, crewId: data.crewId,
              agentId: data.agentId, role: data.role, order: data.order,
              isRequired: data.isRequired ?? true },
    })
    return this.toEntity(r)
  }

  async findById(id: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { crewId, agentId, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]> {
    const records = await this.db.crewMember.findMany({
      where: { crewId, tenantId }, orderBy: { order: 'asc' },
    })
    return records.map((r) => this.toEntity(r))
  }

  async findDirector(crewId: string, tenantId: string): Promise<CrewMember | null> {
    const r = await this.db.crewMember.findFirst({ where: { crewId, tenantId, role: 'DIRECTOR' } })
    return r ? this.toEntity(r) : null
  }

  async countDirectors(crewId: string, tenantId: string): Promise<number> {
    return this.db.crewMember.count({ where: { crewId, tenantId, role: 'DIRECTOR' } })
  }

  async countByCrew(crewId: string, tenantId: string): Promise<number> {
    return this.db.crewMember.count({ where: { crewId, tenantId } })
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.crewMember.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): CrewMember {
    return {
      id: r.id, tenantId: r.tenantId, crewId: r.crewId, agentId: r.agentId,
      role: r.role as CrewMemberRole, order: r.order, isRequired: r.isRequired,
      createdAt: r.createdAt,
    }
  }
}
```

- [ ] **Step 3: Aplicar migration**

Requer Docker rodando (`docker compose up -d`):

```bash
npx prisma migrate dev --name add_crews
```

Esperado: `✔ Applied 1 migration` — tabelas `crews` e `crew_members` criadas.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/db/repositories/PrismaCrewRepository.ts \
        src/infrastructure/db/repositories/PrismaCrewMemberRepository.ts \
        prisma/migrations/
git commit -m "feat(crew): add Prisma repositories and migration add_crews"
```

---

## Task 10: DI + Error Codes + API Routes

**Files:**
- Modify: `src/shared/utils/apiResponse.ts`
- Modify: `src/infrastructure/di/index.ts`
- Create: `src/app/api/v1/crews/route.ts`
- Create: `src/app/api/v1/crews/[id]/route.ts`
- Create: `src/app/api/v1/crews/[id]/members/route.ts`
- Create: `src/app/api/v1/crews/[id]/members/[memberId]/route.ts`

- [ ] **Step 1: Adicionar error codes em apiResponse.ts**

Abrir `src/shared/utils/apiResponse.ts`. Localizar `DEPARTMENT_NAME_TAKEN: 409,` e adicionar após:

```typescript
  CREW_NOT_FOUND:             404,
  CREW_MEMBER_NOT_FOUND:      404,
  CREW_NAME_TAKEN:            409,
  CREW_ALREADY_HAS_DIRECTOR:  409,
  AGENT_ALREADY_IN_CREW:      409,
  CREW_HAS_MEMBERS:           422,
```

- [ ] **Step 2: Atualizar src/infrastructure/di/index.ts**

Ler o arquivo. Adicionar imports após os imports do organization:

```typescript
import { CreateCrew } from '@/domains/crew/use-cases/CreateCrew'
import { ListCrews } from '@/domains/crew/use-cases/ListCrews'
import { GetCrew } from '@/domains/crew/use-cases/GetCrew'
import { UpdateCrew } from '@/domains/crew/use-cases/UpdateCrew'
import { DeleteCrew } from '@/domains/crew/use-cases/DeleteCrew'
import { AddAgentToCrew } from '@/domains/crew/use-cases/AddAgentToCrew'
import { RemoveAgentFromCrew } from '@/domains/crew/use-cases/RemoveAgentFromCrew'
import { ListCrewMembers } from '@/domains/crew/use-cases/ListCrewMembers'
import { InMemoryCrewRepository } from '@/infrastructure/db/repositories/InMemoryCrewRepository'
import { InMemoryCrewMemberRepository } from '@/infrastructure/db/repositories/InMemoryCrewMemberRepository'
import { PrismaCrewRepository } from '@/infrastructure/db/repositories/PrismaCrewRepository'
import { PrismaCrewMemberRepository } from '@/infrastructure/db/repositories/PrismaCrewMemberRepository'
```

Adicionar repositórios após `departmentRepo`:

```typescript
const crewRepo       = usePrisma ? new PrismaCrewRepository()       : new InMemoryCrewRepository()
const crewMemberRepo = usePrisma ? new PrismaCrewMemberRepository()  : new InMemoryCrewMemberRepository()
```

Adicionar ao objeto `di` após os use-cases de Organization:

```typescript
  // Crew
  createCrew:          new CreateCrew(crewRepo, departmentRepo, auditLogger),
  listCrews:           new ListCrews(crewRepo),
  getCrew:             new GetCrew(crewRepo, crewMemberRepo),
  updateCrew:          new UpdateCrew(crewRepo, auditLogger),
  deleteCrew:          new DeleteCrew(crewRepo, crewMemberRepo, auditLogger),
  addAgentToCrew:      new AddAgentToCrew(crewRepo, crewMemberRepo, agentRepo, auditLogger),
  removeAgentFromCrew: new RemoveAgentFromCrew(crewMemberRepo, auditLogger),
  listCrewMembers:     new ListCrewMembers(crewRepo, crewMemberRepo),
```

- [ ] **Step 3: Rodar suite completa para confirmar nada quebrou**

```bash
npx vitest run
```

Todos os 202+ testes devem passar.

- [ ] **Step 4: Criar diretórios de API**

```bash
mkdir -p src/app/api/v1/crews/\[id\]/members/\[memberId\]
```

- [ ] **Step 5: Criar src/app/api/v1/crews/route.ts**

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

const createSchema = z.object({
  departmentId: z.string().uuid(),
  name:         z.string().min(2).max(100),
  description:  z.string().max(500).optional(),
  objective:    z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    const body    = await request.json()
    const parsed  = createSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const crew = await di.createCrew.execute({ tenantId: session.tenantId!, ...parsed.data })
    return Response.json(crew, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session      = await getSession(request)
    const departmentId = request.nextUrl.searchParams.get('departmentId') ?? undefined
    const crews        = await di.listCrews.execute({ tenantId: session.tenantId!, departmentId })
    return Response.json(crews, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 6: Criar src/app/api/v1/crews/[id]/route.ts**

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { CrewStatus } from '@/domains/crew/entities/Crew'

const updateSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  objective:   z.string().max(500).optional(),
  status:      z.nativeEnum(CrewStatus).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    const result = await di.getCrew.execute({ id, tenantId: session.tenantId! })
    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([getSession(request), params, request.json()])
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const crew = await di.updateCrew.execute({ id, tenantId: session.tenantId!, ...parsed.data })
    return Response.json(crew, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    await di.deleteCrew.execute({ id, tenantId: session.tenantId! })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 7: Criar src/app/api/v1/crews/[id]/members/route.ts**

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { CrewMemberRole } from '@/domains/crew/entities/CrewMember'

const addSchema = z.object({
  agentId:    z.string().uuid(),
  role:       z.nativeEnum(CrewMemberRole),
  order:      z.number().int().min(0),
  isRequired: z.boolean().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([getSession(request), params, request.json()])
    const parsed = addSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const member = await di.addAgentToCrew.execute({
      tenantId: session.tenantId!,
      crewId:   id,
      ...parsed.data,
    })
    return Response.json(member, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    const members = await di.listCrewMembers.execute({ crewId: id, tenantId: session.tenantId! })
    return Response.json(members, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 8: Criar src/app/api/v1/crews/[id]/members/[memberId]/route.ts**

```typescript
import { type NextRequest } from 'next/server'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const [session, { memberId }] = await Promise.all([getSession(request), params])
    await di.removeAgentFromCrew.execute({ memberId, tenantId: session.tenantId! })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add src/shared/utils/apiResponse.ts src/infrastructure/di/index.ts src/app/api/v1/crews/
git commit -m "feat(crew): add DI registration, error codes, and REST API routes"
```

---

## Task 11: CONTEXT.md + Spec status

**Files:**
- Modify: `CONTEXT.md`
- Modify: `docs/specs/crew/crew-builder.md`

- [ ] **Step 1: Marcar spec como IMPLEMENTED**

Em `docs/specs/crew/crew-builder.md`, linha 3:

```
> **Status:** IMPLEMENTED
```

- [ ] **Step 2: Atualizar CONTEXT.md**

Na seção "10. O que está implementado", adicionar após Organization Layer:

```markdown
### ✅ Crew Builder — Fase 1.2 (spec IMPLEMENTED)
**Entities:** `Crew`, `CrewMember`
**Enums:** `CrewStatus`, `CrewMemberRole`
**Use-cases:** `CreateCrew`, `ListCrews`, `GetCrew`, `UpdateCrew`, `DeleteCrew`,
               `AddAgentToCrew`, `RemoveAgentFromCrew`, `ListCrewMembers`
**Infra:** `InMemoryCrewRepository`, `InMemoryCrewMemberRepository`,
           `PrismaCrewRepository`, `PrismaCrewMemberRepository`
**API routes:**
- `POST   /api/v1/crews` → cria crew (201)
- `GET    /api/v1/crews?departmentId=X` → lista crews do tenant
- `GET    /api/v1/crews/:id` → detalhe com members
- `PATCH  /api/v1/crews/:id` → atualiza
- `DELETE /api/v1/crews/:id` → hard-delete (falha se tiver membros)
- `POST   /api/v1/crews/:id/members` → adiciona agent (DIRECTOR|MEMBER|OBSERVER)
- `GET    /api/v1/crews/:id/members` → lista membros por order
- `DELETE /api/v1/crews/:id/members/:memberId` → remove membro
```

Na seção "12. Fases futuras", mudar `Fase 1.2` para `✅`:

```markdown
| **✅ Fase 1.2** | Crew Builder — IMPLEMENTADO |
| **Fase 1.3** | Crew Dashboard (UI) |
```

Atualizar contagem de testes na seção Fundação (será verificado após rodar).

- [ ] **Step 3: Rodar suite final completa**

```bash
npx vitest run
```

Verificar que todos os testes passam. Anotar o número final.

- [ ] **Step 4: Commit final**

```bash
git add CONTEXT.md docs/specs/crew/crew-builder.md
git commit -m "docs: mark Crew Builder as IMPLEMENTED and update CONTEXT.md"
```
