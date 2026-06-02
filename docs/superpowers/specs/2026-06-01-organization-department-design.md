# Design: Fase 1.1 — Organization Layer (Department)

**Data:** 2026-06-01
**Status:** APPROVED
**Sprint:** Fase 1.1 — Fundação da camada organizacional
**Próxima fase:** 1.2 — Crew Builder

---

## Contexto

O CrewOmni permite que empresas criem equipes inteligentes de agentes (Crews). Para organizar essas crews por área de negócio, é necessária a entidade **Department** — a camada organizacional entre `Tenant` e `Crew`.

Sem Department, não é possível construir a hierarquia:
```
Tenant → Department → Crew → Director → Agents
```

Esta fase implementa apenas o Department. Crew e Director entram na Fase 1.2.

---

## Decisões arquiteturais tomadas no brainstorming

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo da fase | Department only | Segurança, SDD/TDD por entidade |
| Director | Role na CrewMember membership | Flexível, não polui AgentType |
| CrewConversation | Extensão de Conversation | Preserva histórico, migration simples |

---

## Entidade: Department

```typescript
interface Department {
  id:          string        // UUID
  tenantId:    string        // FK → tenants (NOT NULL)
  name:        string        // ex: "Comercial", "Suporte"
  slug:        string        // gerado do name, único por tenant
  description: string | null
  status:      DepartmentStatus // ACTIVE | INACTIVE
  createdAt:   Date
  updatedAt:   Date
}

enum DepartmentStatus {
  ACTIVE   = "ACTIVE",
  INACTIVE = "INACTIVE",
}
```

**Constraints:**
- `UNIQUE(tenantId, name)` — names únicos por tenant
- `UNIQUE(tenantId, slug)` — slugs únicos por tenant
- `INDEX(tenantId)` — queries sempre filtradas por tenant

---

## Schema Prisma

```prisma
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

**Alteração no model Tenant:**
```prisma
departments Department[]
```

**Migration:** `npx prisma migrate dev --name add_departments`
Nenhuma tabela existente é alterada.

---

## Estrutura de domínio

```
src/domains/organization/
├── entities/
│   └── Department.ts
├── repositories/
│   └── IDepartmentRepository.ts
└── use-cases/
    ├── CreateDepartment.ts
    ├── ListDepartments.ts
    ├── GetDepartment.ts
    ├── UpdateDepartment.ts
    └── DeleteDepartment.ts
```

---

## Interface do repositório

```typescript
// src/domains/organization/repositories/IDepartmentRepository.ts

interface CreateDepartmentData {
  tenantId:    string
  name:        string
  slug:        string
  description?: string
}

interface UpdateDepartmentData {
  name?:        string
  slug?:        string
  description?: string
  status?:      DepartmentStatus
}

interface IDepartmentRepository {
  create(data: CreateDepartmentData): Promise<Department>
  findById(id: string, tenantId: string): Promise<Department | null>
  findBySlug(slug: string, tenantId: string): Promise<Department | null>
  findByName(name: string, tenantId: string): Promise<Department | null>
  findAllByTenant(tenantId: string): Promise<Department[]>
  update(id: string, tenantId: string, data: UpdateDepartmentData): Promise<Department>
  delete(id: string, tenantId: string): Promise<void>
}
```

---

## Use-cases

### CreateDepartment
- Input: `{ tenantId, name, description? }`
- Gera slug a partir do name (lowercase, hífens)
- Valida unicidade de name no tenant → `DEPARTMENT_NAME_ALREADY_EXISTS`
- Valida unicidade de slug no tenant → regenera com sufixo se conflito
- Persiste e retorna Department
- Audit log: `department.created`

### ListDepartments
- Input: `{ tenantId }`
- Retorna todos os departments do tenant ordenados por name
- Nunca retorna dados de outro tenant

### GetDepartment
- Input: `{ id, tenantId }`
- Retorna 404 (`DEPARTMENT_NOT_FOUND`) se não existir ou pertencer a outro tenant
- Nunca retorna 403 (não revela existência de recurso de outro tenant)

### UpdateDepartment
- Input: `{ id, tenantId, name?, description?, status? }`
- Valida unicidade se name for alterado
- Atualiza slug se name mudar
- Retorna 404 se de outro tenant

### DeleteDepartment
- Input: `{ id, tenantId }`
- Fase 1.1: hard-delete (sem crews ainda)
- Fase 1.2: bloquear delete se houver crews associadas
- Retorna 404 se de outro tenant

---

## APIs REST

```
POST   /api/v1/departments
GET    /api/v1/departments
GET    /api/v1/departments/:id
PATCH  /api/v1/departments/:id
DELETE /api/v1/departments/:id
```

**Regras:**
- Todas exigem JWT válido (`getSession`)
- `tenantId` vem exclusivamente da sessão — nunca do body
- Respostas seguem padrão `apiResponse` existente

**Contratos:**

```
POST /api/v1/departments
Body: { name: string, description?: string }
Response 201: { id, tenantId, name, slug, description, status, createdAt }

