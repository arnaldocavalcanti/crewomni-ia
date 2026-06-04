# AI Agent Hub — Contexto Completo do Projeto

> Leia este arquivo antes de qualquer intervenção no projeto.
> Ele resume toda a arquitetura, decisões, convenções e estado atual do desenvolvimento.

---

## 1. O que é o projeto

**AI Agent Hub** (codinome: crewomni-ia) é uma plataforma SaaS multi-tenant, multi-nicho e multiagente para criação de agentes de IA especializados.

Cada empresa cliente (tenant) pode criar agentes do tipo:
- **SDR** — prospecção e qualificação de leads
- **Helpdesk** — suporte técnico
- **Negotiation** — negociação
- **Onboarding** — onboarding de clientes
- **Support** — atendimento
- **Sales** — atendimento comercial

Exemplos de tenants iniciais:
- **Devolus** — SaaS de vistoria de imóveis (nicho: REAL_ESTATE)
- **Fast4Sign** — SaaS de assinatura eletrônica (nicho: ESIGN)
- Imobiliárias em geral

---

## 2. Visão estratégica

Além de agentes privados por tenant, a plataforma terá **agentes mestres por nicho** alimentados por uma **Knowledge Distillation Layer (KDL)** que extrai aprendizados genéricos e anonimizados das interações dos tenants.

**Regra inviolável:** dados brutos de um tenant nunca alimentam outro tenant.

Camadas de conhecimento (5 layers):
1. **Global KB** — boas práticas gerais da plataforma
2. **Industry KB** — conhecimento coletivo por nicho (via KDL)
3. **Tenant KB** — conhecimento privado da empresa
4. **Agent KB** — configuração específica do agente
5. **Conversation Memory** — memória contextual da conversa ativa

---

## 3. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Linguagem | TypeScript 5 |
| Estilo | Tailwind CSS 4 + shadcn/base-ui + Design System Gradient Shell |
| ORM | Prisma 7.8.0 (adapter-based, sem URL no schema) |
| Banco de dados | PostgreSQL + pgvector (futuro) |
| Vetores | pgvector (MVP) → Qdrant (escala) |
| Cache | Redis (futuro) |
| Fila | BullMQ + Redis (futuro) |
| LLM | OpenAI API (via interface ILLMProvider) |
| JWT | jose (ESM-native, compatível com Next.js) |
| Hash de senha | bcryptjs (via IPasswordHasher) |
| Hash de tokens | SHA-256 (crypto nativo do Node.js) |
| Validação | Zod |
| Testes | Vitest 4 + Testing Library |
| Ambiente | Node.js (darwin) |

---

## 4. Arquitetura

### Princípio geral
**Clean Architecture pragmática** — domínio no centro, infraestrutura nas bordas.

```
src/
├── app/                    # Next.js App Router (rotas e UI apenas)
│   └── api/v1/             # Route Handlers — chamam use-cases, sem lógica direta
├── domains/                # Núcleo de negócio — sem dependência de framework
│   ├── auth/               # Autenticação e autorização
│   ├── tenant/             # Multi-tenancy e resolução de contexto
│   ├── agent/              # Agent Builder — IMPLEMENTADO
│   ├── knowledge/          # RAG e bases de conhecimento — PENDENTE
│   ├── conversation/       # Conversas e memória — PENDENTE
│   ├── distillation/       # Knowledge Distillation Layer — PENDENTE
│   └── niche/              # Nichos de mercado — PENDENTE
├── infrastructure/         # Implementações concretas (adapters)
│   ├── db/
│   │   ├── prisma/client.ts        # Singleton do Prisma Client
│   │   └── repositories/           # InMemory* (dev) + Prisma* (prod)
│   ├── auth/BcryptPasswordHasher.ts
│   ├── audit/ConsoleAuditLogger.ts + PrismaAuditLogger.ts
│   └── di/index.ts                 # Container de injeção de dependência
└── shared/                 # Tipos, erros e utilitários sem lógica de domínio
    ├── errors/AppError.ts
    ├── types/IAuditLogger.ts + IPasswordHasher.ts
    ├── constants/index.ts
    ├── guards/withSession.ts       # getSession(), requirePlatformAdmin()
    └── utils/apiResponse.ts       # errorResponse(), cookies helpers
```

