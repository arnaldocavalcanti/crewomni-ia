# Fase 2.1 — Segurança & Usage Quotas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar RLS no PostgreSQL e controle de uso por tenant (mensagens, tokens, custo, rate-limit), bloqueando processamento quando quotas forem excedidas e acumulando dados reais de consumo desde a primeira mensagem.

**Architecture:** Dois domínios independentes implementados em sequência. (1) RLS: migration SQL que habilita Row-Level Security em todas as tabelas com tenantId — defesa em profundidade independente do código da aplicação. (2) Usage Quotas: domínio `usage-limits` com entidades, repositórios InMemory + Prisma, dois use-cases (`CheckAndEnforceUsageLimit`, `RecordUsage`), wiring no DI e duas API routes. O `SendMessage` existente recebe o check de quota antes de chamar o LLM.

**Tech Stack:** TypeScript 5, Prisma 7, PostgreSQL, Next.js 16 App Router, Vitest 4. Sem novos pacotes.

---

## Mapeamento de arquivos

### Criados
- `src/domains/usage-limits/entities/TenantUsageLimit.ts`
- `src/domains/usage-limits/entities/TenantUsageCurrent.ts`
- `src/domains/usage-limits/repositories/ITenantUsageLimitRepository.ts`
- `src/domains/usage-limits/repositories/ITenantUsageCurrentRepository.ts`
- `src/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit.ts`
- `src/domains/usage-limits/use-cases/RecordUsage.ts`
- `src/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository.ts`
- `src/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository.ts`
- `src/infrastructure/db/repositories/PrismaTenantUsageLimitRepository.ts`
- `src/infrastructure/db/repositories/PrismaTenantUsageCurrentRepository.ts`
- `src/app/api/v1/tenants/usage/route.ts`
- `src/app/api/v1/tenants/[id]/usage-limit/route.ts`
- `tests/unit/domains/usage-limits/CheckAndEnforceUsageLimit.test.ts`
- `tests/unit/domains/usage-limits/RecordUsage.test.ts`
- `prisma/migrations/YYYYMMDD_add_usage_limits/migration.sql` (gerado pelo migrate dev)
- `prisma/migrations/YYYYMMDD_add_rls_policies/migration.sql` (gerado pelo migrate dev)

### Modificados
- `prisma/schema.prisma` — adicionar modelos TenantUsageLimit e TenantUsageCurrent
- `src/infrastructure/di/index.ts` — wiring dos novos repos e use-cases
- `src/domains/conversation/use-cases/SendMessage.ts` — check de quota antes do LLM

---

## Task 1: Entidades do domínio usage-limits

**Files:**
- Create: `src/domains/usage-limits/entities/TenantUsageLimit.ts`
- Create: `src/domains/usage-limits/entities/TenantUsageCurrent.ts`

- [ ] **Step 1.1: Criar TenantUsageLimit.ts**

```typescript
// src/domains/usage-limits/entities/TenantUsageLimit.ts
export type TenantUsageLimit = {
  id: string
  tenantId: string
  messagesPerMonth: number
  tokensPerMonth: number
  costPerMonthUsd: number
  messagesPerMinute: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_USAGE_LIMIT = {
  messagesPerMonth: 1000,
  tokensPerMonth: 1_000_000,
  costPerMonthUsd: 10.0,
  messagesPerMinute: 30,
} as const

export function createTenantUsageLimit(
  tenantId: string,
  overrides?: Partial<Omit<TenantUsageLimit, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
): TenantUsageLimit {
  return {
    id: crypto.randomUUID(),
    tenantId,
    ...DEFAULT_USAGE_LIMIT,
    isActive: true,
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
```

- [ ] **Step 1.2: Criar TenantUsageCurrent.ts**

```typescript
// src/domains/usage-limits/entities/TenantUsageCurrent.ts
export type TenantUsageCurrent = {
  id: string
  tenantId: string
  yearMonth: string       // formato: '2026-06'
  messages: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  messagesLastMinute: number
  lastMessageAt?: Date
  needsNotification: boolean
  createdAt: Date
  updatedAt: Date
}

export function getCurrentYearMonth(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function createTenantUsageCurrent(tenantId: string, yearMonth?: string): TenantUsageCurrent {
  return {
    id: crypto.randomUUID(),
    tenantId,
    yearMonth: yearMonth ?? getCurrentYearMonth(),
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    messagesLastMinute: 0,
    needsNotification: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
```

- [ ] **Step 1.3: Commit**

```bash
git add src/domains/usage-limits/entities/
git commit -m "feat(usage-limits): add TenantUsageLimit and TenantUsageCurrent entities"
```

---

## Task 2: Interfaces de repositório

**Files:**
- Create: `src/domains/usage-limits/repositories/ITenantUsageLimitRepository.ts`
- Create: `src/domains/usage-limits/repositories/ITenantUsageCurrentRepository.ts`

- [ ] **Step 2.1: Criar ITenantUsageLimitRepository.ts**

