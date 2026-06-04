# Design: Fase 1.2 — Crew Builder

**Data:** 2026-06-02
**Status:** APPROVED
**Branch:** feat/fase-1-2-crew-builder
**Próxima fase:** 1.3 — Crew Dashboard (UI)

---

## Contexto

A Fase 1.1 implementou Department — a camada organizacional entre Tenant e Crew. A Fase 1.2 implementa a entidade Crew (equipe de agentes com objetivo comum) e CrewMember (associação N:N entre Crew e Agent).

Hierarquia completa após esta fase:
```
Tenant → Department → Crew → CrewMember(role=DIRECTOR|MEMBER|OBSERVER) → Agent
```

---

## Decisões arquiteturais tomadas no brainstorming

| Decisão | Escolha | Motivo |
|---|---|---|
| Director | CrewMember com role=DIRECTOR (sem directorAgentId na Crew) | Normalizado, sem risco de inconsistência |
| CrewMemberRole | Enum fixo: DIRECTOR, MEMBER, OBSERVER | Validável, filtrável |
| handoffRules | Deferido para Fase 1.5 | Não há orquestração ainda |
| Agent em múltiplas crews | Permitido (N:N via CrewMember) | Reutilização de agentes especializados |
| Scope da Fase 1.2 | Backend only (entidades, APIs, testes) | UI vai para Fase 1.3 |

---

## Entidades

### Crew

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

### CrewMember

```typescript
export enum CrewMemberRole {
  DIRECTOR  = 'DIRECTOR',
  MEMBER    = 'MEMBER',
  OBSERVER  = 'OBSERVER',
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
  tenantId:   string
  crewId:     string
  agentId:    string
  role:       CrewMemberRole
  order:      number
  isRequired?: boolean
}
```

---

## Schema Prisma

```prisma
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

**Alterações em modelos existentes:**
- `Department`: adicionar relação `crews Crew[]`
- `Agent`: adicionar relação `crewMemberships CrewMember[]`
- `Tenant`: adicionar relações `crews Crew[]` e `crewMembers CrewMember[]`

---

## Domínio

```
src/domains/crew/
├── entities/
│   ├── Crew.ts
│   └── CrewMember.ts
├── repositories/
│   ├── ICrewRepository.ts
│   └── ICrewMemberRepository.ts
└── use-cases/
    ├── CreateCrew.ts
    ├── ListCrews.ts
    ├── GetCrew.ts
    ├── UpdateCrew.ts
    ├── DeleteCrew.ts
    ├── AddAgentToCrew.ts
    ├── RemoveAgentFromCrew.ts
    └── ListCrewMembers.ts
```

---

## Interfaces dos repositórios

### ICrewRepository

```typescript
interface ICrewRepository {
  create(data: CreateCrewData): Promise<Crew>
  findById(id: string, tenantId: string): Promise<Crew | null>
  findByName(name: string, tenantId: string): Promise<Crew | null>
  findAllByTenant(tenantId: string): Promise<Crew[]>
  findAllByDepartment(departmentId: string, tenantId: string): Promise<Crew[]>
  update(id: string, tenantId: string, data: UpdateCrewData): Promise<Crew>
  delete(id: string, tenantId: string): Promise<void>
}
```

### ICrewMemberRepository

```typescript
interface ICrewMemberRepository {
  create(data: CreateCrewMemberData): Promise<CrewMember>
  findById(id: string, tenantId: string): Promise<CrewMember | null>
  findByCrewAndAgent(crewId: string, agentId: string, tenantId: string): Promise<CrewMember | null>
  findAllByCrew(crewId: string, tenantId: string): Promise<CrewMember[]>  // ordenados por order ASC
  findDirector(crewId: string, tenantId: string): Promise<CrewMember | null>
  countDirectors(crewId: string, tenantId: string): Promise<number>
  countByCrew(crewId: string, tenantId: string): Promise<number>
  delete(id: string, tenantId: string): Promise<void>
}
```

---

## Use-cases

### CreateCrew
- Input: `{ tenantId, departmentId, name, description?, objective? }`
- Valida: department pertence ao tenant (findById retorna null → `DEPARTMENT_NOT_FOUND`)
- Valida: unicidade de name no tenant → `CREW_NAME_TAKEN`
- Gera slug do name
- Persiste em status DRAFT
- Audit: `crew.created`

### ListCrews
- Input: `{ tenantId, departmentId? }`
- Retorna crews do tenant, filtradas por departmentId se fornecido

### GetCrew
- Input: `{ id, tenantId }`
- Retorna Crew com membros incluídos (via `findAllByCrew`)
- 404 se não pertencer ao tenant → `CREW_NOT_FOUND`

### UpdateCrew
- Input: `{ id, tenantId, name?, description?, objective?, status? }`
- Valida existência + tenant → `CREW_NOT_FOUND`
- Valida unicidade se name alterado → `CREW_NAME_TAKEN`
- Regenera slug se name mudar
- Audit: `crew.updated`

### DeleteCrew
- Input: `{ id, tenantId }`
- Valida existência + tenant → `CREW_NOT_FOUND`
- Conta membros: se > 0 → rejeita com `CREW_HAS_MEMBERS`
- Hard-delete
- Audit: `crew.deleted`

### AddAgentToCrew
- Input: `{ crewId, agentId, role, order, isRequired?, tenantId }`
- Valida: crew pertence ao tenant → `CREW_NOT_FOUND`
- Valida: agent pertence ao tenant (via agentRepo.findById) → `AGENT_NOT_FOUND`
- Valida: (crewId, agentId) não duplicado → `AGENT_ALREADY_IN_CREW`
- Valida: se role=DIRECTOR, conta diretores existentes → se > 0 → `CREW_ALREADY_HAS_DIRECTOR`
- Persiste
- Audit: `crew.member_added`

### RemoveAgentFromCrew
- Input: `{ memberId, tenantId }`
- Valida: memberId pertence ao tenant → `CREW_MEMBER_NOT_FOUND`
- Deleta
- Audit: `crew.member_removed`

### ListCrewMembers
- Input: `{ crewId, tenantId }`
- Valida: crew pertence ao tenant → `CREW_NOT_FOUND`
- Retorna membros ordenados por `order` ASC

---

## APIs REST

```
POST   /api/v1/crews                       → CreateCrew
GET    /api/v1/crews?departmentId=X        → ListCrews
GET    /api/v1/crews/:id                   → GetCrew (inclui members)
PATCH  /api/v1/crews/:id                   → UpdateCrew
DELETE /api/v1/crews/:id                   → DeleteCrew