### Regra de dependência
```
app/ → domains/ (use-cases) → shared/
app/ → infrastructure/ (via DI)
infrastructure/ → domains/ (implementa interfaces)
domains/ NÃO importam infrastructure/ nem app/
```

---

## 5. Prisma 7 — Particularidades importantes

O projeto usa **Prisma 7** que tem breaking changes em relação ao Prisma 6:

1. `url = env("DATABASE_URL")` foi **removido** do `schema.prisma`
2. A URL agora vai no `prisma.config.ts`
3. `PrismaClient` agora requer um **adapter** obrigatório

**schema.prisma:**
```prisma
datasource db {
  provider = "postgresql"  // sem url aqui
}
```

**prisma.config.ts:**
```typescript
import { defineConfig } from 'prisma/config'
export default defineConfig({ datasource: { url: process.env.DATABASE_URL } })
```

**client.ts:**
```typescript
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
```

---

## 6. Injeção de dependência (DI)

**Localização:** `src/infrastructure/di/index.ts`

O DI chaveia automaticamente entre repositórios:
- Sem `DATABASE_URL` → usa repositórios **InMemory** (desenvolvimento sem banco)
- Com `DATABASE_URL` → usa repositórios **Prisma** (produção)

```typescript
const usePrisma = !!process.env.DATABASE_URL
const agentRepo = usePrisma ? new PrismaAgentRepository() : new InMemoryAgentRepository()
```

---

## 7. Padrões obrigatórios

### SDD — Specification-Driven Development
**Toda funcionalidade começa com uma spec em `/docs/specs/<domínio>/<feature>.md`**

A spec usa o template de 13 seções (ver `docs/specs/_template.md`):
1. Objetivo | 2. Contexto de negócio | 3. Problema que resolve
4. Regras de negócio | 5. Fluxos principais | 6. Fluxos alternativos
7. Critérios de aceite | 8. Contratos de entrada e saída
9. Impacto arquitetural | 10. Riscos | 11. Testes esperados
12. Critérios LGPD | 13. Critérios de isolamento multi-tenant

Status possíveis: `DRAFT → REVIEW → APPROVED → IMPLEMENTED`

### TDD — Test-Driven Development
**Testes são escritos ANTES da implementação.**

Ordem obrigatória:
```
spec APPROVED → testes (RED) → use-cases (GREEN) → infra + rotas
```

### Estrutura de um domínio
```
domains/<domínio>/
├── entities/           # Tipos e enums puros
├── repositories/       # Interfaces (portas) — NUNCA implementações
├── use-cases/          # Um arquivo por caso de uso
└── __tests__/          # (opcional, testes ficam em /tests/)
```

### Nomenclatura
- Entidade: `PascalCase.ts` → `Agent.ts`
- Interface de repository: `I` + PascalCase → `IAgentRepository.ts`
- Use-case: verbo + substantivo → `CreateAgent.ts`
- Implementação Prisma: `Prisma` + PascalCase → `PrismaAgentRepository.ts`
- Implementação InMemory: `InMemory` + PascalCase → `InMemoryAgentRepository.ts`
- Teste: `<NomeDoArquivo>.test.ts`

---

## 8. Regras de isolamento multi-tenant (invioláveis)

1. `tenantId` **sempre** extraído da sessão JWT — nunca de body ou query param
2. Todo repository recebe `tenantId` como parâmetro obrigatório
3. Busca por ID de outro tenant retorna **404** (nunca 403 — não revela existência)
4. RLS habilitado no PostgreSQL em todas as tabelas com `tenantId`
5. Testes de isolamento são obrigatórios em todo domínio

---

## 9. Autenticação