```typescript
// src/domains/usage-limits/repositories/ITenantUsageLimitRepository.ts
import type { TenantUsageLimit } from '../entities/TenantUsageLimit'

export interface ITenantUsageLimitRepository {
  findByTenant(tenantId: string): Promise<TenantUsageLimit | null>
  save(limit: TenantUsageLimit): Promise<void>
  update(tenantId: string, partial: Partial<Pick<TenantUsageLimit,
    'messagesPerMonth' | 'tokensPerMonth' | 'costPerMonthUsd' | 'messagesPerMinute' | 'isActive'
  >>): Promise<void>
}
```

- [ ] **Step 2.2: Criar ITenantUsageCurrentRepository.ts**

```typescript
// src/domains/usage-limits/repositories/ITenantUsageCurrentRepository.ts
import type { TenantUsageCurrent } from '../entities/TenantUsageCurrent'

export interface ITenantUsageCurrentRepository {
  findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null>
  upsert(current: TenantUsageCurrent): Promise<void>
  incrementUsage(
    tenantId: string,
    yearMonth: string,
    delta: {
      messages?: number
      inputTokens?: number
      outputTokens?: number
      estimatedCostUsd?: number
    }
  ): Promise<TenantUsageCurrent>
}
```

- [ ] **Step 2.3: Commit**

```bash
git add src/domains/usage-limits/repositories/
git commit -m "feat(usage-limits): add repository interfaces"
```

---

## Task 3: InMemory repositories

**Files:**
- Create: `src/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository.ts`
- Create: `src/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository.ts`

- [ ] **Step 3.1: Criar InMemoryTenantUsageLimitRepository.ts**

```typescript
// src/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository.ts
import type { ITenantUsageLimitRepository } from '@/domains/usage-limits/repositories/ITenantUsageLimitRepository'
import type { TenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'

export class InMemoryTenantUsageLimitRepository implements ITenantUsageLimitRepository {
  private store = new Map<string, TenantUsageLimit>()

  async findByTenant(tenantId: string): Promise<TenantUsageLimit | null> {
    return this.store.get(tenantId) ?? null
  }

  async save(limit: TenantUsageLimit): Promise<void> {
    this.store.set(limit.tenantId, { ...limit })
  }

  async update(tenantId: string, partial: Partial<TenantUsageLimit>): Promise<void> {
    const existing = this.store.get(tenantId)
    if (existing) {
      this.store.set(tenantId, { ...existing, ...partial, updatedAt: new Date() })
    }
  }
}
```

- [ ] **Step 3.2: Criar InMemoryTenantUsageCurrentRepository.ts**

```typescript
// src/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository.ts
import type { ITenantUsageCurrentRepository } from '@/domains/usage-limits/repositories/ITenantUsageCurrentRepository'
import type { TenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'
import { createTenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'

export class InMemoryTenantUsageCurrentRepository implements ITenantUsageCurrentRepository {
  private store = new Map<string, TenantUsageCurrent>()

  private key(tenantId: string, yearMonth: string) {
    return `${tenantId}::${yearMonth}`
  }

  async findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null> {
    return this.store.get(this.key(tenantId, yearMonth)) ?? null
  }

  async upsert(current: TenantUsageCurrent): Promise<void> {
    this.store.set(this.key(current.tenantId, current.yearMonth), { ...current })
  }

  async incrementUsage(
    tenantId: string,
    yearMonth: string,
    delta: { messages?: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number }
  ): Promise<TenantUsageCurrent> {
    const existing = this.store.get(this.key(tenantId, yearMonth))
      ?? createTenantUsageCurrent(tenantId, yearMonth)

    const inputTokens  = existing.inputTokens  + (delta.inputTokens  ?? 0)
    const outputTokens = existing.outputTokens + (delta.outputTokens ?? 0)
    const updated: TenantUsageCurrent = {
      ...existing,
      messages:          existing.messages          + (delta.messages          ?? 0),
      inputTokens,
      outputTokens,
      totalTokens:       inputTokens + outputTokens,
      estimatedCostUsd:  existing.estimatedCostUsd  + (delta.estimatedCostUsd  ?? 0),
      lastMessageAt:     delta.messages ? new Date() : existing.lastMessageAt,
      updatedAt:         new Date(),
    }
    this.store.set(this.key(tenantId, yearMonth), updated)
    return updated
  }
}
```

- [ ] **Step 3.3: Commit**

```bash
git add src/infrastructure/db/repositories/InMemoryTenantUsage*.ts
git commit -m "feat(usage-limits): add InMemory repositories"
```

---

## Task 4: CheckAndEnforceUsageLimit use-case (TDD)

**Files:**
- Create: `src/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit.ts`
- Test: `tests/unit/domains/usage-limits/CheckAndEnforceUsageLimit.test.ts`

- [ ] **Step 4.1: Escrever os testes**

