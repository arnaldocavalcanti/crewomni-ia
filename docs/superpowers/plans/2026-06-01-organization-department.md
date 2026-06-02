# Organization Layer — Department: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a entidade Department como fundação da camada organizacional (Tenant → Department → Crew), seguindo SDD/TDD e Clean Architecture.

**Architecture:** Novo domínio `src/domains/organization/` com entidade Department, repositório interface + InMemory + Prisma, 5 use-cases CRUD, APIs REST em `/api/v1/departments`, e UI básica em `/dashboard/departments`. Zero alteração em domínios existentes (apenas adição de relação no Prisma Tenant).

**Tech Stack:** TypeScript 5, Next.js 16 App Router, Prisma 7 (adapter-pg), Vitest 4, Zod, shadcn/ui + Tailwind 4.

---

## File Map

### Novos arquivos

```
docs/specs/organization/department.md                         ← SDD spec (Task 1)
src/domains/organization/entities/Department.ts               ← Entidade + enums (Task 2)
src/domains/organization/utils/generateSlug.ts                ← Slug util (Task 2)
src/domains/organization/repositories/IDepartmentRepository.ts← Interface (Task 3)
src/infrastructure/db/repositories/InMemoryDepartmentRepository.ts (Task 4)
tests/unit/domains/organization/CreateDepartment.test.ts      ← TDD (Task 5)
src/domains/organization/use-cases/CreateDepartment.ts        ← (Task 5)
tests/unit/domains/organization/ListDepartments.test.ts       ← TDD (Task 6)
src/domains/organization/use-cases/ListDepartments.ts         ← (Task 6)
tests/unit/domains/organization/GetDepartment.test.ts         ← TDD (Task 7)
src/domains/organization/use-cases/GetDepartment.ts           ← (Task 7)
tests/unit/domains/organization/UpdateDepartment.test.ts      ← TDD (Task 8)
src/domains/organization/use-cases/UpdateDepartment.ts        ← (Task 8)
tests/unit/domains/organization/DeleteDepartment.test.ts      ← TDD (Task 9)
src/domains/organization/use-cases/DeleteDepartment.ts        ← (Task 9)
src/infrastructure/db/repositories/PrismaDepartmentRepository.ts (Task 10)
src/app/api/v1/departments/route.ts                           ← POST, GET (Task 12)
src/app/api/v1/departments/[id]/route.ts                      ← GET, PATCH, DELETE (Task 12)
src/app/dashboard/departments/page.tsx                        ← UI lista (Task 14)
src/app/dashboard/departments/new/page.tsx                    ← UI formulário (Task 14)
```

### Arquivos modificados

```
prisma/schema.prisma                         ← + enum DepartmentStatus + model Department + Tenant.departments (Task 2)
src/shared/utils/apiResponse.ts              ← + DEPARTMENT_NOT_FOUND: 404, DEPARTMENT_NAME_TAKEN: 409 (Task 11)
src/infrastructure/di/index.ts               ← + departmentRepo + 5 use-cases (Task 11)
src/app/dashboard/layout.tsx (ou sidebar)    ← + link "Departments" no nav (Task 14)
CONTEXT.md                                   ← Atualizar estado implementado (Task 15)
```

---

## Task 1: SDD Spec — department.md

**Files:**
- Create: `docs/specs/organization/department.md`

- [ ] **Step 1: Criar a spec SDD**