POST   /api/v1/crews/:id/members           → AddAgentToCrew
GET    /api/v1/crews/:id/members           → ListCrewMembers
DELETE /api/v1/crews/:id/members/:memberId → RemoveAgentFromCrew
```

**Contratos:**

```
POST /api/v1/crews
Body: { departmentId, name, description?, objective? }
Response 201: Crew

GET /api/v1/crews?departmentId=X
Response 200: Crew[]

GET /api/v1/crews/:id
Response 200: Crew & { members: CrewMember[] }

POST /api/v1/crews/:id/members
Body: { agentId, role: "DIRECTOR"|"MEMBER"|"OBSERVER", order: number, isRequired?: boolean }
Response 201: CrewMember

DELETE /api/v1/crews/:id/members/:memberId
Response 204
```

---

## Novos error codes (apiResponse.ts)

```typescript
CREW_NOT_FOUND:          404,
CREW_MEMBER_NOT_FOUND:   404,
CREW_NAME_TAKEN:         409,
CREW_ALREADY_HAS_DIRECTOR: 409,
AGENT_ALREADY_IN_CREW:   409,
CREW_HAS_MEMBERS:        422,
```

---

## Testes unitários

```
tests/unit/domains/crew/
├── CreateCrew.test.ts
│   ✓ cria crew com dados válidos
│   ✓ gera slug do name
│   ✓ rejeita name duplicado no tenant (CREW_NAME_TAKEN)
│   ✓ rejeita departmentId de outro tenant (DEPARTMENT_NOT_FOUND)
│   ✓ aceita mesmo name em tenant diferente (isolamento)
│
├── GetCrew.test.ts
│   ✓ retorna crew com membros
│   ✓ 404 para crew de outro tenant
│   ✓ 404 para id inexistente
│
├── ListCrews.test.ts
│   ✓ lista apenas crews do tenant
│   ✓ filtra por departmentId
│   ✓ retorna lista vazia
│
├── UpdateCrew.test.ts
│   ✓ atualiza name e regenera slug
│   ✓ atualiza status para ACTIVE
│   ✓ rejeita name duplicado
│   ✓ 404 para crew de outro tenant
│
├── DeleteCrew.test.ts
│   ✓ deleta crew sem membros
│   ✓ rejeita se crew tem membros (CREW_HAS_MEMBERS)
│   ✓ 404 para crew de outro tenant
│
├── AddAgentToCrew.test.ts
│   ✓ adiciona agent como MEMBER
│   ✓ adiciona agent como DIRECTOR
│   ✓ rejeita agent de outro tenant (AGENT_NOT_FOUND)
│   ✓ rejeita duplicate agentId na mesma crew (AGENT_ALREADY_IN_CREW)
│   ✓ rejeita segundo DIRECTOR na mesma crew (CREW_ALREADY_HAS_DIRECTOR)
│   ✓ permite DIRECTOR em crews diferentes
│
├── RemoveAgentFromCrew.test.ts
│   ✓ remove membro existente
│   ✓ 404 para membro de outro tenant
│
└── ListCrewMembers.test.ts
    ✓ retorna membros ordenados por order ASC
    ✓ 404 para crew de outro tenant
    ✓ retorna lista vazia
```

---

## Regras multi-tenant (invioláveis)

- `tenantId` sempre da sessão JWT
- `findById(id, tenantId)` filtra por ambos — retorna null se mismatch
- Agent de outro tenant não pode ser adicionado à crew → `AGENT_NOT_FOUND`
- Department de outro tenant não pode ser usado → `DEPARTMENT_NOT_FOUND`
- Busca por recurso de outro tenant: **404**, nunca 403

---

## LGPD

- Crew e CrewMember não contêm dados pessoais
- AuditLog para criação, atualização, deleção de crews e membros
- Cascade delete: deletar tenant remove crews e membros automaticamente

---

## Impacto em Fase 1.3+

- **Fase 1.3:** dashboard visual lê crews via `GET /api/v1/crews` e membros via `GET /api/v1/crews/:id/members`
- **Fase 1.4:** `StartCrewConversation` usará crew para rotear mensagem ao DIRECTOR
- **Fase 1.5:** `handoffRules` será adicionado ao CrewMember via migration

---

## Ordem de implementação (SDD/TDD)

```
1. SDD spec em docs/specs/crew/crew-builder.md
2. Prisma schema + prisma generate
3. Crew entity + CrewMember entity
4. ICrewRepository + ICrewMemberRepository
5. InMemoryCrewRepository + InMemoryCrewMemberRepository
6. Use-cases com TDD (CreateCrew, ListCrews, GetCrew, UpdateCrew, DeleteCrew)
7. Use-cases com TDD (AddAgentToCrew, RemoveAgentFromCrew, ListCrewMembers)
8. PrismaCrewRepository + PrismaCrewMemberRepository
9. Migration: add_crews
10. DI registration + error codes
11. API routes
12. Atualizar CONTEXT.md
```