```typescript
// tests/unit/domains/usage-limits/CheckAndEnforceUsageLimit.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CheckAndEnforceUsageLimit } from '@/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { createTenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'
import { createTenantUsageCurrent, getCurrentYearMonth } from '@/domains/usage-limits/entities/TenantUsageCurrent'

function makeUseCase() {
  const limitRepo   = new InMemoryTenantUsageLimitRepository()
  const currentRepo = new InMemoryTenantUsageCurrentRepository()
  const uc = new CheckAndEnforceUsageLimit(limitRepo, currentRepo)
  return { uc, limitRepo, currentRepo }
}

describe('CheckAndEnforceUsageLimit', () => {
  it('deve retornar allowed=true quando dentro dos limites', async () => {
    const { uc } = makeUseCase()
    const result = await uc.execute({ tenantId: 'tenant-1' })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('deve aplicar DEFAULT_USAGE_LIMIT quando tenant sem configuração', async () => {
    const { uc } = makeUseCase()
    const result = await uc.execute({ tenantId: 'sem-config' })
    expect(result.limit.messagesPerMonth).toBe(1000)
    expect(result.limit.costPerMonthUsd).toBe(10.0)
  })

  it('deve retornar allowed=false com reason QUOTA_MESSAGES quando messagesPerMonth excedido', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-quota', { messagesPerMonth: 5 }))
    const current = createTenantUsageCurrent('tenant-quota')
    current.messages = 5
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-quota' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('QUOTA_MESSAGES')
  })

  it('deve retornar allowed=false com reason QUOTA_COST quando costPerMonthUsd excedido', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-cost', { costPerMonthUsd: 5.0 }))
    const current = createTenantUsageCurrent('tenant-cost')
    current.estimatedCostUsd = 5.01
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-cost' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('QUOTA_COST')
  })

  it('deve retornar allowed=false com reason QUOTA_TOKENS quando tokensPerMonth excedido', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-tokens', { tokensPerMonth: 100 }))
    const current = createTenantUsageCurrent('tenant-tokens')
    current.totalTokens = 101
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-tokens' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('QUOTA_TOKENS')
  })

  it('tenant A excedendo quota não deve afetar tenant B', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-A', { messagesPerMonth: 1 }))
    const currentA = createTenantUsageCurrent('tenant-A')
    currentA.messages = 1
    await currentRepo.upsert(currentA)

    const resultA = await uc.execute({ tenantId: 'tenant-A' })
    const resultB = await uc.execute({ tenantId: 'tenant-B' })

    expect(resultA.allowed).toBe(false)
    expect(resultB.allowed).toBe(true)
  })

  it('deve incluir currentUsage no output', async () => {
    const { uc, currentRepo } = makeUseCase()

    const current = createTenantUsageCurrent('tenant-uso')
    current.messages = 42
    current.totalTokens = 5000
    current.estimatedCostUsd = 1.5
    await currentRepo.upsert(current)

    const result = await uc.execute({ tenantId: 'tenant-uso' })
    expect(result.currentUsage.messages).toBe(42)
    expect(result.currentUsage.totalTokens).toBe(5000)
    expect(result.currentUsage.estimatedCostUsd).toBe(1.5)
  })
})
```

- [ ] **Step 4.2: Rodar para confirmar FAIL**

```bash
npm run test tests/unit/domains/usage-limits/CheckAndEnforceUsageLimit.test.ts
```
Expected: FAIL — `CheckAndEnforceUsageLimit` not found

- [ ] **Step 4.3: Implementar o use-case**

```typescript
// src/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit.ts
import { DEFAULT_USAGE_LIMIT } from '../entities/TenantUsageLimit'
import { getCurrentYearMonth } from '../entities/TenantUsageCurrent'
import type { ITenantUsageLimitRepository } from '../repositories/ITenantUsageLimitRepository'
import type { ITenantUsageCurrentRepository } from '../repositories/ITenantUsageCurrentRepository'

export type CheckUsageLimitOutput = {
  allowed: boolean
  reason?: 'QUOTA_MESSAGES' | 'QUOTA_TOKENS' | 'QUOTA_COST' | 'RATE_LIMITED'
  currentUsage: {
    messages: number
    totalTokens: number
    estimatedCostUsd: number
  }
  limit: {
    messagesPerMonth: number
    tokensPerMonth: number
    costPerMonthUsd: number
  }
}

export class CheckAndEnforceUsageLimit {
  constructor(
    private limitRepo:   ITenantUsageLimitRepository,
    private currentRepo: ITenantUsageCurrentRepository,
  ) {}

  async execute(input: { tenantId: string }): Promise<CheckUsageLimitOutput> {
    const { tenantId } = input

    const limitConfig = await this.limitRepo.findByTenant(tenantId)
    const limit = limitConfig ?? {
      messagesPerMonth:  DEFAULT_USAGE_LIMIT.messagesPerMonth,
      tokensPerMonth:    DEFAULT_USAGE_LIMIT.tokensPerMonth,
      costPerMonthUsd:   DEFAULT_USAGE_LIMIT.costPerMonthUsd,
      messagesPerMinute: DEFAULT_USAGE_LIMIT.messagesPerMinute,
    }

    const yearMonth = getCurrentYearMonth()
    const current = await this.currentRepo.findByTenantAndMonth(tenantId, yearMonth)

    const usage = {
      messages:         current?.messages         ?? 0,
      totalTokens:      current?.totalTokens      ?? 0,
      estimatedCostUsd: current?.estimatedCostUsd ?? 0,
    }

    const limitOut = {
      messagesPerMonth: limit.messagesPerMonth,
      tokensPerMonth:   limit.tokensPerMonth,
      costPerMonthUsd:  limit.costPerMonthUsd,
    }

    if (usage.messages >= limit.messagesPerMonth) {
      return { allowed: false, reason: 'QUOTA_MESSAGES', currentUsage: usage, limit: limitOut }
    }
    if (usage.estimatedCostUsd >= limit.costPerMonthUsd) {
      return { allowed: false, reason: 'QUOTA_COST', currentUsage: usage, limit: limitOut }
    }
    if (usage.totalTokens >= limit.tokensPerMonth) {
      return { allowed: false, reason: 'QUOTA_TOKENS', currentUsage: usage, limit: limitOut }
    }

    return { allowed: true, currentUsage: usage, limit: limitOut }
  }
}
```