```markdown
# Department

> **Status:** APPROVED
> **Domínio:** organization
> **Autor:** @crewomni
> **Data:** 2026-06-01

---

## 1. Objetivo

Permitir que cada tenant organize seus agentes e crews em departamentos (áreas de negócio), criando a camada hierárquica Tenant → Department → Crew.

---

## 2. Contexto de negócio

O CrewOmni permite que empresas criem crews (equipes de agentes). Para organizar múltiplas crews por área de negócio (Comercial, Suporte, Financeiro etc.), cada tenant precisa criar Departments que agrupam crews e facilitam governança, métricas e permissões.

---

## 3. Problema que resolve

Sem Department, todas as crews de um tenant ficam numa lista plana sem contexto organizacional. Com Department, o tenant pode visualizar "Crew Comercial" dentro de "Departamento Comercial", aplicar filtros, e futuramente atribuir permissões por área.

---

## 4. Regras de negócio

1. Um Department pertence a exatamente um Tenant.
2. O name deve ser único dentro do tenant.
3. O slug é gerado automaticamente a partir do name (lowercase, hífens).
4. O slug deve ser único dentro do tenant.
5. O status padrão é ACTIVE.
6. Um Department com status INACTIVE não pode receber novas Crews (Fase 1.2).
7. Deletar um Department com Crews associadas é proibido (Fase 1.2 — guard adicionado quando Crew existir).
8. tenantId vem exclusivamente da sessão JWT — nunca do body da requisição.
9. Busca de Department de outro tenant retorna 404 (nunca 403).

---

## 5. Fluxos principais

### Criar Department
1. Tenant Admin ou Operator autentica via JWT.
2. Envia POST /api/v1/departments com { name, description? }.
3. Sistema gera slug a partir do name.
4. Sistema valida unicidade de name e slug no tenant.
5. Persiste e retorna Department criado (201).

### Listar Departments
1. GET /api/v1/departments.
2. Retorna todos os departments do tenant, ordenados por name ASC.

### Obter Department
1. GET /api/v1/departments/:id.
2. Retorna o department se existir e pertencer ao tenant. Caso contrário, 404.

### Atualizar Department
1. PATCH /api/v1/departments/:id com { name?, description?, status? }.
2. Se name for alterado, regenera slug.
3. Valida unicidade do novo name no tenant.
4. Persiste e retorna Department atualizado.

### Deletar Department
1. DELETE /api/v1/departments/:id.
2. Fase 1.1: hard-delete sem crews.
3. Fase 1.2: bloquear se houver crews associadas.

---

## 6. Fluxos alternativos

- name duplicado no mesmo tenant → 409 DEPARTMENT_NAME_TAKEN.
- id de outro tenant → 404 DEPARTMENT_NOT_FOUND.
- id inexistente → 404 DEPARTMENT_NOT_FOUND.

---

## 7. Critérios de aceite

- [ ] POST /api/v1/departments cria e retorna Department com status 201.
- [ ] GET /api/v1/departments retorna apenas departments do tenant autenticado.
- [ ] GET /api/v1/departments/:id retorna 404 para id de outro tenant.
- [ ] PATCH /api/v1/departments/:id atualiza name e regenera slug.
- [ ] DELETE /api/v1/departments/:id remove o department.
- [ ] Tenant A não consegue ver nem editar departments do Tenant B.

---

## 8. Contratos de entrada e saída

### POST /api/v1/departments
```json
// Request body
{ "name": "Comercial", "description": "Área comercial da empresa" }

// Response 201
{ "id": "uuid", "tenantId": "uuid", "name": "Comercial", "slug": "comercial",
  "description": "...", "status": "ACTIVE", "createdAt": "ISO", "updatedAt": "ISO" }
```

### PATCH /api/v1/departments/:id
```json
// Request body (todos opcionais)
{ "name": "Comercial B2B", "description": "...", "status": "INACTIVE" }

// Response 200: Department atualizado
```

---

## 9. Impacto arquitetural

- Novo domínio: src/domains/organization/
- Nova tabela: departments (FK → tenants, cascade delete)
- prisma/schema.prisma: +enum DepartmentStatus +model Department +Tenant.departments[]
- src/infrastructure/di/index.ts: +departmentRepo +5 use-cases
- src/shared/utils/apiResponse.ts: +DEPARTMENT_NOT_FOUND +DEPARTMENT_NAME_TAKEN
- Fase 1.2: model Crew terá FK departmentId → departments

---

## 10. Riscos

- Conflito de slug ao renomear: mitigado com sufixo numérico automático.
- Delete com crews na Fase 1.2: guard a ser adicionado no use-case DeleteDepartment.

---

## 11. Testes esperados

Ver tests/unit/domains/organization/*.test.ts.
Cobertura: CreateDepartment, ListDepartments, GetDepartment, UpdateDepartment, DeleteDepartment.
Isolamento multi-tenant testado em todos os use-cases.

---

## 12. Critérios LGPD

Department não contém dados pessoais. AuditLog registra criação/atualização/deleção com tenantId e userId. Cascade delete remove departments ao deletar tenant.

---

## 13. Critérios de isolamento multi-tenant

- tenantId vem da sessão JWT.
- Todos os métodos de repositório filtram por (id, tenantId).
- Resposta para recurso de outro tenant: 404, nunca 403.
- RLS no PostgreSQL habilitado na Fase 2.
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/organization/department.md
git commit -m "docs(spec): add department spec - APPROVED"
```

---

## Task 2: Prisma Schema + Entidade + Slug Util

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/domains/organization/entities/Department.ts`
- Create: `src/domains/organization/utils/generateSlug.ts`

- [ ] **Step 1: Criar as pastas do domínio**

```bash
mkdir -p src/domains/organization/entities
mkdir -p src/domains/organization/repositories
mkdir -p src/domains/organization/use-cases
mkdir -p src/domains/organization/utils
mkdir -p tests/unit/domains/organization
```

- [ ] **Step 2: Adicionar enum e model ao schema.prisma**

Abrir `prisma/schema.prisma` e adicionar após o bloco `// ─── Conversation ─────`:

```prisma
// ─── Organization ─────────────────────────────────────────────────────────────

enum DepartmentStatus {
  ACTIVE
  INACTIVE
}

model Department {
  id          String           @id @default(uuid())
  tenantId    String
  name        String
  slug        String
  description String?
  status      DepartmentStatus @default(ACTIVE)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, name])
  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("departments")
}
```

No model `Tenant`, adicionar a relação (dentro do bloco de relations existente):

```prisma
  departments    Department[]
```

- [ ] **Step 3: Rodar prisma generate**

```bash
npx prisma generate
```

Esperado: `✔ Generated Prisma Client` sem erros.

- [ ] **Step 4: Criar src/domains/organization/entities/Department.ts**

