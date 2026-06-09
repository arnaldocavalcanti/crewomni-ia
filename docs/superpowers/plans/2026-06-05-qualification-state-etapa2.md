# QualificationState — Etapa 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist QualificationState in Postgres (survives server restarts) and run field extraction in parallel with RAG to cut ~300ms off every SDR message.

**Architecture:** Add `qualification_states` table to Prisma schema with a manual SQL migration. `PrismaQualificationStateRepository` follows the existing Prisma-repo patterns. In `SendMessage`, `ExtractAndUpdateState` and `BuildRAGContext.execute` are launched with `Promise.allSettled` — extraction updates state for the NEXT message while RAG runs simultaneously using the pre-extraction state (semantically correct: the agent already has the user's current message in context). Helper functions `mergeQualificationFields` / `emptyQualificationFields` are extracted to the entity file and shared by both repos.

**Tech Stack:** Prisma ORM, PostgreSQL JSONB, `Promise.allSettled` for parallel execution.

---

## File Map

### New files
- `prisma/migrations/20260605190000_add_qualification_states/migration.sql`
- `src/infrastructure/db/repositories/PrismaQualificationStateRepository.ts`

### Modified files
- `src/domains/qualification/entities/QualificationState.ts` — export `mergeQualificationFields` + `emptyQualificationFields`
- `src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts` — import shared helpers
- `prisma/schema.prisma` — add `QualificationState` model
- `src/infrastructure/di/index.ts` — switch to Prisma repo when `DATABASE_URL` set
- `src/domains/conversation/use-cases/SendMessage.ts` — parallel execution
- `tests/unit/domains/conversation/SendMessage.test.ts` — new assertions for parallel behavior

---

## Task 1: Extract shared helpers to entity file

**Files:**
- Modify: `src/domains/qualification/entities/QualificationState.ts`
- Modify: `src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts`

- [ ] **Step 1.1: Add exported helpers to entity file**

Append to the bottom of `src/domains/qualification/entities/QualificationState.ts`:

```typescript
export function emptyQualificationFields(): QualificationFields {
  return {
    tipo_empresa: null,
    numero_colaboradores: null,
    usa_crm: null,
    nome_contato: null,
    telefone: null,
    email: null,
    nivel_interesse: null,
    objecao: null,
  }
}

export function mergeQualificationFields(
  current: QualificationFields,
  updates: Partial<QualificationFields>,
): QualificationFields {
  const result = { ...current }
  for (const key of Object.keys(updates) as (keyof QualificationFields)[]) {
    const val = updates[key]
    if (val !== null && val !== undefined && val !== '') {
      result[key] = val
    }
  }
  return result
}
```

- [ ] **Step 1.2: Update InMemoryQualificationStateRepository to use shared helpers**

In `src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts`, replace the import line and delete the local `emptyFields` / `mergeFields` functions:

Change import:
```typescript
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'
```
to:
```typescript
import {
  ConversationStage,
  emptyQualificationFields,
  mergeQualificationFields,
} from '@/domains/qualification/entities/QualificationState'
```

Delete the two local functions `emptyFields()` and `mergeFields()`.

Replace their usages:
- `emptyFields()` → `emptyQualificationFields()`
- `mergeFields(state.fields, data.fields)` → `mergeQualificationFields(state.fields, data.fields)`

- [ ] **Step 1.3: Run existing tests to verify no regressions**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/qualification/ 2>&1 | tail -8
```

Expected: 13 tests pass.

- [ ] **Step 1.4: Commit**

```bash
git add src/domains/qualification/entities/QualificationState.ts src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts
git commit -m "refactor(qualification): extract mergeQualificationFields/emptyQualificationFields to entity file"
```

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260605190000_add_qualification_states/migration.sql`

- [ ] **Step 2.1: Add QualificationState model to schema.prisma**

Append before the `// ─── Audit ─────` section in `prisma/schema.prisma`:

```prisma
// ─── Qualification ────────────────────────────────────────────────────────────

model QualificationState {
  id             String   @id @default(uuid())
  conversationId String   @unique
  tenantId       String
  agentId        String
  stage          String   @default("QUALIFYING")
  lastIntent     String?
  fields         Json     @default("{}")
  updatedAt      DateTime @updatedAt

  @@index([tenantId])
  @@map("qualification_states")
}
```

Note: `conversationId` is `@unique` (one state per conversation). No explicit Prisma `@relation` to `Conversation` — the FK is enforced at DB level in the migration SQL, keeping the Conversation model unchanged.

- [ ] **Step 2.2: Create migration directory and SQL file**

```bash
mkdir -p /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/prisma/migrations/20260605190000_add_qualification_states
```

Create `prisma/migrations/20260605190000_add_qualification_states/migration.sql`:

```sql
-- CreateTable: qualification_states
CREATE TABLE "qualification_states" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "agentId"        TEXT NOT NULL,
    "stage"          TEXT NOT NULL DEFAULT 'QUALIFYING',
    "lastIntent"     TEXT,
    "fields"         JSONB NOT NULL DEFAULT '{}',
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_states_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "qualification_states_conversationId_key" ON "qualification_states"("conversationId");

-- CreateIndex
CREATE INDEX "qualification_states_tenantId_idx" ON "qualification_states"("tenantId");

-- AddForeignKey (cascades when conversation is deleted)
ALTER TABLE "qualification_states"
  ADD CONSTRAINT "qualification_states_conversationId_fkey"
  FOREIGN KEY ("conversationId")
  REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 2.3: Verify TypeScript still compiles**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 2.4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260605190000_add_qualification_states/migration.sql
git commit -m "feat(qualification): add qualification_states table to Prisma schema + migration"
```

---

## Task 3: PrismaQualificationStateRepository

**Files:**
- Create: `src/infrastructure/db/repositories/PrismaQualificationStateRepository.ts`

No separate unit test — Prisma repos in this codebase are covered by integration tests; the interface contract is already verified by the InMemory repo tests.

- [ ] **Step 3.1: Implement the Prisma repository**

```typescript
// src/infrastructure/db/repositories/PrismaQualificationStateRepository.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { getPrismaClient } from '@/infrastructure/db/prisma/client'
import { AppError } from '@/shared/errors/AppError'
import type {
  QualificationState,
  QualificationFields,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '@/domains/qualification/entities/QualificationState'
import {
  ConversationStage,
  LeadIntent,
  emptyQualificationFields,
  mergeQualificationFields,
} from '@/domains/qualification/entities/QualificationState'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'

export class PrismaQualificationStateRepository implements IQualificationStateRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return getPrismaClient() }

  async findByConversation(
    conversationId: string,
    tenantId: string,
  ): Promise<QualificationState | null> {
    const r = await this.db.qualificationState.findFirst({
      where: { conversationId, tenantId },
    })
    return r ? this.toEntity(r) : null
  }

  async create(data: CreateQualificationStateData): Promise<QualificationState> {
    const r = await this.db.qualificationState.create({
      data: {
        conversationId: data.conversationId,
        tenantId: data.tenantId,
        agentId: data.agentId,
        stage: ConversationStage.QUALIFYING,
        lastIntent: null,
        fields: emptyQualificationFields(),
      },
    })
    return this.toEntity(r)
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateQualificationStateData,
  ): Promise<QualificationState> {
    const existing = await this.db.qualificationState.findFirst({ where: { id, tenantId } })
    if (!existing) {
      throw new AppError('QUALIFICATION_STATE_NOT_FOUND', 'Estado de qualificação não encontrado.')
    }
    const currentFields = existing.fields as QualificationFields
    const mergedFields = data.fields ? mergeQualificationFields(currentFields, data.fields) : currentFields

    const r = await this.db.qualificationState.update({
      where: { id },
      data: {
        ...(data.stage !== undefined ? { stage: data.stage } : {}),
        ...(data.lastIntent !== undefined ? { lastIntent: data.lastIntent ?? null } : {}),
        fields: mergedFields,
      },
    })
    return this.toEntity(r)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEntity(r: any): QualificationState {
    return {
      id: r.id,
      conversationId: r.conversationId,
      tenantId: r.tenantId,
      agentId: r.agentId,
      stage: r.stage as ConversationStage,
      lastIntent: r.lastIntent as LeadIntent | null,
      fields: r.fields as QualificationFields,
      updatedAt: r.updatedAt,
    }
  }
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/infrastructure/db/repositories/PrismaQualificationStateRepository.ts
git commit -m "feat(qualification): add PrismaQualificationStateRepository"
```

---

## Task 4: Wire DI + parallel execution in SendMessage

**Files:**
- Modify: `src/infrastructure/di/index.ts`
- Modify: `src/domains/conversation/use-cases/SendMessage.ts`
- Modify: `tests/unit/domains/conversation/SendMessage.test.ts`

- [ ] **Step 4.1: Update DI to use Prisma repo when DATABASE_URL is set**

In `src/infrastructure/di/index.ts`, add import:

```typescript
import { PrismaQualificationStateRepository } from '@/infrastructure/db/repositories/PrismaQualificationStateRepository'
```

Change the `qualStateRepo` line from:
```typescript
const qualStateRepo  = new InMemoryQualificationStateRepository()
```
to:
```typescript
const qualStateRepo = usePrisma
  ? new PrismaQualificationStateRepository()
  : new InMemoryQualificationStateRepository()
```

- [ ] **Step 4.2: Write new tests for parallel execution before changing SendMessage**

Add to the `// ── QualificationState ───────────────────────────────────────────────────` section in `tests/unit/domains/conversation/SendMessage.test.ts`:

```typescript
  it('deve executar extração e RAG em paralelo (ambos chamados sem aguardar um pelo outro)', async () => {
    const order: string[] = []
    let resolveExtract!: (v: ReturnType<typeof makeQualState>) => void
    let resolveRAG!: (v: { reply: string; model: string; tokensUsed: number; chunksUsed: never[] }) => void

    vi.mocked(extractState.execute).mockImplementation(() => new Promise((res) => {
      order.push('extract-started')
      resolveExtract = res
    }))
    vi.mocked(ragContext.execute).mockImplementation(() => new Promise((res) => {
      order.push('rag-started')
      resolveRAG = res
    }))

    const promise = useCase.execute(makeInput({ conversationId: 'conv-1' }))

    // Both should have started before either resolves
    await new Promise(resolve => setImmediate(resolve))
    expect(order).toContain('extract-started')
    expect(order).toContain('rag-started')

    resolveExtract(makeQualState())
    resolveRAG({ reply: 'ok', model: 'gpt-4o', tokensUsed: 10, chunksUsed: [] })
    await promise
  })

  it('deve continuar mesmo se a extração falhar (RAG ainda retorna resposta)', async () => {
    vi.mocked(extractState.execute).mockRejectedValue(new Error('extraction failed'))

    const result = await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(result.reply).toBe('Resposta do agente.')
    expect(result.model).toBe('gpt-4o-mini')
  })
```

- [ ] **Step 4.3: Run tests to confirm new tests fail**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/conversation/SendMessage.test.ts 2>&1 | tail -10
```

Expected: FAIL on the "paralelo" test (extraction and RAG currently run sequentially).

- [ ] **Step 4.4: Update SendMessage for parallel execution**

In `src/domains/conversation/use-cases/SendMessage.ts`, replace steps 5-7:

```typescript
    // 5. Load or create qualification state
    let qualState = await this.qualStateRepo.findByConversation(conversationId, input.tenantId)
    if (!qualState) {
      qualState = await this.qualStateRepo.create({
        conversationId,
        tenantId: input.tenantId,
        agentId: input.agentId,
      })
    }

    // 6. Run extraction and RAG in parallel
    // Extraction updates state for the NEXT message; RAG uses pre-extraction state.
    let reply = ''
    let model = 'unknown'
    let tokensUsed = 0
    let chunksUsed: { layer: string; count: number; totalScore: number }[] = []
    let failed = false

    const [extractResult, ragResult] = await Promise.allSettled([
      this.extractState.execute({ state: qualState, message: input.message.trim() }),
      this.ragContext.execute({
        tenantId: input.tenantId,
        agentId: input.agentId,
        message: input.message.trim(),
        conversationHistory,
        qualificationState: qualState,
      }),
    ])

    if (extractResult.status === 'fulfilled') {
      qualState = extractResult.value
    }

    if (ragResult.status === 'fulfilled') {
      reply = ragResult.value.reply
      model = ragResult.value.model
      tokensUsed = ragResult.value.tokensUsed
      chunksUsed = ragResult.value.chunksUsed
    } else {
      failed = true
      reply = 'Desculpe, ocorreu um erro ao processar sua mensagem.'
    }
```

Also remove the `try/catch` blocks that surrounded the sequential calls in the old steps 6 and 7.

- [ ] **Step 4.5: Run full test suite**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run 2>&1 | tail -10
```

Expected: 247+ tests, all pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/infrastructure/di/index.ts src/domains/conversation/use-cases/SendMessage.ts tests/unit/domains/conversation/SendMessage.test.ts
git commit -m "feat(qualification): parallel extraction + RAG, Prisma repo in DI"
```

---

## Task 5: Final verification + CONTEXT.md

- [ ] **Step 5.1: Full test suite + type check**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | head -5
```

Expected: all tests pass, no TypeScript errors.

- [ ] **Step 5.2: Update CONTEXT.md**

In `CONTEXT.md`, update the QualificationState section to include Etapa 2 deliverables:
- `PrismaQualificationStateRepository` — Postgres persistence via JSONB fields column
- Migration `20260605190000_add_qualification_states`
- `SendMessage` — extraction + RAG run in parallel via `Promise.allSettled`

- [ ] **Step 5.3: Final commit**

```bash
git add CONTEXT.md
git commit -m "docs: update CONTEXT.md with QualificationState Etapa 2"
```