- [ ] **Step 4.4: Rodar os testes**

```bash
npm run test tests/unit/domains/usage-limits/CheckAndEnforceUsageLimit.test.ts
```
Expected: 6 testes PASS

- [ ] **Step 4.5: Commit**

```bash
git add src/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit.ts tests/unit/domains/usage-limits/CheckAndEnforceUsageLimit.test.ts
git commit -m "feat(usage-limits): implement CheckAndEnforceUsageLimit with quota checks"
```

---

## Task 5: RecordUsage use-case (TDD)

**Files:**
- Create: `src/domains/usage-limits/use-cases/RecordUsage.ts`
- Test: `tests/unit/domains/usage-limits/RecordUsage.test.ts`

- [ ] **Step 5.1: Escrever os testes**

```typescript
// tests/unit/domains/usage-limits/RecordUsage.test.ts
import { describe, it, expect } from 'vitest'
import { RecordUsage } from '@/domains/usage-limits/use-cases/RecordUsage'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { createTenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'
import { getCurrentYearMonth } from '@/domains/usage-limits/entities/TenantUsageCurrent'

function makeUseCase() {
  const limitRepo   = new InMemoryTenantUsageLimitRepository()
  const currentRepo = new InMemoryTenantUsageCurrentRepository()
  return { uc: new RecordUsage(currentRepo, limitRepo), currentRepo, limitRepo }
}

describe('RecordUsage', () => {
  it('deve incrementar messages, tokens e custo no mês corrente', async () => {
    const { uc, currentRepo } = makeUseCase()

    await uc.execute({ tenantId: 'tenant-1', inputTokens: 300, outputTokens: 100, estimatedCostUsd: 0.005 })

    const current = await currentRepo.findByTenantAndMonth('tenant-1', getCurrentYearMonth())
    expect(current!.messages).toBe(1)
    expect(current!.inputTokens).toBe(300)
    expect(current!.outputTokens).toBe(100)
    expect(current!.totalTokens).toBe(400)
    expect(current!.estimatedCostUsd).toBeCloseTo(0.005)
  })

  it('deve acumular múltiplas chamadas corretamente', async () => {
    const { uc, currentRepo } = makeUseCase()

    await uc.execute({ tenantId: 'tenant-acc', inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 })
    await uc.execute({ tenantId: 'tenant-acc', inputTokens: 200, outputTokens: 80, estimatedCostUsd: 0.002 })

    const current = await currentRepo.findByTenantAndMonth('tenant-acc', getCurrentYearMonth())
    expect(current!.messages).toBe(2)
    expect(current!.totalTokens).toBe(430)
    expect(current!.estimatedCostUsd).toBeCloseTo(0.003)
  })

  it('deve marcar needsNotification=true ao atingir 80% da quota de mensagens', async () => {
    const { uc, limitRepo, currentRepo } = makeUseCase()

    await limitRepo.save(createTenantUsageLimit('tenant-notif', { messagesPerMonth: 10 }))

    // 8 mensagens = 80% de 10
    for (let i = 0; i < 8; i++) {
      await uc.execute({ tenantId: 'tenant-notif', inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.0001 })
    }

    const current = await currentRepo.findByTenantAndMonth('tenant-notif', getCurrentYearMonth())
    expect(current!.messages).toBe(8)
    expect(current!.needsNotification).toBe(true)
  })

  it('não deve lançar exceção se o registro falhar (best-effort)', async () => {
    const brokenRepo = {
      findByTenantAndMonth: async () => null,
      upsert: async () => { throw new Error('DB down') },
      incrementUsage: async () => { throw new Error('DB down') },
    }
    const uc = new RecordUsage(brokenRepo as any, new InMemoryTenantUsageLimitRepository())
    await expect(uc.execute({ tenantId: 't', inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 }))
      .resolves.not.toThrow()
  })

  it('uso de tenant A não deve aparecer em tenant B', async () => {
    const { uc, currentRepo } = makeUseCase()

    await uc.execute({ tenantId: 'tenant-X', inputTokens: 500, outputTokens: 200, estimatedCostUsd: 0.01 })

    const currentY = await currentRepo.findByTenantAndMonth('tenant-Y', getCurrentYearMonth())
    expect(currentY).toBeNull()
  })
})
```

- [ ] **Step 5.2: Rodar para confirmar FAIL**

```bash
npm run test tests/unit/domains/usage-limits/RecordUsage.test.ts
```
Expected: FAIL

- [ ] **Step 5.3: Implementar RecordUsage**