```typescript
export enum DepartmentStatus {
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Department {
  id:          string
  tenantId:    string
  name:        string
  slug:        string
  description: string | null
  status:      DepartmentStatus
  createdAt:   Date
  updatedAt:   Date
}

export interface CreateDepartmentData {
  tenantId:     string
  name:         string
  slug:         string
  description?: string
}

export interface UpdateDepartmentData {
  name?:        string
  slug?:        string
  description?: string
  status?:      DepartmentStatus
}
```

- [ ] **Step 5: Criar src/domains/organization/utils/generateSlug.ts**

```typescript
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/domains/organization/
git commit -m "feat(organization): add Department entity, slug util, and Prisma schema"
```

---

## Task 3: IDepartmentRepository

**Files:**
- Create: `src/domains/organization/repositories/IDepartmentRepository.ts`

- [ ] **Step 1: Criar a interface**

```typescript
import type { Department, CreateDepartmentData, UpdateDepartmentData } from '../entities/Department'

export interface IDepartmentRepository {
  create(data: CreateDepartmentData): Promise<Department>
  findById(id: string, tenantId: string): Promise<Department | null>
  findByName(name: string, tenantId: string): Promise<Department | null>
  findBySlug(slug: string, tenantId: string): Promise<Department | null>
  findAllByTenant(tenantId: string): Promise<Department[]>
  update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department>
  delete(id: string, tenantId: string): Promise<void>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/organization/repositories/IDepartmentRepository.ts
git commit -m "feat(organization): add IDepartmentRepository interface"
```

---

## Task 4: InMemoryDepartmentRepository

**Files:**
- Create: `src/infrastructure/db/repositories/InMemoryDepartmentRepository.ts`

- [ ] **Step 1: Criar o repositório em memória**

```typescript
import { randomUUID } from 'crypto'
import type { Department, CreateDepartmentData, UpdateDepartmentData } from '@/domains/organization/entities/Department'
import { DepartmentStatus } from '@/domains/organization/entities/Department'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'

const store = new Map<string, Department>()

export class InMemoryDepartmentRepository implements IDepartmentRepository {
  async create(data: CreateDepartmentData): Promise<Department> {
    const dept: Department = {
      id:          randomUUID(),
      tenantId:    data.tenantId,
      name:        data.name,
      slug:        data.slug,
      description: data.description ?? null,
      status:      DepartmentStatus.ACTIVE,
      createdAt:   new Date(),
      updatedAt:   new Date(),
    }
    store.set(dept.id, dept)
    return dept
  }

  async findById(id: string, tenantId: string): Promise<Department | null> {
    const dept = store.get(id)
    return dept?.tenantId === tenantId ? dept : null
  }

  async findByName(name: string, tenantId: string): Promise<Department | null> {
    return Array.from(store.values()).find(
      (d) => d.name === name && d.tenantId === tenantId,
    ) ?? null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Department | null> {
    return Array.from(store.values()).find(
      (d) => d.slug === slug && d.tenantId === tenantId,
    ) ?? null
  }

  async findAllByTenant(tenantId: string): Promise<Department[]> {
    return Array.from(store.values())
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department> {
    const dept = store.get(id)
    if (!dept || dept.tenantId !== tenantId) throw new Error('Not found')
    const updated: Department = { ...dept, ...data, updatedAt: new Date() }
    store.set(id, updated)
    return updated
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const dept = store.get(id)
    if (dept?.tenantId === tenantId) store.delete(id)
  }

  // Utility para testes — limpa o store entre testes
  clear(): void { store.clear() }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/db/repositories/InMemoryDepartmentRepository.ts
git commit -m "feat(organization): add InMemoryDepartmentRepository"
```

---

## Task 5: CreateDepartment (TDD)

**Files:**
- Create: `tests/unit/domains/organization/CreateDepartment.test.ts`
- Create: `src/domains/organization/use-cases/CreateDepartment.ts`

- [ ] **Step 1: Escrever o teste (RED)**