### Estratégias de resolução de tenant (ADR 002)
| Canal | Estratégia |
|---|---|
| Dashboard (área logada) | JWT na sessão — `tenantId` vem do token |
| REST API externa | API key no `Authorization` header |
| Web Widget | `data-tenant-id` no script tag — verificado server-side |
| Widget de chat público | Slug na query param |

### Roles
```typescript
enum UserRole {
  TENANT_ADMIN     // administrador do tenant
  TENANT_OPERATOR  // operador (configura agentes)
  KDL_APPROVER     // aprova insights da KDL
  PLATFORM_ADMIN   // super-admin da plataforma (sem tenantId)
}
```

### Tokens
- **Access token**: JWT HS256, expiração 1h, gerado com `jose`
- **Refresh token**: SHA-256 de um `randomBytes(32)`, expiração 7 dias, rotativo
- **API key**: `sha256(rawKey)` — prefixo de 14 chars para lookup (`ahub_live_xxxx`)

---

## 10. O que está implementado

### ✅ Fundação
- `.agent/rules/` — 7 arquivos de regras para agentes de IA
- `docs/specs/_template.md` — template SDD com 13 seções
- `docs/adr/001`, `002`, `003`, `004` — decisões técnicas documentadas
- Vitest configurado com ambiente `node`
- **231 testes passando** (32 arquivos)

### ✅ ADRs
- `ADR 001` — Decisões técnicas iniciais
- `ADR 002` — Estratégia de resolução de tenant
- `ADR 003` — Estratégia de embedding e chunking (pgvector, chunk 512 tokens, overlap 64)
- `ADR 004` — Estrutura do prompt hierárquico (5 layers, budget por bloco, ILLMProvider)
- `ADR 005` — Pipeline da KDL (5 etapas, anonimização, aprovação humana, opt-out por tenant)

### ✅ Auth (spec IMPLEMENTED)
**Entities:** `User`, `RefreshToken`
**Use-cases:** `AuthenticateUser`, `RefreshSession`, `LogoutUser`
**API routes:**
- `POST /api/v1/auth/login` → retorna `{ accessToken, user }` + cookie `refreshToken`
- `POST /api/v1/auth/refresh` → lê cookie, rotaciona tokens
- `POST /api/v1/auth/logout` → revoga token, limpa cookie

### ✅ Tenant (spec IMPLEMENTED)
**Entities:** `Tenant`, `TenantSettings`
**Use-cases:** `ResolveTenantContext` (3 estratégias), `CreateTenant`
**API routes:**
- `POST /api/v1/tenants` — apenas PLATFORM_ADMIN

### ✅ Knowledge Ingest (spec IMPLEMENTED)
**Entities:** `KnowledgeDocument`, `KnowledgeChunk`
**Enums:** `KnowledgeLayer`, `DocumentStatus`
**Use-cases:** `IngestDocument`, `DeleteDocument`, `SearchKnowledge`
**Interfaces:** `IEmbeddingProvider`, `IVectorRepository`
**Utils:** `chunkText` (chunk com overlap)

### ✅ Dashboard Básico (spec IMPLEMENTED)
**Stack:** shadcn/base-ui + lucide-react + Tailwind 4 · design system Gradient Shell · dark mode via ThemeToggle
**Telas:**
- `/login` — split layout (painel esquerdo com brand + formulário direito)
- `/dashboard` — home com métricas (agentes ativos, conversas abertas) + EmptyState
- `/dashboard/agents` — lista de agentes
- `/dashboard/agents/new` — criar agente (nome, tipo, description, system prompt)
- `/dashboard/agents/:id` — detalhe + publicar prompt + chat de teste integrado
- `/dashboard/conversations` — lista de conversas
- `/dashboard/conversations/:id` — histórico de mensagens
**Helpers:** `src/lib/api.ts` (fetch com refresh automático), `src/lib/auth.ts` (token em localStorage)
**Componentes:** `StatusBadge`, `EmptyState`, `ThemeToggle` + primitivos shadcn (Button, Input, Card, Table, Badge, etc.)