GET /api/v1/departments
Response 200: Department[]

GET /api/v1/departments/:id
Response 200: Department
Response 404: { error: "DEPARTMENT_NOT_FOUND" }

PATCH /api/v1/departments/:id
Body: { name?, description?, status? }
Response 200: Department

DELETE /api/v1/departments/:id
Response 204: (no body)
```

---

## Dashboard UI

**Rotas novas:**
- `/dashboard/departments` — lista de departments
- `/dashboard/departments/new` — formulário de criação

**Componentes:**
- `DepartmentList` — tabela com colunas: Name, Slug, Status, Actions
- `DepartmentForm` — campos: name (required), description (optional)
- `StatusBadge` — reutilizar componente existente

**Navegação:**
- Sidebar: adicionar item "Departments" com ícone `Building2` (lucide-react), abaixo de "Agents"

**Padrão visual:** shadcn/ui + Tailwind 4, dark mode nativo — idêntico a `/dashboard/agents`.

> Antes de implementar qualquer arquivo `.tsx`, invocar o skill `frontend-design` conforme CLAUDE.md.

---

## Testes

### Unitários (`tests/unit/organization/`)

```
CreateDepartment.test.ts
  ✓ cria department com dados válidos
  ✓ gera slug a partir do name
  ✓ rejeita name duplicado no mesmo tenant (DEPARTMENT_NAME_ALREADY_EXISTS)
  ✓ aceita mesmo name em tenant diferente (isolamento multi-tenant)
  ✓ cria com description nula

ListDepartments.test.ts
  ✓ lista apenas departments do tenant solicitante
  ✓ retorna lista vazia se tenant sem departments

GetDepartment.test.ts
  ✓ retorna department existente do mesmo tenant
  ✓ retorna 404 para department de outro tenant
  ✓ retorna 404 para id inexistente

UpdateDepartment.test.ts
  ✓ atualiza name e regenera slug
  ✓ atualiza description
  ✓ inativa department (status INACTIVE)
  ✓ retorna 404 para department de outro tenant
  ✓ rejeita name já existente no tenant

DeleteDepartment.test.ts
  ✓ deleta department existente
  ✓ retorna 404 para department de outro tenant
```

### Integração (`tests/integration/organization/`)

```
department-repository.test.ts
  ✓ CRUD completo via PrismaDepartmentRepository
  ✓ isolamento: tenant A não vê departments do tenant B
  ✓ cascade delete ao deletar tenant
```

---

## Regras multi-tenant (invioláveis)

- `tenantId` vem da sessão JWT — nunca do body
- `findById(id, tenantId)` sempre filtra por ambos — retorna `null` se mismatch
- Resposta para recurso de outro tenant: **404**, nunca 403
- RLS no PostgreSQL será habilitado na Fase 2 (conforme CONTEXT.md)

---

## LGPD

- Department não contém dados pessoais — sem impacto direto em LGPD
- AuditLog registra criação, atualização e deleção com `tenantId` e `userId`
- Deleção de tenant em cascade remove departments automaticamente (OnDelete: Cascade)

---

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Conflito de slug ao renomear | Baixa | Geração com sufixo numérico automático |
| Delete de department com crews (Fase 1.2) | Média | Adicionar guard no use-case na Fase 1.2 |
| UI inconsistente com design system | Baixa | Invocar frontend-design antes de implementar |

---

## Impacto arquitetural na Fase 1.2

Na Fase 1.2, a entidade `Crew` terá:
```typescript
departmentId: string  // FK → departments (NOT NULL)
```

O model `Department` receberá:
```prisma
crews Crew[]
```

Nenhuma alteração nas APIs ou use-cases de Department será necessária.

---

## Ordem de implementação (SDD/TDD)

```
1. Spec SDD em /docs/specs/organization/department.md  (status: DRAFT → APPROVED)
2. Testes unitários (RED)
3. Entidade Department.ts
4. IDepartmentRepository.ts
5. CreateDepartment.ts + demais use-cases (GREEN)
6. InMemoryDepartmentRepository.ts
7. PrismaDepartmentRepository.ts
8. Migration: add_departments
9. DI: registrar repositório em src/infrastructure/di/index.ts
10. API routes: /api/v1/departments
11. Invocar frontend-design → implementar UI
12. Testes de integração
13. Atualizar CONTEXT.md
```