```typescript
// tests/unit/domains/organization/CreateDepartment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateDepartment } from '@/domains/organization/use-cases/CreateDepartment'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1',
    tenantId: 'tenant-1',
    name: 'Comercial',
    slug: 'comercial',
    description: null,
    status: DepartmentStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return { tenantId: 'tenant-1', name: 'Comercial', description: undefined, ...overrides }
}

function makeRepo(): IDepartmentRepository {
  return {
    create:           vi.fn().mockResolvedValue(makeDept()),
    findById:         vi.fn().mockResolvedValue(null),
    findByName:       vi.fn().mockResolvedValue(null),
    findBySlug:       vi.fn().mockResolvedValue(null),
    findAllByTenant:  vi.fn().mockResolvedValue([]),
    update:           vi.fn(),
    delete:           vi.fn(),
  }
}

function makeAudit(): IAuditLogger {
  return { log: vi.fn() }
}

describe('CreateDepartment', () => {
  let repo: IDepartmentRepository
  let audit: IAuditLogger
  let useCase: CreateDepartment

  beforeEach(() => {
    repo  = makeRepo()
    audit = makeAudit()
    useCase = new CreateDepartment(repo, audit)
  })

  it('cria department com dados válidos', async () => {
    const result = await useCase.execute(makeInput())
    expect(result.name).toBe('Comercial')
    expect(result.slug).toBe('comercial')
    expect(result.status).toBe(DepartmentStatus.ACTIVE)
    expect(repo.create).toHaveBeenCalledOnce()
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'department.created' }))
  })

  it('gera slug a partir do name com acentos', async () => {
    vi.mocked(repo.create).mockResolvedValue(makeDept({ name: 'Jurídico', slug: 'juridico' }))
    const result = await useCase.execute(makeInput({ name: 'Jurídico' }))
    expect(result.slug).toBe('juridico')
  })

  it('rejeita name duplicado no mesmo tenant', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(makeDept())
    await expect(useCase.execute(makeInput())).rejects.toMatchObject({ code: 'DEPARTMENT_NAME_TAKEN' })
  })

  it('aceita mesmo name em tenant diferente (isolamento)', async () => {
    vi.mocked(repo.findByName).mockImplementation(async (_, tenantId) =>
      tenantId === 'tenant-2' ? makeDept({ tenantId: 'tenant-2' }) : null,
    )
    await expect(useCase.execute(makeInput({ tenantId: 'tenant-1' }))).resolves.toBeDefined()
  })

  it('cria com description nula quando não fornecida', async () => {
    const result = await useCase.execute(makeInput())
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
  })
})
```

- [ ] **Step 2: Rodar e confirmar que FALHA (RED)**

```bash
npm run test -- tests/unit/domains/organization/CreateDepartment.test.ts
```

Esperado: `FAIL — Cannot find module '@/domains/organization/use-cases/CreateDepartment'`

- [ ] **Step 3: Implementar CreateDepartment.ts (GREEN)**

```typescript
// src/domains/organization/use-cases/CreateDepartment.ts
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Department } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'
import { generateSlug } from '../utils/generateSlug'

type Input = {
  tenantId:     string
  name:         string
  description?: string
}

export class CreateDepartment {
  constructor(
    private repo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Department> {
    const slug = generateSlug(input.name)

    const existing = await this.repo.findByName(input.name, input.tenantId)
    if (existing) throw new AppError('DEPARTMENT_NAME_TAKEN', 'Já existe um departamento com este nome')

    const dept = await this.repo.create({
      tenantId:    input.tenantId,
      name:        input.name,
      slug,
      description: input.description,
    })

    await this.auditLogger.log({
      action:       'department.created',
      tenantId:     input.tenantId,
      resourceId:   dept.id,
      resourceType: 'department',
      metadata:     { name: dept.name },
    })

    return dept
  }
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

```bash
npm run test -- tests/unit/domains/organization/CreateDepartment.test.ts
```

Esperado: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add tests/unit/domains/organization/CreateDepartment.test.ts src/domains/organization/use-cases/CreateDepartment.ts
git commit -m "feat(organization): implement CreateDepartment use-case with TDD"
```

---

## Task 6: ListDepartments (TDD)

**Files:**
- Create: `tests/unit/domains/organization/ListDepartments.test.ts`
- Create: `src/domains/organization/use-cases/ListDepartments.ts`

- [ ] **Step 1: Escrever o teste (RED)**

```typescript
// tests/unit/domains/organization/ListDepartments.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ListDepartments } from '@/domains/organization/use-cases/ListDepartments'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(depts = [makeDept()]): IDepartmentRepository {
  return {
    create: vi.fn(), findById: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(),
    findAllByTenant: vi.fn().mockResolvedValue(depts),
    update: vi.fn(), delete: vi.fn(),
  }
}

describe('ListDepartments', () => {
  it('retorna todos os departments do tenant', async () => {
    const repo = makeRepo([makeDept(), makeDept({ id: 'dept-2', name: 'Suporte', slug: 'suporte' })])
    const useCase = new ListDepartments(repo)
    const result = await useCase.execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(2)
    expect(repo.findAllByTenant).toHaveBeenCalledWith('tenant-1')
  })

  it('retorna lista vazia se tenant sem departments', async () => {
    const repo = makeRepo([])
    const useCase = new ListDepartments(repo)
    const result = await useCase.execute({ tenantId: 'tenant-1' })
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar FAIL (RED)**

```bash
npm run test -- tests/unit/domains/organization/ListDepartments.test.ts
```

- [ ] **Step 3: Implementar ListDepartments.ts (GREEN)**

```typescript
// src/domains/organization/use-cases/ListDepartments.ts
import type { Department } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'

export class ListDepartments {
  constructor(private repo: IDepartmentRepository) {}