### ✅ UI Redesign — Gradient Shell (IMPLEMENTED 2026-06-04)
**Spec:** `docs/superpowers/specs/2026-06-04-ui-redesign-gradient-shell.md`
**Design:** sistema visual derivado do logo crewomni.ia — gradiente ciano→azul→roxo
**Mudanças:**
- **Paleta:** tokens CSS completos em `globals.css` — `--color-cyan: #06C8E8`, `--color-blue: #4F6EF7`, `--color-purple: #7C3AED`, `--gradient-primary` (gradiente 135deg)
- **Fonte:** Inter (substituiu Geist Sans) — `--font-sans` via `next/font/google`
- **Modo claro:** padrão. Dark mode opcional via `ThemeToggle` (localStorage `theme`)
- **Sidebar:** branca (240px), border-right, nav items com barra gradiente no estado ativo, drawer deslizante no mobile
- **Login:** split layout — painel esquerdo com gradiente + formulário à direita
- **Button:** variante `gradient` (bg-gradient-primary, text-white, hover:opacity-90)
- **EmptyState:** componente `src/components/ui/empty-state.tsx` — ícone, título, descrição, CTA
- **ThemeToggle:** componente `src/components/ui/theme-toggle.tsx` — localStorage + prefers-color-scheme
- **OnboardingWizard:** `src/components/onboarding/OnboardingWizard.tsx` — 3 passos, firstLogin via `localStorage.onboarding_complete`, barra de progresso gradiente
- **Dark tokens:** bloco `.dark` completo em `globals.css`

### ✅ Chat Widget Público (spec IMPLEMENTED)
**Use-case novo:** `GetAgentBySlug`
**API routes públicas (sem JWT):**
- `GET /api/v1/widget/config?tenant=X&agent=Y` → `{ agentName, agentType, welcomeMessage, primaryColor }`
- `POST /api/v1/widget/chat` → `{ conversationId, reply, isNewConversation }`
**Resolução de tenant:** slug via `ResolveTenantContext` (estratégia `PUBLIC_SLUG`)
**Segurança:** `tenantId`, `systemPrompt` e dados internos nunca expostos na resposta

### ✅ Banco de dados configurado
- **Docker:** `docker-compose.yml` com `pgvector/pgvector:pg16` na porta **5434**
- **Extensões:** `uuid-ossp` + `vector` ativas via `docker/init.sql`
- **Migrations aplicadas:**
  - `20260531234212_init` — 13 tabelas criadas
  - `20260531235000_add_embedding_to_knowledge_chunks` — `embedding vector(1536)` + índice HNSW
- **Prisma config:** `prisma.config.ts` carrega `.env` via `@next/env`
- **Comandos:** `docker compose up -d` → `npx prisma migrate dev`

### ✅ Prisma Schema completo
Todos os modelos implementados: `Tenant`, `TenantSettings`, `User`, `RefreshToken`, `ApiKey`, `Agent`, `AgentPromptVersion`, `KnowledgeDocument`, `KnowledgeChunk`, `Conversation`, `Message`, `AuditLog`

### ✅ Conversation Audit (spec IMPLEMENTED)
**Entities:** `Conversation`, `Message`
**Enums:** `ConversationStatus`, `MessageRole`
**Use-cases:** `SendMessage` (orquestra RAG + persiste ambas mensagens), `ListConversations`, `GetConversationMessages`
**Infra:** `InMemoryConversationRepository`
**API routes:**
- `POST /api/v1/conversations/message` → `{ conversationId, messageId, reply, model, tokensUsed, isNewConversation }`
- `GET /api/v1/conversations?agentId=X&page=1` → lista paginada
- `GET /api/v1/conversations/:id/messages` → histórico completo