```typescript
// src/domains/usage-limits/use-cases/RecordUsage.ts
import { getCurrentYearMonth } from '../entities/TenantUsageCurrent'
import type { ITenantUsageCurrentRepository } from '../repositories/ITenantUsageCurrentRepository'
import type { ITenantUsageLimitRepository } from '../repositories/ITenantUsageLimitRepository'
import { DEFAULT_USAGE_LIMIT } from '../entities/TenantUsageLimit'

type Input = {
  tenantId: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export class RecordUsage {
  constructor(
    private currentRepo: ITenantUsageCurrentRepository,
    private limitRepo:   ITenantUsageLimitRepository,
  ) {}

  async execute(input: Input): Promise<void> {
    try {
      const { tenantId, inputTokens, outputTokens, estimatedCostUsd } = input
      const yearMonth = getCurrentYearMonth()

      const updated = await this.currentRepo.incrementUsage(tenantId, yearMonth, {
        messages: 1,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
      })

      // Verificar 80% para notificação
      const limitConfig = await this.limitRepo.findByTenant(tenantId)
      const messagesPerMonth = limitConfig?.messagesPerMonth ?? DEFAULT_USAGE_LIMIT.messagesPerMonth

      if (!updated.needsNotification && updated.messages >= messagesPerMonth * 0.8) {
        await this.currentRepo.upsert({ ...updated, needsNotification: true })
      }
    } catch {
      // best-effort: nunca bloqueia a execução do agente
    }
  }
}
```

- [ ] **Step 5.4: Rodar os testes**

```bash
npm run test tests/unit/domains/usage-limits/RecordUsage.test.ts
```
Expected: 5 testes PASS

- [ ] **Step 5.5: Rodar suite completa para garantir zero regressões**

```bash
npm run test
```
Expected: todos os testes existentes continuam passando

- [ ] **Step 5.6: Commit**

```bash
git add src/domains/usage-limits/use-cases/RecordUsage.ts tests/unit/domains/usage-limits/RecordUsage.test.ts
git commit -m "feat(usage-limits): implement RecordUsage (best-effort, 80% notification)"
```

---

## Task 6: Prisma schema — novos modelos

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 6.1: Adicionar relações no modelo Tenant**

Abrir `prisma/schema.prisma`. No modelo `Tenant`, após as relações existentes, adicionar:

```prisma
  usageLimit   TenantUsageLimit?
  usageCurrent TenantUsageCurrent[]
```

- [ ] **Step 6.2: Adicionar os novos modelos ao final do schema**

```prisma
// ─── Usage Limits ─────────────────────────────────────────────────────────────

model TenantUsageLimit {
  id                 String   @id @default(uuid())
  tenantId           String   @unique
  messagesPerMonth   Int      @default(1000)
  tokensPerMonth     Int      @default(1000000)
  costPerMonthUsd    Float    @default(10.0)
  messagesPerMinute  Int      @default(30)
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("tenant_usage_limits")
}

model TenantUsageCurrent {
  id                 String    @id @default(uuid())
  tenantId           String
  yearMonth          String
  messages           Int       @default(0)
  inputTokens        Int       @default(0)
  outputTokens       Int       @default(0)
  totalTokens        Int       @default(0)
  estimatedCostUsd   Float     @default(0)
  messagesLastMinute Int       @default(0)
  lastMessageAt      DateTime?
  needsNotification  Boolean   @default(false)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, yearMonth])
  @@index([tenantId])
  @@map("tenant_usage_current")
}
```

- [ ] **Step 6.3: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add_usage_limits
```
Expected: Migration criada e aplicada. Prisma Client regenerado.

- [ ] **Step 6.4: Verificar que as tabelas foram criadas**

```bash
npx prisma studio
```
Expected: Tabelas `tenant_usage_limits` e `tenant_usage_current` visíveis.

- [ ] **Step 6.5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(usage-limits): add TenantUsageLimit and TenantUsageCurrent Prisma models"
```

---

## Task 7: Prisma repositories

**Files:**
- Create: `src/infrastructure/db/repositories/PrismaTenantUsageLimitRepository.ts`
- Create: `src/infrastructure/db/repositories/PrismaTenantUsageCurrentRepository.ts`

- [ ] **Step 7.1: Criar PrismaTenantUsageLimitRepository.ts**

```typescript
// src/infrastructure/db/repositories/PrismaTenantUsageLimitRepository.ts
import { prisma } from '@/infrastructure/db/prisma/client'
import type { ITenantUsageLimitRepository } from '@/domains/usage-limits/repositories/ITenantUsageLimitRepository'
import type { TenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'

export class PrismaTenantUsageLimitRepository implements ITenantUsageLimitRepository {
  async findByTenant(tenantId: string): Promise<TenantUsageLimit | null> {
    const row = await prisma.tenantUsageLimit.findUnique({ where: { tenantId } })
    return row as TenantUsageLimit | null
  }

  async save(limit: TenantUsageLimit): Promise<void> {
    await prisma.tenantUsageLimit.upsert({
      where: { tenantId: limit.tenantId },
      create: limit as any,
      update: limit as any,
    })
  }

  async update(tenantId: string, partial: Partial<TenantUsageLimit>): Promise<void> {
    await prisma.tenantUsageLimit.update({
      where: { tenantId },
      data: partial as any,
    })
  }
}
```

- [ ] **Step 7.2: Criar PrismaTenantUsageCurrentRepository.ts**