  async execute(input: { tenantId: string }): Promise<Department[]> {
    return this.repo.findAllByTenant(input.tenantId)
  }
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

```bash
npm run test -- tests/unit/domains/organization/ListDepartments.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/domains/organization/ListDepartments.test.ts src/domains/organization/use-cases/ListDepartments.ts
git commit -m "feat(organization): implement ListDepartments use-case with TDD"
```

---

## Task 7: GetDepartment (TDD)

**Files:**
- Create: `tests/unit/domains/organization/GetDepartment.test.ts`
- Create: `src/domains/organization/use-cases/GetDepartment.ts`

- [ ] **Step 1: Escrever o teste (RED)**

```typescript
// tests/unit/domains/organization/GetDepartment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GetDepartment } from '@/domains/organization/use-cases/GetDepartment'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(result: any = null): IDepartmentRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(),
    findById: vi.fn().mockResolvedValue(result),
    update: vi.fn(), delete: vi.fn(),
  }
}

describe('GetDepartment', () => {
  it('retorna department existente do mesmo tenant', async () => {
    const repo = makeRepo(makeDept())
    const useCase = new GetDepartment(repo)
    const result = await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1' })
    expect(result.id).toBe('dept-1')
  })

  it('lança DEPARTMENT_NOT_FOUND para id de outro tenant', async () => {
    // findById com tenantId errado retorna null (isolamento no repo)
    const repo = makeRepo(null)
    const useCase = new GetDepartment(repo)
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })

  it('lança DEPARTMENT_NOT_FOUND para id inexistente', async () => {
    const repo = makeRepo(null)
    const useCase = new GetDepartment(repo)
    await expect(useCase.execute({ id: 'nope', tenantId: 'tenant-1' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar FAIL (RED)**

```bash
npm run test -- tests/unit/domains/organization/GetDepartment.test.ts
```

- [ ] **Step 3: Implementar GetDepartment.ts (GREEN)**

```typescript
// src/domains/organization/use-cases/GetDepartment.ts
import { AppError } from '@/shared/errors/AppError'
import type { Department } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'

export class GetDepartment {
  constructor(private repo: IDepartmentRepository) {}