### ✅ RAG Orchestrator (spec IMPLEMENTED)
**Use-case:** `BuildRAGContext` — embedding → busca paralela nas layers → prompt hierárquico (ADR 004) → LLM → audit log
**Interfaces:** `ILLMProvider`
**Adapters:** `OpenAILLMProvider`, `OpenAIEmbeddingProvider`
**API route:** `POST /api/v1/agents/:id/chat` → `{ reply, model, tokensUsed, chunksUsed }`

### ✅ Agent Builder (spec IMPLEMENTED)
**Entities:** `Agent`, `AgentPromptVersion`
**Enums:** `AgentType`, `AgentStatus`, `PromptVersionStatus`
**Use-cases:**
- `CreateAgent` — cria agente em DRAFT + prompt v1 em DRAFT
- `PublishAgentPrompt` — publica nova versão, supersede anterior, move agente para ACTIVE
- `GetAgent` — retorna agente com prompt ativo (inclui systemPrompt)
- `ListAgents` — lista agentes sem systemPrompt (confidencial)
- `UpdateAgentStatus` — arquiva ou ativa agente
**API routes:**
- `POST /api/v1/agents`
- `GET /api/v1/agents`
- `GET /api/v1/agents/:id`
- `PATCH /api/v1/agents/:id/prompt`
- `PATCH /api/v1/agents/:id/status`

### ✅ Prisma Schema
Modelos implementados: `Tenant`, `TenantSettings`, `User`, `RefreshToken`, `ApiKey`, `Agent`, `AgentPromptVersion`, `AuditLog`, `Department`, `Crew`, `CrewMember`

> Migration aplicada. Todos os modelos ativos no banco.

### ✅ Organization Layer — Department (spec IMPLEMENTED)
**Entities:** `Department`
**Enums:** `DepartmentStatus`
**Use-cases:** `CreateDepartment`, `ListDepartments`, `GetDepartment`, `UpdateDepartment`, `DeleteDepartment`
**Infra:** `InMemoryDepartmentRepository`, `PrismaDepartmentRepository`
**API routes:**
- `POST /api/v1/departments` → cria department (201)
- `GET /api/v1/departments` → lista departments do tenant
- `GET /api/v1/departments/:id` → detalhe (404 se outro tenant)
- `PATCH /api/v1/departments/:id` → atualiza name/description/status
- `DELETE /api/v1/departments/:id` → hard-delete
**Dashboard:**
- `/dashboard/departments` — grid de cards com status accent, empty state, skeleton loading
- `/dashboard/departments/new` — formulário com preview de slug em tempo real

### ✅ Crew Builder — Fase 1.2 (spec IMPLEMENTED)
**Entities:** `Crew`, `CrewMember`
**Enums:** `CrewStatus`, `CrewMemberRole`
**Use-cases:** `CreateCrew`, `ListCrews`, `GetCrew`, `UpdateCrew`, `DeleteCrew`,
               `AddAgentToCrew`, `RemoveAgentFromCrew`, `ListCrewMembers`
**Infra:** `InMemoryCrewRepository`, `InMemoryCrewMemberRepository`,
           `PrismaCrewRepository`, `PrismaCrewMemberRepository`
**API routes:**
- `POST   /api/v1/crews` → cria crew em status DRAFT (201)
- `GET    /api/v1/crews?departmentId=X` → lista crews do tenant
- `GET    /api/v1/crews/:id` → detalhe com members incluídos
- `PATCH  /api/v1/crews/:id` → atualiza name/description/objective/status
- `DELETE /api/v1/crews/:id` → hard-delete (falha se tiver membros)
- `POST   /api/v1/crews/:id/members` → adiciona agent (role: DIRECTOR|MEMBER|OBSERVER)
- `GET    /api/v1/crews/:id/members` → lista membros ordenados por order
- `DELETE /api/v1/crews/:id/members/:memberId` → remove membro
**Regras:** máx 1 DIRECTOR por crew · agent multi-crew permitido · isolamento multi-tenant completo

---

## 11. O que está pendente (Fase 1)