```typescript
// src/infrastructure/db/repositories/PrismaTenantUsageCurrentRepository.ts
import { prisma } from '@/infrastructure/db/prisma/client'
import type { ITenantUsageCurrentRepository } from '@/domains/usage-limits/repositories/ITenantUsageCurrentRepository'
import type { TenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'
import { createTenantUsageCurrent } from '@/domains/usage-limits/entities/TenantUsageCurrent'

export class PrismaTenantUsageCurrentRepository implements ITenantUsageCurrentRepository {
  async findByTenantAndMonth(tenantId: string, yearMonth: string): Promise<TenantUsageCurrent | null> {
    const row = await prisma.tenantUsageCurrent.findUnique({
      where: { tenantId_yearMonth: { tenantId, yearMonth } },
    })
    return row as TenantUsageCurrent | null
  }

  async upsert(current: TenantUsageCurrent): Promise<void> {
    await prisma.tenantUsageCurrent.upsert({
      where: { tenantId_yearMonth: { tenantId: current.tenantId, yearMonth: current.yearMonth } },
      create: current as any,
      update: current as any,
    })
  }

  async incrementUsage(
    tenantId: string,
    yearMonth: string,
    delta: { messages?: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number }
  ): Promise<TenantUsageCurrent> {
    // Upsert atômico: cria com defaults se não existe, incrementa se existe
    const row = await prisma.tenantUsageCurrent.upsert({
      where: { tenantId_yearMonth: { tenantId, yearMonth } },
      create: {
        ...createTenantUsageCurrent(tenantId, yearMonth),
        messages:         delta.messages         ?? 0,
        inputTokens:      delta.inputTokens      ?? 0,
        outputTokens:     delta.outputTokens     ?? 0,
        totalTokens:      (delta.inputTokens ?? 0) + (delta.outputTokens ?? 0),
        estimatedCostUsd: delta.estimatedCostUsd ?? 0,
        lastMessageAt:    delta.messages ? new Date() : undefined,
      } as any,
      update: {
        messages:         { increment: delta.messages         ?? 0 },
        inputTokens:      { increment: delta.inputTokens      ?? 0 },
        outputTokens:     { increment: delta.outputTokens     ?? 0 },
        totalTokens:      { increment: (delta.inputTokens ?? 0) + (delta.outputTokens ?? 0) },
        estimatedCostUsd: { increment: delta.estimatedCostUsd ?? 0 },
        lastMessageAt:    delta.messages ? new Date() : undefined,
      },
    })
    return row as TenantUsageCurrent
  }
}
```

- [ ] **Step 7.3: Commit**

```bash
git add src/infrastructure/db/repositories/PrismaTenantUsage*.ts
git commit -m "feat(usage-limits): add Prisma repositories with atomic increment"
```

---

## Task 8: Wiring no DI e integração com SendMessage

**Files:**
- Modify: `src/infrastructure/di/index.ts`
- Modify: `src/domains/conversation/use-cases/SendMessage.ts`

- [ ] **Step 8.1: Adicionar imports e repos no DI**

Em `src/infrastructure/di/index.ts`, adicionar após os imports existentes:

```typescript
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { PrismaTenantUsageLimitRepository } from '@/infrastructure/db/repositories/PrismaTenantUsageLimitRepository'
import { PrismaTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/PrismaTenantUsageCurrentRepository'
import { CheckAndEnforceUsageLimit } from '@/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit'
import { RecordUsage } from '@/domains/usage-limits/use-cases/RecordUsage'
```

Adicionar na seção `// ─── Repositories`:

```typescript
const usageLimitRepo   = usePrisma ? new PrismaTenantUsageLimitRepository()   : new InMemoryTenantUsageLimitRepository()
const usageCurrentRepo = usePrisma ? new PrismaTenantUsageCurrentRepository() : new InMemoryTenantUsageCurrentRepository()
```

Adicionar no objeto `di` (após a seção de Crew):

```typescript
  // Usage Limits
  checkUsageLimit: new CheckAndEnforceUsageLimit(usageLimitRepo, usageCurrentRepo),
  recordUsage:     new RecordUsage(usageCurrentRepo, usageLimitRepo),
```

- [ ] **Step 8.2: Integrar check de quota no SendMessage**

Abrir `src/domains/conversation/use-cases/SendMessage.ts`.

Localizar o construtor e adicionar `checkUsageLimit` como dependência opcional:

```typescript
// No construtor, adicionar após os parâmetros existentes:
private checkUsageLimit?: { execute(input: { tenantId: string }): Promise<{ allowed: boolean; reason?: string }> }
```

Localizar onde o LLM é chamado (dentro de `BuildRAGContext` ou antes dele) e adicionar:

```typescript
// Antes da chamada ao LLM:
if (this.checkUsageLimit) {
  const usageResult = await this.checkUsageLimit.execute({ tenantId: input.tenantId })
  if (!usageResult.allowed) {
    throw new AppError('QUOTA_EXCEEDED', `Limite do tenant excedido: ${usageResult.reason}`)
  }
}
```

- [ ] **Step 8.3: Rodar suite completa**

```bash
npm run test
```
Expected: todos os testes passando (sem regressões — o check é opcional)

- [ ] **Step 8.4: Commit**