  async execute(input: { id: string; tenantId: string }): Promise<Department> {
    const dept = await this.repo.findById(input.id, input.tenantId)
    if (!dept) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')
    return dept
  }
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

```bash
npm run test -- tests/unit/domains/organization/GetDepartment.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/domains/organization/GetDepartment.test.ts src/domains/organization/use-cases/GetDepartment.ts
git commit -m "feat(organization): implement GetDepartment use-case with TDD"
```

---

## Task 8: UpdateDepartment (TDD)

**Files:**
- Create: `tests/unit/domains/organization/UpdateDepartment.test.ts`
- Create: `src/domains/organization/use-cases/UpdateDepartment.ts`

- [ ] **Step 1: Escrever o teste (RED)**

```typescript
// tests/unit/domains/organization/UpdateDepartment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateDepartment } from '@/domains/organization/use-cases/UpdateDepartment'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeDept()): IDepartmentRepository {
  return {
    create: vi.fn(), findBySlug: vi.fn().mockResolvedValue(null),
    findAllByTenant: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    findByName: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockImplementation(async (id, _tenantId, data) => ({ ...found, ...data, updatedAt: new Date() })),
    delete: vi.fn(),
  }
}

describe('UpdateDepartment', () => {
  let repo: IDepartmentRepository
  let audit: IAuditLogger
  let useCase: UpdateDepartment

  beforeEach(() => {
    repo  = makeRepo()
    audit = { log: vi.fn() }
    useCase = new UpdateDepartment(repo, audit)
  })

  it('atualiza name e regenera slug', async () => {
    const result = await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1', name: 'Jurídico' })
    expect(repo.update).toHaveBeenCalledWith('dept-1', 'tenant-1', expect.objectContaining({ name: 'Jurídico', slug: 'juridico' }))
  })

  it('inativa department', async () => {
    const result = await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1', status: DepartmentStatus.INACTIVE })
    expect(repo.update).toHaveBeenCalledWith('dept-1', 'tenant-1', expect.objectContaining({ status: DepartmentStatus.INACTIVE }))
  })

  it('lança DEPARTMENT_NOT_FOUND para department de outro tenant', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null)
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })

  it('lança DEPARTMENT_NAME_TAKEN se novo name já existe no tenant', async () => {
    vi.mocked(repo.findByName).mockResolvedValue(makeDept({ id: 'dept-2', name: 'Suporte' }))
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-1', name: 'Suporte' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NAME_TAKEN' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar FAIL (RED)**

```bash
npm run test -- tests/unit/domains/organization/UpdateDepartment.test.ts
```

- [ ] **Step 3: Implementar UpdateDepartment.ts (GREEN)**

```typescript
// src/domains/organization/use-cases/UpdateDepartment.ts
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { Department, DepartmentStatus, UpdateDepartmentData } from '../entities/Department'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'
import { generateSlug } from '../utils/generateSlug'

type Input = {
  id:           string
  tenantId:     string
  name?:        string
  description?: string
  status?:      DepartmentStatus
}

export class UpdateDepartment {
  constructor(
    private repo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Department> {
    const existing = await this.repo.findById(input.id, input.tenantId)
    if (!existing) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')

    const updateData: UpdateDepartmentData = {}

    if (input.name !== undefined) {
      const byName = await this.repo.findByName(input.name, input.tenantId)
      if (byName && byName.id !== input.id) throw new AppError('DEPARTMENT_NAME_TAKEN', 'Já existe um departamento com este nome')
      updateData.name = input.name
      updateData.slug = generateSlug(input.name)
    }

    if (input.description !== undefined) updateData.description = input.description
    if (input.status !== undefined) updateData.status = input.status

    const updated = await this.repo.update(input.id, input.tenantId, updateData)

    await this.auditLogger.log({
      action: 'department.updated', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'department', metadata: updateData as Record<string, unknown>,
    })

    return updated
  }
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

```bash
npm run test -- tests/unit/domains/organization/UpdateDepartment.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/domains/organization/UpdateDepartment.test.ts src/domains/organization/use-cases/UpdateDepartment.ts
git commit -m "feat(organization): implement UpdateDepartment use-case with TDD"
```

---

## Task 9: DeleteDepartment (TDD)

**Files:**
- Create: `tests/unit/domains/organization/DeleteDepartment.test.ts`
- Create: `src/domains/organization/use-cases/DeleteDepartment.ts`

- [ ] **Step 1: Escrever o teste (RED)**

```typescript
// tests/unit/domains/organization/DeleteDepartment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { DeleteDepartment } from '@/domains/organization/use-cases/DeleteDepartment'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

function makeDept(overrides = {}) {
  return {
    id: 'dept-1', tenantId: 'tenant-1', name: 'Comercial', slug: 'comercial',
    description: null, status: DepartmentStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(found: any = makeDept()): IDepartmentRepository {
  return {
    create: vi.fn(), findByName: vi.fn(), findBySlug: vi.fn(), findAllByTenant: vi.fn(), update: vi.fn(),
    findById: vi.fn().mockResolvedValue(found),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

describe('DeleteDepartment', () => {
  it('deleta department existente do mesmo tenant', async () => {
    const repo = makeRepo()
    const audit: IAuditLogger = { log: vi.fn() }
    const useCase = new DeleteDepartment(repo, audit)
    await useCase.execute({ id: 'dept-1', tenantId: 'tenant-1' })
    expect(repo.delete).toHaveBeenCalledWith('dept-1', 'tenant-1')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'department.deleted' }))
  })

  it('lança DEPARTMENT_NOT_FOUND para department de outro tenant', async () => {
    const repo = makeRepo(null)
    const audit: IAuditLogger = { log: vi.fn() }
    const useCase = new DeleteDepartment(repo, audit)
    await expect(useCase.execute({ id: 'dept-1', tenantId: 'tenant-2' }))
      .rejects.toMatchObject({ code: 'DEPARTMENT_NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Rodar e confirmar FAIL (RED)**

```bash
npm run test -- tests/unit/domains/organization/DeleteDepartment.test.ts
```

- [ ] **Step 3: Implementar DeleteDepartment.ts (GREEN)**

```typescript
// src/domains/organization/use-cases/DeleteDepartment.ts
import { AppError } from '@/shared/errors/AppError'
import type { IAuditLogger } from '@/shared/types/IAuditLogger'
import type { IDepartmentRepository } from '../repositories/IDepartmentRepository'

export class DeleteDepartment {
  constructor(
    private repo: IDepartmentRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: { id: string; tenantId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id, input.tenantId)
    if (!existing) throw new AppError('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado')

    await this.repo.delete(input.id, input.tenantId)

    await this.auditLogger.log({
      action: 'department.deleted', tenantId: input.tenantId,
      resourceId: input.id, resourceType: 'department',
      metadata: { name: existing.name },
    })
  }
}
```

- [ ] **Step 4: Rodar e confirmar GREEN**

```bash
npm run test -- tests/unit/domains/organization/DeleteDepartment.test.ts
```

- [ ] **Step 5: Rodar todos os testes de organization juntos**

```bash
npm run test -- tests/unit/domains/organization/
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/domains/organization/DeleteDepartment.test.ts src/domains/organization/use-cases/DeleteDepartment.ts
git commit -m "feat(organization): implement DeleteDepartment use-case with TDD"
```

---

## Task 10: PrismaDepartmentRepository

**Files:**
- Create: `src/infrastructure/db/repositories/PrismaDepartmentRepository.ts`

- [ ] **Step 1: Criar o repositório Prisma**

```typescript
// src/infrastructure/db/repositories/PrismaDepartmentRepository.ts
import { randomUUID } from 'crypto'
import type { Department, CreateDepartmentData, UpdateDepartmentData } from '@/domains/organization/entities/Department'
import { DepartmentStatus } from '@/domains/organization/entities/Department'
import type { IDepartmentRepository } from '@/domains/organization/repositories/IDepartmentRepository'
import { getPrismaClient } from '@/infrastructure/db/prisma/client'

export class PrismaDepartmentRepository implements IDepartmentRepository {
  private get db() { return getPrismaClient() }

  async create(data: CreateDepartmentData): Promise<Department> {
    const r = await this.db.department.create({
      data: { id: randomUUID(), tenantId: data.tenantId, name: data.name, slug: data.slug, description: data.description },
    })
    return this.toEntity(r)
  }

  async findById(id: string, tenantId: string): Promise<Department | null> {
    const r = await this.db.department.findFirst({ where: { id, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findByName(name: string, tenantId: string): Promise<Department | null> {
    const r = await this.db.department.findFirst({ where: { name, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findBySlug(slug: string, tenantId: string): Promise<Department | null> {
    const r = await this.db.department.findFirst({ where: { slug, tenantId } })
    return r ? this.toEntity(r) : null
  }

  async findAllByTenant(tenantId: string): Promise<Department[]> {
    const records = await this.db.department.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
    return records.map((r) => this.toEntity(r))
  }

  async update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department> {
    const r = await this.db.department.updateMany({ where: { id, tenantId }, data })
    // updateMany não retorna o record — buscar após update
    const updated = await this.db.department.findFirst({ where: { id, tenantId } })
    return this.toEntity(updated!)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.db.department.deleteMany({ where: { id, tenantId } })
  }

  private toEntity(r: any): Department {
    return {
      id: r.id, tenantId: r.tenantId, name: r.name, slug: r.slug,
      description: r.description, status: r.status as DepartmentStatus,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }
  }
}
```

- [ ] **Step 2: Aplicar a migration ao banco**

Requer Docker rodando (`docker compose up -d`):

```bash
npx prisma migrate dev --name add_departments
```

Esperado: `✔ Applied 1 migration` e tabela `departments` criada.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/repositories/PrismaDepartmentRepository.ts prisma/migrations/
git commit -m "feat(organization): add PrismaDepartmentRepository and migration add_departments"
```

---

## Task 11: Registrar no DI e Adicionar Códigos de Erro

**Files:**
- Modify: `src/shared/utils/apiResponse.ts`
- Modify: `src/infrastructure/di/index.ts`

- [ ] **Step 1: Adicionar códigos de erro em apiResponse.ts**

Localizar o objeto `ERROR_STATUS` e adicionar após `DOCUMENT_NOT_FOUND: 404,`:

```typescript
  DEPARTMENT_NOT_FOUND: 404,
  DEPARTMENT_NAME_TAKEN: 409,
```

- [ ] **Step 2: Registrar no DI**

Em `src/infrastructure/di/index.ts`:

**Adicionar imports** (após os imports de Conversation):

```typescript
import { CreateDepartment } from '@/domains/organization/use-cases/CreateDepartment'
import { ListDepartments } from '@/domains/organization/use-cases/ListDepartments'
import { GetDepartment } from '@/domains/organization/use-cases/GetDepartment'
import { UpdateDepartment } from '@/domains/organization/use-cases/UpdateDepartment'
import { DeleteDepartment } from '@/domains/organization/use-cases/DeleteDepartment'
import { InMemoryDepartmentRepository } from '@/infrastructure/db/repositories/InMemoryDepartmentRepository'
import { PrismaDepartmentRepository } from '@/infrastructure/db/repositories/PrismaDepartmentRepository'
```

**Adicionar repositório** (após `conversationRepo`):

```typescript
const departmentRepo = usePrisma ? new PrismaDepartmentRepository() : new InMemoryDepartmentRepository()
```

**Adicionar no objeto `di`** (após os use-cases de Conversation):

```typescript
  // Organization
  createDepartment:  new CreateDepartment(departmentRepo, auditLogger),
  listDepartments:   new ListDepartments(departmentRepo),
  getDepartment:     new GetDepartment(departmentRepo),
  updateDepartment:  new UpdateDepartment(departmentRepo, auditLogger),
  deleteDepartment:  new DeleteDepartment(departmentRepo, auditLogger),
```

- [ ] **Step 3: Rodar todos os testes para garantir que nada quebrou**

```bash
npm run test
```

Esperado: todos os testes existentes continuam passando + novos testes de organization.

- [ ] **Step 4: Commit**

```bash
git add src/shared/utils/apiResponse.ts src/infrastructure/di/index.ts
git commit -m "feat(organization): register department use-cases in DI and add error codes"
```

---

## Task 12: API Routes

**Files:**
- Create: `src/app/api/v1/departments/route.ts`
- Create: `src/app/api/v1/departments/[id]/route.ts`

- [ ] **Step 1: Criar a pasta**

```bash
mkdir -p src/app/api/v1/departments/\[id\]
```

- [ ] **Step 2: Criar src/app/api/v1/departments/route.ts**

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'

const createSchema = z.object({
  name:        z.string().min(2).max(100),
  description: z.string().max(500).optional(),
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

    const dept = await di.createDepartment.execute({
      tenantId: session.tenantId!,
      ...parsed.data,
    })

    return Response.json(dept, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    const depts   = await di.listDepartments.execute({ tenantId: session.tenantId! })
    return Response.json(depts, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 3: Criar src/app/api/v1/departments/[id]/route.ts**

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getSession } from '@/shared/guards/withSession'
import { DepartmentStatus } from '@/domains/organization/entities/Department'

const updateSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  status:      z.nativeEnum(DepartmentStatus).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    const dept = await di.getDepartment.execute({ id, tenantId: session.tenantId! })
    return Response.json(dept, { status: 200 })
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

    const dept = await di.updateDepartment.execute({ id, tenantId: session.tenantId!, ...parsed.data })
    return Response.json(dept, { status: 200 })
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
    await di.deleteDepartment.execute({ id, tenantId: session.tenantId! })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/departments/
git commit -m "feat(organization): add REST API routes for departments"
```

---

## Task 13: UI — Dashboard de Departments

> **OBRIGATÓRIO antes de qualquer arquivo .tsx:** Invocar o skill `frontend-design` conforme CLAUDE.md. Somente implementar após o design ser definido.

**Files:**
- Modify: `src/app/dashboard/layout.tsx` (ou componente de sidebar)
- Create: `src/app/dashboard/departments/page.tsx`
- Create: `src/app/dashboard/departments/new/page.tsx`

- [ ] **Step 1: Invocar frontend-design skill**

```
/frontend-design
```

Aguardar o design definir: layout da lista, formulário de criação, posição do item na sidebar. Somente avançar após aprovação do design.

- [ ] **Step 2: Adicionar "Departments" à sidebar**

Localizar o componente de sidebar (provavelmente em `src/app/dashboard/layout.tsx` ou componente separado).  
Adicionar item após "Agents":

```tsx
<Link href="/dashboard/departments" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
  <Building2 className="h-4 w-4" />
  Departments
</Link>
```

Adicionar import: `import { Building2 } from 'lucide-react'`

- [ ] **Step 3: Criar page.tsx (lista)**

Estrutura base — adaptar conforme design aprovado pelo frontend-design skill:

```tsx
// src/app/dashboard/departments/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface Department {
  id: string; name: string; slug: string; description: string | null; status: string
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/v1/departments')
      .then((r) => r.json())
      .then(setDepartments)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <Button asChild><Link href="/dashboard/departments/new">Novo Department</Link></Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : departments.length === 0 ? (
        <p className="text-muted-foreground">Nenhum department criado ainda.</p>
      ) : (
        <div className="grid gap-4">
          {departments.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <Badge variant={d.status === 'ACTIVE' ? 'default' : 'secondary'}>{d.status}</Badge>
                </div>
              </CardHeader>
              {d.description && <CardContent><p className="text-sm text-muted-foreground">{d.description}</p></CardContent>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar new/page.tsx (formulário)**

```tsx
// src/app/dashboard/departments/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

export default function NewDepartmentPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await api('/api/v1/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined }),
      })
      if (!r.ok) {
        const data = await r.json()
        setError(data.message ?? 'Erro ao criar department')
        return
      }
      router.push('/dashboard/departments')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Novo Department</h1>
      <Card>
        <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Comercial" required minLength={2} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" maxLength={500} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting ? 'Criando...' : 'Criar Department'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Testar a UI no browser**

```bash
npm run dev
```

Abrir http://localhost:3000/dashboard/departments. Verificar:
- Lista aparece (vazia inicialmente)
- Clicar "Novo Department" → formulário abre
- Preencher name e submeter → redireciona para lista
- Department aparece na lista com status ACTIVE

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/departments/ src/app/dashboard/layout.tsx
git commit -m "feat(organization): add department dashboard UI (list + create)"
```

---

## Task 14: Atualizar CONTEXT.md e spec status

**Files:**
- Modify: `CONTEXT.md`
- Modify: `docs/specs/organization/department.md`

- [ ] **Step 1: Atualizar status da spec para IMPLEMENTED**

Em `docs/specs/organization/department.md`, linha 3:

```
> **Status:** IMPLEMENTED
```

- [ ] **Step 2: Atualizar CONTEXT.md**

Na seção "10. O que está implementado", adicionar:

```markdown
### ✅ Organization Layer — Department (spec IMPLEMENTED)
**Entities:** `Department`
**Enums:** `DepartmentStatus`
**Use-cases:** `CreateDepartment`, `ListDepartments`, `GetDepartment`, `UpdateDepartment`, `DeleteDepartment`
**Infra:** `InMemoryDepartmentRepository`, `PrismaDepartmentRepository`
**API routes:**
- `POST /api/v1/departments` → cria department
- `GET /api/v1/departments` → lista departments do tenant
- `GET /api/v1/departments/:id` → detalhe
- `PATCH /api/v1/departments/:id` → atualiza
- `DELETE /api/v1/departments/:id` → deleta
```

Na seção "12. Fases futuras", adicionar antes de Fase 2:

```markdown
| **Fase 1.2** | Crew Builder (Crew + CrewMember + Director role) |
| **Fase 1.3** | Crew Dashboard |
| **Fase 1.4** | Crew Chat básico |
| **Fase 1.5** | Workflow e Handoff entre agentes |
| **Fase 1.6** | Métricas de Crew |
```

- [ ] **Step 3: Rodar suite completa de testes**

```bash
npm run test
```

Esperado: todos os testes passando (186 existentes + novos de organization).

- [ ] **Step 4: Commit final**

```bash
git add CONTEXT.md docs/specs/organization/department.md
git commit -m "docs: mark Department as IMPLEMENTED and update CONTEXT.md"
```