| Módulo | Próximos passos |
|---|---|
| **RLS no PostgreSQL** | Habilitar Row-Level Security nas tabelas com `tenantId` (Fase 2) |

---

## 12. Fases futuras

| Fase | O que entra |
|---|---|
| **✅ Fase 1.2** | Crew Builder — IMPLEMENTADO |
| **✅ Fase 1.3** | UI Redesign Gradient Shell — IMPLEMENTADO |
| **Fase 1.4** | Crew Chat básico (routing para director/agente principal) |
| **Fase 1.5** | Workflow e Handoff entre agentes |
| **Fase 1.6** | Métricas de Crew |
| **Fase 2** | KDL, Industry KB, Master Agents por nicho, Billing |
| **Fase 3** | WhatsApp, E-mail, CRM, LangGraph |
| **Fase 4** | Qdrant, fine-tuning, Mobile SDK |

---

## 13. Como trabalhar neste projeto

### Antes de qualquer código
1. Existe spec aprovada em `/docs/specs/<domínio>/<feature>.md`?
2. Existem testes em `/tests/unit/` e `/tests/integration/`?
3. Se não → crie spec → aguarde aprovação → crie testes → implemente

### Estrutura de um use-case
```typescript
export class NomeDoUseCase {
  constructor(
    private repo: INomeRepository,
    private auditLogger: IAuditLogger,
  ) {}

  async execute(input: Input): Promise<Output> {
    // 1. Validações e permissões
    // 2. Regras de negócio
    // 3. Persistência via repository
    // 4. Audit log
    // 5. Return
  }
}
```

### Estrutura de uma API route (Next.js 16)
```typescript
// params é Promise no Next.js 16+
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [session, { id }] = await Promise.all([getSession(request), params])
    // lógica...
  } catch (error) {
    return errorResponse(error)
  }
}
```

### Erros de domínio
```typescript
throw new AppError('CODE_EM_UPPER_SNAKE', 'Mensagem para o cliente')
```
O `errorResponse()` mapeia codes para HTTP status automaticamente.

### Rodar testes
```bash
npm run test           # todos
npm run test:unit      # apenas unitários
npm run test:integration # apenas integração
```

### Atualizar Prisma após mudar schema
```bash
npx prisma generate              # gera o client TypeScript
npx prisma migrate dev --name X  # cria migration (requer DB)
```

---

## 14. Arquivos de referência

| Arquivo | Conteúdo |
|---|---|
| `.agent/rules/global.md` | Regras invioláveis para agentes de IA |
| `.agent/rules/architecture.md` | Estrutura de pastas e dependências |
| `.agent/rules/sdd.md` | Fluxo SDD completo |
| `.agent/rules/tdd.md` | Fluxo TDD com convenções |
| `.agent/rules/lgpd.md` | Regras de privacidade |
| `.agent/rules/naming.md` | Convenções de nomenclatura |
| `.agent/rules/security.md` | Segurança e audit log |
| `docs/adr/001-decisoes-tecnicas-iniciais.md` | Todas as decisões técnicas |
| `docs/adr/002-tenant-resolution-strategy.md` | Estratégia de resolução de tenant |
| `docs/specs/_template.md` | Template SDD com 13 seções |
| `prisma/schema.prisma` | Schema do banco de dados |
| `src/infrastructure/di/index.ts` | Container de dependências |
| `.env.example` | Variáveis de ambiente necessárias |
| `src/app/globals.css` | Tokens CSS do design system Gradient Shell |
| `src/components/ui/empty-state.tsx` | Componente EmptyState reutilizável |
| `src/components/ui/theme-toggle.tsx` | Toggle claro/escuro com localStorage |
| `src/components/onboarding/OnboardingWizard.tsx` | Wizard de onboarding 3 passos |
| `docs/superpowers/specs/2026-06-04-ui-redesign-gradient-shell.md` | Spec do redesign visual |
| `docs/superpowers/plans/2026-06-04-ui-redesign-gradient-shell.md` | Plano de implementação do redesign |