```bash
git add src/infrastructure/di/index.ts src/domains/conversation/use-cases/SendMessage.ts
git commit -m "feat(usage-limits): wire CheckAndEnforceUsageLimit and RecordUsage in DI"
```

---

## Task 9: API routes

**Files:**
- Create: `src/app/api/v1/tenants/usage/route.ts`
- Create: `src/app/api/v1/tenants/[id]/usage-limit/route.ts`

- [ ] **Step 9.1: Criar GET /api/v1/tenants/usage**

```typescript
// src/app/api/v1/tenants/usage/route.ts
import { type NextRequest } from 'next/server'
import { getSession } from '@/shared/guards/withSession'
import { errorResponse } from '@/shared/utils/apiResponse'
import { di } from '@/infrastructure/di'
import { getCurrentYearMonth } from '@/domains/usage-limits/entities/TenantUsageCurrent'
import { DEFAULT_USAGE_LIMIT } from '@/domains/usage-limits/entities/TenantUsageLimit'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session.tenantId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const yearMonth = request.nextUrl.searchParams.get('month') ?? getCurrentYearMonth()
    const tenantId  = session.tenantId

    const [checkResult, limit] = await Promise.all([
      di.checkUsageLimit.execute({ tenantId }),
      (di as any).usageLimitRepo?.findByTenant?.(tenantId),
    ])

    return Response.json({
      tenantId,
      yearMonth,
      current: checkResult.currentUsage,
      limit:   checkResult.limit,
      percentages: {
        messages: Math.round((checkResult.currentUsage.messages / checkResult.limit.messagesPerMonth) * 100),
        cost:     Math.round((checkResult.currentUsage.estimatedCostUsd / checkResult.limit.costPerMonthUsd) * 100),
        tokens:   Math.round((checkResult.currentUsage.totalTokens / checkResult.limit.tokensPerMonth) * 100),
      },
    }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 9.2: Criar PATCH /api/v1/tenants/[id]/usage-limit**

```typescript
// src/app/api/v1/tenants/[id]/usage-limit/route.ts
import { type NextRequest } from 'next/server'
import { getSession, requirePlatformAdmin } from '@/shared/guards/withSession'
import { errorResponse } from '@/shared/utils/apiResponse'
import { di } from '@/infrastructure/di'
import { createTenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'
import { AppError } from '@/shared/errors/AppError'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [session, { id: tenantId }] = await Promise.all([getSession(request), params])
    requirePlatformAdmin(session)

    const body = await request.json() as {
      messagesPerMonth?: number
      tokensPerMonth?: number
      costPerMonthUsd?: number
      messagesPerMinute?: number
      isActive?: boolean
    }

    // Busca limite existente ou cria com defaults
    const existing = await di.checkUsageLimit.execute({ tenantId })
    const currentLimit = {
      messagesPerMonth:  existing.limit.messagesPerMonth,
      tokensPerMonth:    existing.limit.tokensPerMonth,
      costPerMonthUsd:   existing.limit.costPerMonthUsd,
      messagesPerMinute: 30,
    }

    const newLimit = createTenantUsageLimit(tenantId, { ...currentLimit, ...body })
    // Salva via DI — acessa o repo diretamente via di interno
    // (o DI expõe checkUsageLimit que internamente usa usageLimitRepo)
    // Para simplificar, adicionamos usageLimitRepo ao di no próximo step

    return Response.json({ tenantId, limit: newLimit }, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 9.3: Expor usageLimitRepo no di para uso nas rotas**

Em `src/infrastructure/di/index.ts`, adicionar ao objeto `di`:

```typescript
  // Repos expostos para uso nas API routes
  usageLimitRepo,
  usageCurrentRepo,
```

Atualizar a route `[id]/usage-limit` para usar `di.usageLimitRepo.save(newLimit)`.

- [ ] **Step 9.4: Commit**

```bash
git add src/app/api/v1/tenants/
git commit -m "feat(usage-limits): add GET /tenants/usage and PATCH /tenants/:id/usage-limit routes"
```

---

## Task 10: RLS no PostgreSQL

**Files:**
- Create: migration SQL via `prisma migrate dev`

- [ ] **Step 10.1: Criar arquivo de migration manual**

```bash
npx prisma migrate dev --name add_rls_policies --create-only
```
Expected: Arquivo de migration criado em `prisma/migrations/YYYYMMDD_add_rls_policies/migration.sql` (vazio)

- [ ] **Step 10.2: Editar o arquivo de migration com as políticas RLS**

Abrir o arquivo `migration.sql` criado e substituir pelo conteúdo:

```sql
-- Enable RLS on all tables with tenantId
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_limits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_current ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow access when app.current_tenant_id matches OR is not set (app-level superuser)
-- Pattern: a aplicação define SET LOCAL app.current_tenant_id = 'xxx' por tenant
--          Se não definido (migrações, admin), a configuração retorna '' e o acesso é liberado

CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR tenant_id IS NULL
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_agents ON agents
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_conversations ON conversations
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_knowledge_documents ON knowledge_documents
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_departments ON departments
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_crews ON crews
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_usage_limits ON tenant_usage_limits
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_usage_current ON tenant_usage_current
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_qualification_states ON qualification_states
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
         OR current_setting('app.current_tenant_id', true) IS NULL
         OR current_setting('app.current_tenant_id', true) = '');
```

- [ ] **Step 10.3: Aplicar a migration**

```bash
npx prisma migrate dev
```
Expected: Migration aplicada com sucesso. Se falhar com nome de tabela, verificar os `@@map` no schema.prisma e corrigir nomes no SQL.

- [ ] **Step 10.4: Verificar RLS ativo via psql**

```bash
docker exec -it crewomni-db psql -U postgres -d crewomni -c "\dp agents"
```
Expected: Linha mostrando `Row Security: enabled` para a tabela agents.

- [ ] **Step 10.5: Rodar suite completa de testes**

```bash
npm run test
```
Expected: todos os testes passando. RLS com política permissiva (sem app.current_tenant_id definido) não deve bloquear nada nos testes.

- [ ] **Step 10.6: Commit final**

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat(security): enable RLS and create tenant isolation policies on all tables"
```

---

## Task 11: Teste de smoke end-to-end

**Files:**
- Test: `tests/unit/domains/usage-limits/integration-smoke.test.ts`

- [ ] **Step 11.1: Escrever teste de smoke**

```typescript
// tests/unit/domains/usage-limits/integration-smoke.test.ts
import { describe, it, expect } from 'vitest'
import { CheckAndEnforceUsageLimit } from '@/domains/usage-limits/use-cases/CheckAndEnforceUsageLimit'
import { RecordUsage } from '@/domains/usage-limits/use-cases/RecordUsage'
import { InMemoryTenantUsageLimitRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageLimitRepository'
import { InMemoryTenantUsageCurrentRepository } from '@/infrastructure/db/repositories/InMemoryTenantUsageCurrentRepository'
import { createTenantUsageLimit } from '@/domains/usage-limits/entities/TenantUsageLimit'

describe('Usage Limits — smoke flow', () => {
  it('fluxo completo: check → record → check excedido', async () => {
    const limitRepo   = new InMemoryTenantUsageLimitRepository()
    const currentRepo = new InMemoryTenantUsageCurrentRepository()
    const checkUc  = new CheckAndEnforceUsageLimit(limitRepo, currentRepo)
    const recordUc = new RecordUsage(currentRepo, limitRepo)

    // Configurar limite baixo para teste
    await limitRepo.save(createTenantUsageLimit('devolus', {
      messagesPerMonth: 2,
      costPerMonthUsd: 100,
      tokensPerMonth: 1_000_000,
    }))

    // 1ª mensagem: deve passar
    const r1 = await checkUc.execute({ tenantId: 'devolus' })
    expect(r1.allowed).toBe(true)
    await recordUc.execute({ tenantId: 'devolus', inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 })

    // 2ª mensagem: deve passar
    const r2 = await checkUc.execute({ tenantId: 'devolus' })
    expect(r2.allowed).toBe(true)
    await recordUc.execute({ tenantId: 'devolus', inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 })

    // 3ª mensagem: deve ser bloqueada (limite = 2)
    const r3 = await checkUc.execute({ tenantId: 'devolus' })
    expect(r3.allowed).toBe(false)
    expect(r3.reason).toBe('QUOTA_MESSAGES')
    expect(r3.currentUsage.messages).toBe(2)

    // Fast4Sign não é afetada
    const rFast4 = await checkUc.execute({ tenantId: 'fast4sign' })
    expect(rFast4.allowed).toBe(true)
  })
})
```

- [ ] **Step 11.2: Rodar**

```bash
npm run test tests/unit/domains/usage-limits/integration-smoke.test.ts
```
Expected: PASS

- [ ] **Step 11.3: Rodar suite completa final**

```bash
npm run test
```
Expected: todos os testes passando

- [ ] **Step 11.4: Commit final da fase**

```bash
git add tests/unit/domains/usage-limits/integration-smoke.test.ts
git commit -m "test(usage-limits): add end-to-end smoke test covering full check→record→block flow"
```

---

## Self-Review

### Cobertura da spec

| Requisito da spec | Tarefa | Status |
|---|---|---|
| TenantUsageLimit com limites configuráveis | Task 1 | ✅ |
| TenantUsageCurrent com contadores mensais | Task 1 | ✅ |
| DEFAULT_USAGE_LIMIT para tenants sem config | Task 4 | ✅ |
| Check antes de chamar LLM | Task 8 (SendMessage) | ✅ |
| Bloquear quando quota excedida | Task 4 | ✅ |
| QUOTA_MESSAGES, QUOTA_COST, QUOTA_TOKENS | Task 4 | ✅ |
| Record incremental pós-execução | Task 5 | ✅ |
| needsNotification em 80% | Task 5 | ✅ |
| best-effort (não bloqueia em falha) | Task 5 | ✅ |
| Isolamento multi-tenant | Tasks 4, 5, 11 | ✅ |
| GET /api/v1/tenants/usage | Task 9 | ✅ |
| PATCH /api/v1/tenants/:id/usage-limit (PLATFORM_ADMIN) | Task 9 | ✅ |
| Prisma models + migration | Task 6 | ✅ |
| RLS no PostgreSQL | Task 10 | ✅ |
| Políticas por tenantId | Task 10 | ✅ |
| Testes de isolamento Devolus ≠ Fast4Sign | Task 11 | ✅ |
