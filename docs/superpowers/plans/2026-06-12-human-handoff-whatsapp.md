# Human Handoff via WhatsApp Business Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um agente AI de uma crew detecta que o cliente precisa de atendimento humano, ele chama a tool `suggest_human_handoff`; o chat exibe quick replies; o cliente aceita; o sistema despacha WhatsApp proativo ao cliente e ao bot da crew, e marca a conversa como `TRANSFERRED_TO_HUMAN`.

**Architecture:** Tool LLM → sugestão na resposta → cliente aceita via endpoint → `AcceptHumanHandoff` despacha WA ao cliente + WA ao bot + webhook opcional → conversa bloqueada. Config por crew (`humanHandoffWhatsappNumber?`, `humanHandoffWebhookUrl?`). UI no widget com 3 estados: sugestão quick-reply, pedir número, confirmação/link.

**Tech Stack:** TypeScript, Prisma (PostgreSQL), Next.js App Router, WhatsAppDispatcher (Meta Cloud API), Vitest, React (widget)

---

## Task 1: Prisma schema — Crew handoff fields + ConversationStatus + HumanHandoff model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Passo 1.1: Adicionar campos à model Crew**

Localizar o model `Crew` em `prisma/schema.prisma` e adicionar:

```prisma
model Crew {
  id           String     @id @default(cuid())
  tenantId     String
  departmentId String
  name         String
  slug         String
  description  String?
  objective    String?
  status       CrewStatus @default(DRAFT)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  humanHandoffWhatsappNumber String?
  humanHandoffWebhookUrl     String?

  // ... relações existentes ...
}
```

- [ ] **Passo 1.2: Adicionar `TRANSFERRED_TO_HUMAN` ao enum ConversationStatus**

Localizar o enum `ConversationStatus` e adicionar o valor:

```prisma
enum ConversationStatus {
  OPEN
  CLOSED
  ACTIVE
  WAITING_USER
  WAITING_AGENT
  HANDOFF_REQUESTED
  HANDOFF_ACCEPTED
  REOPENED
  ARCHIVED
  TRANSFERRED_TO_HUMAN
}
```

- [ ] **Passo 1.2b: Adicionar `TRANSFERRED_TO_HUMAN` ao enum TypeScript de domínio**

Abrir `src/domains/conversation/entities/Conversation.ts` e adicionar ao enum `ConversationStatus`:

```typescript
export enum ConversationStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ACTIVE = 'ACTIVE',
  WAITING_USER = 'WAITING_USER',
  WAITING_AGENT = 'WAITING_AGENT',
  HANDOFF_REQUESTED = 'HANDOFF_REQUESTED',
  HANDOFF_ACCEPTED = 'HANDOFF_ACCEPTED',
  REOPENED = 'REOPENED',
  ARCHIVED = 'ARCHIVED',
  TRANSFERRED_TO_HUMAN = 'TRANSFERRED_TO_HUMAN',
}
```

- [ ] **Passo 1.3: Adicionar model HumanHandoff**

Adicionar após o model `Conversation`:

```prisma
model HumanHandoff {
  id             String    @id @default(cuid())
  tenantId       String
  conversationId String    @unique
  reason         String
  contactPhone   String?
  webhookSent    Boolean   @default(false)
  waSentAt       DateTime?
  webhookSentAt  DateTime?
  createdAt      DateTime  @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id])
}
```

Adicionar a relação inversa na model `Conversation`:

```prisma
model Conversation {
  // ... campos existentes ...
  humanHandoff HumanHandoff?
}
```

- [ ] **Passo 1.4: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name add_human_handoff
```

Esperado: `The following migration(s) have been applied: .../add_human_handoff/migration.sql`

- [ ] **Passo 1.5: Gerar Prisma client**

```bash
npx prisma generate
```

Esperado: sem erros.

- [ ] **Passo 1.6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add human handoff fields to Crew + HumanHandoff model + TRANSFERRED_TO_HUMAN status"
```

---

## Task 2: Atualizar entidade Crew + HumanHandoff entity + IHumanHandoffRepository + InMemoryHumanHandoffRepository

**Files:**
- Modify: `src/domains/crew/entities/Crew.ts`
- Create: `src/domains/conversation/entities/HumanHandoff.ts`
- Create: `src/domains/conversation/repositories/IHumanHandoffRepository.ts`
- Create: `src/infrastructure/db/repositories/InMemoryHumanHandoffRepository.ts`

- [ ] **Passo 2.1: Adicionar campos opcionais na entidade Crew**

Abrir `src/domains/crew/entities/Crew.ts` e adicionar os campos:

```typescript
export type Crew = {
  id: string
  tenantId: string
  departmentId: string
  name: string
  slug: string
  description: string | null
  objective: string | null
  status: CrewStatus
  humanHandoffWhatsappNumber: string | null
  humanHandoffWebhookUrl: string | null
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Passo 2.2: Criar entidade HumanHandoff**

```typescript
// src/domains/conversation/entities/HumanHandoff.ts
export type HumanHandoff = {
  id: string
  tenantId: string
  conversationId: string
  reason: string
  contactPhone: string | null
  webhookSent: boolean
  waSentAt: Date | null
  webhookSentAt: Date | null
  createdAt: Date
}
```

- [ ] **Passo 2.3: Criar IHumanHandoffRepository**

```typescript
// src/domains/conversation/repositories/IHumanHandoffRepository.ts
import type { HumanHandoff } from '../entities/HumanHandoff'

export interface IHumanHandoffRepository {
  save(handoff: HumanHandoff): Promise<void>
  findByConversationId(conversationId: string, tenantId: string): Promise<HumanHandoff | null>
}
```

- [ ] **Passo 2.4: Criar InMemoryHumanHandoffRepository**

```typescript
// src/infrastructure/db/repositories/InMemoryHumanHandoffRepository.ts
import type { IHumanHandoffRepository } from '@/domains/conversation/repositories/IHumanHandoffRepository'
import type { HumanHandoff } from '@/domains/conversation/entities/HumanHandoff'

export class InMemoryHumanHandoffRepository implements IHumanHandoffRepository {
  private store: HumanHandoff[] = []

  async save(handoff: HumanHandoff): Promise<void> {
    const idx = this.store.findIndex((h) => h.id === handoff.id)
    if (idx >= 0) {
      this.store[idx] = handoff
    } else {
      this.store.push(handoff)
    }
  }

  async findByConversationId(conversationId: string, tenantId: string): Promise<HumanHandoff | null> {
    return this.store.find((h) => h.conversationId === conversationId && h.tenantId === tenantId) ?? null
  }
}
```

- [ ] **Passo 2.5: Commit**

```bash
git add src/domains/crew/entities/Crew.ts \
        src/domains/conversation/entities/HumanHandoff.ts \
        src/domains/conversation/repositories/IHumanHandoffRepository.ts \
        src/infrastructure/db/repositories/InMemoryHumanHandoffRepository.ts
git commit -m "feat(domain): add HumanHandoff entity, repository interface, in-memory impl, update Crew entity"
```

---

## Task 3: PrismaHumanHandoffRepository

**Files:**
- Create: `src/infrastructure/db/repositories/PrismaHumanHandoffRepository.ts`

- [ ] **Passo 3.1: Implementar PrismaHumanHandoffRepository**

```typescript
// src/infrastructure/db/repositories/PrismaHumanHandoffRepository.ts
import type { PrismaClient } from '@prisma/client'
import type { IHumanHandoffRepository } from '@/domains/conversation/repositories/IHumanHandoffRepository'
import type { HumanHandoff } from '@/domains/conversation/entities/HumanHandoff'

export class PrismaHumanHandoffRepository implements IHumanHandoffRepository {
  constructor(private prisma: PrismaClient) {}

  async save(handoff: HumanHandoff): Promise<void> {
    await this.prisma.humanHandoff.upsert({
      where: { conversationId: handoff.conversationId },
      create: {
        id: handoff.id,
        tenantId: handoff.tenantId,
        conversationId: handoff.conversationId,
        reason: handoff.reason,
        contactPhone: handoff.contactPhone,
        webhookSent: handoff.webhookSent,
        waSentAt: handoff.waSentAt,
        webhookSentAt: handoff.webhookSentAt,
        createdAt: handoff.createdAt,
      },
      update: {
        webhookSent: handoff.webhookSent,
        waSentAt: handoff.waSentAt,
        webhookSentAt: handoff.webhookSentAt,
      },
    })
  }

  async findByConversationId(conversationId: string, tenantId: string): Promise<HumanHandoff | null> {
    const row = await this.prisma.humanHandoff.findUnique({
      where: { conversationId },
    })
    if (!row || row.tenantId !== tenantId) return null
    return {
      id: row.id,
      tenantId: row.tenantId,
      conversationId: row.conversationId,
      reason: row.reason,
      contactPhone: row.contactPhone,
      webhookSent: row.webhookSent,
      waSentAt: row.waSentAt,
      webhookSentAt: row.webhookSentAt,
      createdAt: row.createdAt,
    }
  }
}
```

- [ ] **Passo 3.2: Commit**

```bash
git add src/infrastructure/db/repositories/PrismaHumanHandoffRepository.ts
git commit -m "feat(infra): add PrismaHumanHandoffRepository"
```

---

## Task 4: SuggestHumanHandoff use-case + testes

**Files:**
- Create: `src/domains/conversation/use-cases/SuggestHumanHandoff.ts`
- Create: `tests/unit/domains/conversation/SuggestHumanHandoff.test.ts`

- [ ] **Passo 4.1: Escrever os testes primeiro (TDD)**

```typescript
// tests/unit/domains/conversation/SuggestHumanHandoff.test.ts
import { describe, it, expect, vi } from 'vitest'
import { SuggestHumanHandoff } from '@/domains/conversation/use-cases/SuggestHumanHandoff'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1',
    tenantId: 'tenant-1',
    departmentId: 'dept-1',
    name: 'Suporte Premium',
    slug: 'suporte-premium',
    description: null,
    objective: null,
    status: 'ACTIVE' as const,
    humanHandoffWhatsappNumber: null,
    humanHandoffWebhookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCrewRepo(): ICrewRepository {
  return {
    findById: vi.fn().mockResolvedValue(makeCrew()),
    create: vi.fn(),
    findBySlug: vi.fn(),
    findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as ICrewRepository
}

describe('SuggestHumanHandoff', () => {
  it('retorna canSuggest=true quando crew tem número configurado', async () => {
    const crew = makeCrew({ humanHandoffWhatsappNumber: '+5511999990000' })
    const crewRepo = makeCrewRepo()
    ;(crewRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(crew)

    const useCase = new SuggestHumanHandoff(crewRepo)
    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-1', reason: 'Dúvida técnica complexa' })

    expect(result.canSuggest).toBe(true)
    expect(result.crewName).toBe('Suporte Premium')
    expect(result.reason).toBe('Dúvida técnica complexa')
  })

  it('retorna canSuggest=false quando crew não tem número configurado', async () => {
    const crewRepo = makeCrewRepo()
    const useCase = new SuggestHumanHandoff(crewRepo)
    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-1', reason: 'Teste' })

    expect(result.canSuggest).toBe(false)
  })

  it('retorna canSuggest=false quando crew não existe', async () => {
    const crewRepo = makeCrewRepo()
    ;(crewRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const useCase = new SuggestHumanHandoff(crewRepo)
    const result = await useCase.execute({ tenantId: 'tenant-1', crewId: 'crew-x', reason: 'Teste' })

    expect(result.canSuggest).toBe(false)
  })
})
```

- [ ] **Passo 4.2: Rodar e confirmar falha**

```bash
npx vitest run tests/unit/domains/conversation/SuggestHumanHandoff.test.ts
```

Esperado: FAIL — `Cannot find module '@/domains/conversation/use-cases/SuggestHumanHandoff'`

- [ ] **Passo 4.3: Implementar SuggestHumanHandoff**

```typescript
// src/domains/conversation/use-cases/SuggestHumanHandoff.ts
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'

type SuggestHumanHandoffInput = {
  tenantId: string
  crewId: string
  reason: string
}

type SuggestHumanHandoffOutput = {
  canSuggest: boolean
  crewName: string
  reason: string
}

export class SuggestHumanHandoff {
  constructor(private crewRepo: ICrewRepository) {}

  async execute(input: SuggestHumanHandoffInput): Promise<SuggestHumanHandoffOutput> {
    const crew = await this.crewRepo.findById(input.crewId, input.tenantId)
    if (!crew?.humanHandoffWhatsappNumber) {
      return { canSuggest: false, crewName: crew?.name ?? '', reason: input.reason }
    }
    return { canSuggest: true, crewName: crew.name, reason: input.reason }
  }
}
```

- [ ] **Passo 4.4: Rodar e confirmar passou**

```bash
npx vitest run tests/unit/domains/conversation/SuggestHumanHandoff.test.ts
```

Esperado: 3 passed

- [ ] **Passo 4.5: Commit**

```bash
git add src/domains/conversation/use-cases/SuggestHumanHandoff.ts \
        tests/unit/domains/conversation/SuggestHumanHandoff.test.ts
git commit -m "feat(conversation): add SuggestHumanHandoff use-case with tests"
```

---

## Task 5: AcceptHumanHandoff use-case + testes

**Files:**
- Create: `src/domains/conversation/use-cases/AcceptHumanHandoff.ts`
- Create: `tests/unit/domains/conversation/AcceptHumanHandoff.test.ts`

- [ ] **Passo 5.1: Escrever os testes primeiro (TDD)**

```typescript
// tests/unit/domains/conversation/AcceptHumanHandoff.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AcceptHumanHandoff } from '@/domains/conversation/use-cases/AcceptHumanHandoff'
import { ConversationStatus, MessageRole } from '@/domains/conversation/entities/Conversation'
import type { IConversationRepository } from '@/domains/conversation/repositories/IConversationRepository'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IContactChannelIdentityRepository } from '@/domains/contact/repositories/IContactChannelIdentityRepository'
import type { IHumanHandoffRepository } from '@/domains/conversation/repositories/IHumanHandoffRepository'
import type { IChannelDispatcher } from '@/infrastructure/channel/IChannelDispatcher'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeConversation(overrides = {}) {
  return {
    id: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    crewId: 'crew-1',
    externalUserId: null,
    status: ConversationStatus.OPEN,
    messageCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCrew(overrides = {}) {
  return {
    id: 'crew-1',
    tenantId: 'tenant-1',
    departmentId: 'dept-1',
    name: 'Suporte Premium',
    slug: 'suporte-premium',
    description: null,
    objective: null,
    status: 'ACTIVE' as const,
    humanHandoffWhatsappNumber: '+5511999990000',
    humanHandoffWebhookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMessages() {
  return [
    { id: 'm1', conversationId: 'conv-1', tenantId: 'tenant-1', role: MessageRole.USER, content: 'Preciso de ajuda', createdAt: new Date() },
    { id: 'm2', conversationId: 'conv-1', tenantId: 'tenant-1', role: MessageRole.ASSISTANT, content: 'Claro, vou verificar.', createdAt: new Date() },
  ]
}

function makeConversationRepo(): IConversationRepository {
  return {
    findConversationById: vi.fn().mockResolvedValue(makeConversation()),
    listRecentMessages: vi.fn().mockResolvedValue(makeMessages()),
    updateConversationStatus: vi.fn().mockResolvedValue(undefined),
    createConversation: vi.fn(),
    createMessage: vi.fn(),
    countMessages: vi.fn(),
    closeConversation: vi.fn(),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    countConversationsByCrew: vi.fn(),
    countMessagesByCrewAndAgent: vi.fn(),
    updateConversationAgent: vi.fn(),
  } as unknown as IConversationRepository
}

function makeCrewRepo(overrides = {}): ICrewRepository {
  return {
    findById: vi.fn().mockResolvedValue(makeCrew(overrides)),
    create: vi.fn(),
    findBySlug: vi.fn(),
    findAllByTenant: vi.fn(),
    findAllByDepartment: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as ICrewRepository
}

function makeChannelIdentityRepo(phoneNumber: string | null = null): IContactChannelIdentityRepository {
  return {
    findByExternalId: vi.fn().mockResolvedValue(phoneNumber ? { phoneNumber } : null),
    findByContactId: vi.fn().mockResolvedValue(phoneNumber ? [{ channel: 'WHATSAPP', phoneNumber }] : []),
    save: vi.fn(),
  } as unknown as IContactChannelIdentityRepository
}

function makeHandoffRepo(): IHumanHandoffRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findByConversationId: vi.fn().mockResolvedValue(null),
  }
}

function makeDispatcher(): IChannelDispatcher {
  return {
    send: vi.fn().mockResolvedValue({ success: true }),
  }
}

function makeSut(opts: {
  crew?: ReturnType<typeof makeCrew>
  customerPhone?: string | null
  dispatcher?: IChannelDispatcher
} = {}) {
  const conversationRepo = makeConversationRepo()
  const crewRepo = makeCrewRepo(opts.crew ?? {})
  if (opts.crew !== undefined) {
    ;(crewRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(opts.crew)
  }
  const channelIdentityRepo = makeChannelIdentityRepo(opts.customerPhone ?? null)
  const handoffRepo = makeHandoffRepo()
  const dispatcher = opts.dispatcher ?? makeDispatcher()
  const useCase = new AcceptHumanHandoff(conversationRepo, crewRepo, channelIdentityRepo, handoffRepo, dispatcher)
  return { useCase, conversationRepo, crewRepo, channelIdentityRepo, handoffRepo, dispatcher }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AcceptHumanHandoff', () => {
  it('despacha WA ao cliente e ao bot quando contactPhone é fornecido no body', async () => {
    const { useCase, dispatcher, handoffRepo, conversationRepo } = makeSut()

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      contactPhone: '+5511888880000',
    })

    expect(result.success).toBe(true)
    expect(result.channel).toBe('whatsapp')

    // WA ao cliente
    expect(dispatcher.send).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      to: '+5511888880000',
    }))
    // WA ao bot da crew
    expect(dispatcher.send).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      to: '+5511999990000',
    }))

    expect(handoffRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-1',
      contactPhone: '+5511888880000',
    }))

    expect(conversationRepo.updateConversationStatus).toHaveBeenCalledWith(
      'conv-1',
      'TRANSFERRED_TO_HUMAN',
      'tenant-1',
    )
  })

  it('despacha WA quando contactPhone vem da identidade do canal (cliente WA)', async () => {
    const { useCase, dispatcher } = makeSut({ customerPhone: '+5511777770000' })

    const result = await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })

    expect(result.channel).toBe('whatsapp')
    expect(dispatcher.send).toHaveBeenCalledWith(expect.objectContaining({ to: '+5511777770000' }))
  })

  it('retorna channel=link quando contactPhone não é informado e não há identidade WA', async () => {
    const { useCase, dispatcher } = makeSut({ customerPhone: null })

    const result = await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })

    expect(result.channel).toBe('link')
    expect(result.linkUrl).toContain('wa.me/5511999990000')
    // Não despacha WA ao cliente
    const calls = (dispatcher.send as ReturnType<typeof vi.fn>).mock.calls
    const clientCalls = calls.filter((c: any[]) => c[0].to !== '+5511999990000')
    expect(clientCalls).toHaveLength(0)
  })

  it('dispara webhook JSON adicional quando crew.humanHandoffWebhookUrl está configurado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const crew = makeCrew({ humanHandoffWebhookUrl: 'https://n8n.example.com/webhook/handoff' })
    const { useCase } = makeSut({ crew, customerPhone: '+5511888880000' })

    await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', contactPhone: '+5511888880000' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/handoff',
      expect.objectContaining({ method: 'POST' }),
    )

    vi.unstubAllGlobals()
  })

  it('não dispara webhook quando crew.humanHandoffWebhookUrl é null', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { useCase } = makeSut({ customerPhone: '+5511888880000' })
    await useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1', contactPhone: '+5511888880000' })

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('lança erro quando crew não tem humanHandoffWhatsappNumber configurado', async () => {
    const crew = makeCrew({ humanHandoffWhatsappNumber: null })
    const { useCase } = makeSut({ crew })

    await expect(
      useCase.execute({ tenantId: 'tenant-1', conversationId: 'conv-1' })
    ).rejects.toThrow('HUMAN_HANDOFF_NOT_CONFIGURED')
  })
})
```

- [ ] **Passo 5.2: Rodar e confirmar falha**

```bash
npx vitest run tests/unit/domains/conversation/AcceptHumanHandoff.test.ts
```

Esperado: FAIL — `Cannot find module '@/domains/conversation/use-cases/AcceptHumanHandoff'`

- [ ] **Passo 5.3: Implementar AcceptHumanHandoff**

```typescript
// src/domains/conversation/use-cases/AcceptHumanHandoff.ts
import { createId } from '@paralleldrive/cuid2'
import { AppError } from '@/shared/errors/AppError'
import type { IConversationRepository } from '../repositories/IConversationRepository'
import type { ICrewRepository } from '@/domains/crew/repositories/ICrewRepository'
import type { IContactChannelIdentityRepository } from '@/domains/contact/repositories/IContactChannelIdentityRepository'
import type { IHumanHandoffRepository } from '../repositories/IHumanHandoffRepository'
import type { IChannelDispatcher } from '@/infrastructure/channel/IChannelDispatcher'
import { MessageRole } from '../entities/Conversation'

type AcceptHumanHandoffInput = {
  tenantId: string
  conversationId: string
  contactPhone?: string
  reason?: string
}

type AcceptHumanHandoffOutput = {
  success: boolean
  channel: 'whatsapp' | 'link'
  linkUrl?: string
}

export class AcceptHumanHandoff {
  constructor(
    private conversationRepo: IConversationRepository,
    private crewRepo: ICrewRepository,
    private channelIdentityRepo: IContactChannelIdentityRepository,
    private handoffRepo: IHumanHandoffRepository,
    private whatsappDispatcher: IChannelDispatcher,
  ) {}

  async execute(input: AcceptHumanHandoffInput): Promise<AcceptHumanHandoffOutput> {
    const conversation = await this.conversationRepo.findConversationById({
      id: input.conversationId,
      tenantId: input.tenantId,
    })
    if (!conversation) throw new AppError('CONVERSATION_NOT_FOUND', 'Conversa não encontrada.')
    if (!conversation.crewId) throw new AppError('CREW_NOT_FOUND', 'Conversa não está associada a uma crew.')

    const crew = await this.crewRepo.findById(conversation.crewId, input.tenantId)
    if (!crew?.humanHandoffWhatsappNumber) {
      throw new AppError('HUMAN_HANDOFF_NOT_CONFIGURED', 'Esta crew não tem suporte humano configurado.')
    }

    const botNumber = crew.humanHandoffWhatsappNumber
    const reason = input.reason ?? 'Escalada solicitada pelo agente'

    // Resolve customer phone: body > ContactChannelIdentity > externalUserId
    let contactPhone = input.contactPhone ?? null
    if (!contactPhone) {
      const identities = await this.channelIdentityRepo.findByContactId(
        conversation.externalUserId ?? '',
        input.tenantId,
      )
      const waIdentity = identities.find((i) => i.channel === 'WHATSAPP')
      contactPhone = waIdentity?.phoneNumber ?? null
    }

    // Build conversation summary from last 10 messages
    const recentMessages = await this.conversationRepo.listRecentMessages(input.conversationId, 10)
    const transcript = recentMessages
      .map((m) => `[${m.role === MessageRole.USER ? 'Cliente' : 'Agente'}]: ${m.content}`)
      .join('\n')

    const now = new Date()
    let waSentAt: Date | null = null
    let webhookSentAt: Date | null = null

    if (contactPhone) {
      // Dispatch WA to customer
      await this.whatsappDispatcher.send({
        tenantId: input.tenantId,
        to: contactPhone,
        text: `Você foi transferido para a equipe ${crew.name}. Nossa equipe entrará em contato em breve via WhatsApp.`,
      })
      waSentAt = now
    }

    // Dispatch WA notification to crew bot
    await this.whatsappDispatcher.send({
      tenantId: input.tenantId,
      to: botNumber,
      text: `HANDOFF\nCliente: ${contactPhone ?? 'não informado'}\nCrew: ${crew.name}\nMotivo: ${reason}\n\nÚltimas mensagens:\n${transcript}`,
    })

    // Optional webhook
    if (crew.humanHandoffWebhookUrl) {
      const payload = {
        contactPhone,
        crewName: crew.name,
        crewSlug: crew.slug,
        reason,
        transcript: recentMessages.map((m) => ({
          role: m.role === MessageRole.USER ? 'user' : 'assistant',
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      }
      try {
        await fetch(crew.humanHandoffWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        webhookSentAt = new Date()
      } catch (e) {
        console.error('Human handoff webhook failed:', e)
      }
    }

    // Persist HumanHandoff record
    await this.handoffRepo.save({
      id: createId(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      reason,
      contactPhone,
      webhookSent: webhookSentAt !== null,
      waSentAt,
      webhookSentAt,
      createdAt: now,
    })

    // Mark conversation as transferred
    await this.conversationRepo.updateConversationStatus(
      input.conversationId,
      'TRANSFERRED_TO_HUMAN',
      input.tenantId,
    )

    if (contactPhone) {
      return { success: true, channel: 'whatsapp' }
    }

    const botNumberClean = botNumber.replace(/\D/g, '')
    return {
      success: true,
      channel: 'link',
      linkUrl: `https://wa.me/${botNumberClean}?text=${encodeURIComponent(`Olá, preciso de ajuda`)}`,
    }
  }
}
```

- [ ] **Passo 5.4: Verificar se `createId` está disponível**

```bash
grep -r "createId\|@paralleldrive/cuid2" src/domains --include="*.ts" | head -5
```

Se não estiver em uso, checar o padrão usado para gerar IDs nos use-cases existentes (ex: `crypto.randomUUID()` ou `cuid()`). Usar o mesmo padrão.

- [ ] **Passo 5.5: Rodar e confirmar passou**

```bash
npx vitest run tests/unit/domains/conversation/AcceptHumanHandoff.test.ts
```

Esperado: 6 passed

- [ ] **Passo 5.6: Commit**

```bash
git add src/domains/conversation/use-cases/AcceptHumanHandoff.ts \
        tests/unit/domains/conversation/AcceptHumanHandoff.test.ts
git commit -m "feat(conversation): add AcceptHumanHandoff use-case with tests"
```

---

## Task 6: Atualizar SendMessage — tool suggest_human_handoff + guard TRANSFERRED_TO_HUMAN

**Files:**
- Modify: `src/domains/conversation/use-cases/SendMessage.ts`
- Modify: `tests/unit/domains/conversation/SendMessage.test.ts`

- [ ] **Passo 6.1: Adicionar `humanHandoffSuggestion` ao tipo `SendMessageOutput`**

Em `src/domains/conversation/use-cases/SendMessage.ts`, atualizar o tipo:

```typescript
type SendMessageOutput = {
  conversationId: string
  messageId: string
  reply: string
  model: string
  tokensUsed: number
  isNewConversation: boolean
  agentId: string
  humanHandoffSuggestion?: { reason: string; crewName: string }
}
```

- [ ] **Passo 6.2: Adicionar `SuggestHumanHandoff` ao construtor de SendMessage**

Adicionar import e parâmetro opcional no construtor:

```typescript
import type { SuggestHumanHandoff } from './SuggestHumanHandoff'

// No construtor (após emailDispatcher):
private suggestHumanHandoff?: SuggestHumanHandoff,
```

- [ ] **Passo 6.3: Adicionar guard no início do `execute()`**

Após a verificação de `CLOSED`, adicionar (logo após o bloco `if (conversation?.status === ConversationStatus.CLOSED)`):

```typescript
if (conversation?.status === ConversationStatus.TRANSFERRED_TO_HUMAN) {
  throw new AppError('CONVERSATION_TRANSFERRED', 'Esta conversa foi transferida para atendimento humano.')
}
```

- [ ] **Passo 6.4: Registrar a tool `suggest_human_handoff` quando crew tem handoff configurado**

Dentro do bloco `if (crewId)`, após o bloco que registra `transfer_conversation`, adicionar:

```typescript
// suggest_human_handoff: offered only when crew has a human handoff number
if (this.suggestHumanHandoff) {
  const suggestion = await this.suggestHumanHandoff.execute({
    tenantId: input.tenantId,
    crewId,
    reason: '',
  })
  if (suggestion.canSuggest) {
    tools = tools ?? []
    tools.push({
      type: 'function',
      function: {
        name: 'suggest_human_handoff',
        description: 'Use quando o cliente precisar de atendimento humano especializado que vai além da sua capacidade.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Por que está sugerindo a transferência.' },
          },
          required: ['reason'],
        },
      },
    })
  }
}
```

- [ ] **Passo 6.5: Processar a tool call `suggest_human_handoff` no loop de tool calls**

Dentro do `for (const tc of toolCalls)`, após o bloco de `transfer_conversation`, adicionar:

```typescript
if (tc.function?.name === 'suggest_human_handoff' && this.suggestHumanHandoff) {
  try {
    const args = JSON.parse(tc.function.arguments)
    const suggestion = await this.suggestHumanHandoff.execute({
      tenantId: input.tenantId,
      crewId: crewId ?? '',
      reason: args.reason ?? 'Escalada solicitada pelo agente',
    })
    if (suggestion.canSuggest) {
      // Will be returned in output — client shows quick replies
      // Store in local var to include in return
    }
  } catch (e) {
    console.error('Failed to process suggest_human_handoff tool call:', e)
  }
}
```

Para retornar a sugestão, declarar uma variável antes do bloco RAG:

```typescript
let humanHandoffSuggestion: { reason: string; crewName: string } | undefined = undefined
```

E dentro do `if (suggestion.canSuggest)` acima:

```typescript
humanHandoffSuggestion = { reason: args.reason ?? '', crewName: suggestion.crewName }
```

- [ ] **Passo 6.6: Incluir `humanHandoffSuggestion` no return**

```typescript
return {
  conversationId,
  messageId: assistantMessage.id,
  reply,
  model,
  tokensUsed,
  isNewConversation,
  agentId: conversation.agentId,
  humanHandoffSuggestion,
}
```

- [ ] **Passo 6.7: Adicionar testes para os dois comportamentos novos**

No arquivo `tests/unit/domains/conversation/SendMessage.test.ts`, adicionar ao final:

```typescript
describe('SendMessage — TRANSFERRED_TO_HUMAN guard', () => {
  it('lança CONVERSATION_TRANSFERRED quando status é TRANSFERRED_TO_HUMAN', async () => {
    const repo = makeRepo()
    ;(repo.findConversationById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConversation({ status: ConversationStatus.TRANSFERRED_TO_HUMAN })
    )

    const uc = new SendMessage(
      repo,
      makeRAG() as any,
      { log: vi.fn() } as any,
      makeQualStateRepo(),
      makeExtractOutput() as any,
      { findAllByCrew: vi.fn().mockResolvedValue([]) } as any,
      { execute: vi.fn() } as any,
      { findById: vi.fn() } as any,
    )

    await expect(uc.execute(makeInput({ conversationId: 'conv-1' }))).rejects.toThrow('CONVERSATION_TRANSFERRED')
  })
})

describe('SendMessage — suggest_human_handoff tool', () => {
  it('inclui humanHandoffSuggestion quando agente chama a tool', async () => {
    const repo = makeRepo()
    const rag = makeRAG()
    ;(rag.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      reply: 'Vou transferir para um humano.',
      model: 'gpt-4o-mini',
      tokensUsed: 50,
      chunksUsed: [],
      toolCalls: [
        {
          function: {
            name: 'suggest_human_handoff',
            arguments: JSON.stringify({ reason: 'Caso complexo' }),
          },
        },
      ],
    })

    const suggestHumanHandoff = {
      execute: vi.fn().mockResolvedValue({ canSuggest: true, crewName: 'Suporte Premium', reason: 'Caso complexo' }),
    }

    const uc = new SendMessage(
      repo,
      rag as any,
      { log: vi.fn() } as any,
      makeQualStateRepo(),
      makeExtractOutput() as any,
      { findAllByCrew: vi.fn().mockResolvedValue([]) } as any,
      { execute: vi.fn() } as any,
      { findById: vi.fn() } as any,
      undefined,
      undefined,
      undefined,
      undefined,
      suggestHumanHandoff as any,
    )

    const result = await uc.execute(makeInput({ conversationId: 'conv-1', crewId: 'crew-1' }))

    expect(result.humanHandoffSuggestion).toEqual({ reason: 'Caso complexo', crewName: 'Suporte Premium' })
    // Handoff NÃO foi executado — conversa continua aberta
    expect(repo.updateConversationStatus).not.toHaveBeenCalled()
  })
})
```

- [ ] **Passo 6.8: Rodar todos os testes do SendMessage**

```bash
npx vitest run tests/unit/domains/conversation/SendMessage.test.ts
```

Esperado: todos passando (incluindo os existentes).

- [ ] **Passo 6.9: Commit**

```bash
git add src/domains/conversation/use-cases/SendMessage.ts \
        tests/unit/domains/conversation/SendMessage.test.ts
git commit -m "feat(conversation): add suggest_human_handoff tool to SendMessage + TRANSFERRED_TO_HUMAN guard"
```

---

## Task 7: API Routes — accept + reject

**Files:**
- Create: `src/app/api/v1/conversations/[id]/human-handoff/accept/route.ts`
- Create: `src/app/api/v1/conversations/[id]/human-handoff/reject/route.ts`

- [ ] **Passo 7.1: Criar rota accept**

```typescript
// src/app/api/v1/conversations/[id]/human-handoff/accept/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getValidatedSession } from '@/infrastructure/auth/getValidatedSession'
import { di } from '@/infrastructure/di'
import { AppError } from '@/shared/errors/AppError'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getValidatedSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const contactPhone: string | undefined = body.contactPhone ?? undefined

  try {
    const result = await di.acceptHumanHandoff.execute({
      tenantId: session.tenantId,
      conversationId: id,
      contactPhone,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

- [ ] **Passo 7.2: Criar rota reject**

```typescript
// src/app/api/v1/conversations/[id]/human-handoff/reject/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getValidatedSession } from '@/infrastructure/auth/getValidatedSession'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getValidatedSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rejeição não precisa de use-case: apenas confirma que o cliente preferiu continuar
  return NextResponse.json({ success: true })
}
```

- [ ] **Passo 7.3: Commit**

```bash
git add src/app/api/v1/conversations/
git commit -m "feat(api): add human-handoff accept and reject routes"
```

---

## Task 8: DI wiring — registrar AcceptHumanHandoff e PrismaHumanHandoffRepository

**Files:**
- Modify: `src/infrastructure/di/index.ts`

- [ ] **Passo 8.1: Adicionar imports ao di/index.ts**

```typescript
import { AcceptHumanHandoff } from '@/domains/conversation/use-cases/AcceptHumanHandoff'
import { SuggestHumanHandoff } from '@/domains/conversation/use-cases/SuggestHumanHandoff'
import { PrismaHumanHandoffRepository } from '@/infrastructure/db/repositories/PrismaHumanHandoffRepository'
import { InMemoryHumanHandoffRepository } from '@/infrastructure/db/repositories/InMemoryHumanHandoffRepository'
```

- [ ] **Passo 8.2: Instanciar o repositório e use-cases**

Após o bloco onde `crewRepo` é definido (seguindo o padrão `usePrisma ? Prisma... : InMemory...`):

```typescript
const humanHandoffRepo = usePrisma
  ? new PrismaHumanHandoffRepository(prisma)
  : new InMemoryHumanHandoffRepository()
```

Adicionar ao objeto `di` (antes do fechamento do `}`):

```typescript
humanHandoffRepo,
acceptHumanHandoff: null as unknown as AcceptHumanHandoff, // late-bind below
suggestHumanHandoff: null as unknown as SuggestHumanHandoff, // late-bind below
```

- [ ] **Passo 8.3: Late-binding após criação do di (junto com sendMessage)**

Após o bloco de `di.sendMessage = new SendMessage(...)`, adicionar:

```typescript
const suggestHumanHandoff = new SuggestHumanHandoff(crewRepo)
di.suggestHumanHandoff = suggestHumanHandoff

di.acceptHumanHandoff = new AcceptHumanHandoff(
  conversationRepo,
  crewRepo,
  contactChannelIdentityRepo,
  humanHandoffRepo,
  new WhatsAppDispatcher(channelConfigRepo),
)
```

- [ ] **Passo 8.4: Passar `suggestHumanHandoff` para SendMessage**

Atualizar a instanciação de `di.sendMessage`:

```typescript
di.sendMessage = new SendMessage(
  conversationRepo,
  di.buildRAGContext,
  auditLogger,
  qualStateRepo,
  extractState,
  crewMemberRepo,
  di.transferConversation,
  agentRepo,
  getQualificationSchema,
  di.checkUsageLimit,
  di.recordUsage,
  new EmailDispatcher(channelConfigRepo),
  suggestHumanHandoff,       // novo parâmetro
)
```

- [ ] **Passo 8.5: Verificar que `contactChannelIdentityRepo` existe no DI**

```bash
grep -n "contactChannelIdentityRepo\|ContactChannelIdentity" src/infrastructure/di/index.ts | head -10
```

Se não existir, criar:

```typescript
const contactChannelIdentityRepo = usePrisma
  ? new PrismaContactChannelIdentityRepository(prisma)
  : new InMemoryContactChannelIdentityRepository()
```

E adicionar os imports necessários.

- [ ] **Passo 8.6: Build de verificação**

```bash
npx tsc --noEmit
```

Esperado: sem erros de tipo.

- [ ] **Passo 8.7: Rodar suite completa**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Passo 8.8: Commit**

```bash
git add src/infrastructure/di/index.ts
git commit -m "feat(di): wire AcceptHumanHandoff, SuggestHumanHandoff, PrismaHumanHandoffRepository"
```

---

## Task 9: Crew PATCH API — adicionar campos humanHandoff

**Files:**
- Modify: `src/app/api/v1/crews/[id]/route.ts` (ou arquivo PATCH da crew)
- Modify: `src/domains/crew/use-cases/UpdateCrew.ts` (se existir)

- [ ] **Passo 9.1: Localizar o endpoint PATCH de crews**

```bash
find src/app/api -name "route.ts" | xargs grep -l "crew" | head -10
```

- [ ] **Passo 9.2: Adicionar campos ao handler PATCH**

No handler PATCH, incluir os novos campos opcionais no corpo aceito:

```typescript
const {
  name,
  description,
  objective,
  status,
  humanHandoffWhatsappNumber,
  humanHandoffWebhookUrl,
} = body

// Passar para o use-case/repo de update:
await di.updateCrew.execute({
  tenantId: session.tenantId,
  id,
  data: {
    name,
    description,
    objective,
    status,
    humanHandoffWhatsappNumber: humanHandoffWhatsappNumber ?? undefined,
    humanHandoffWebhookUrl: humanHandoffWebhookUrl ?? undefined,
  },
})
```

- [ ] **Passo 9.3: Verificar que `ICrewRepository.update` passa os campos para o Prisma**

Abrir `src/infrastructure/db/repositories/PrismaCrewRepository.ts` e confirmar que o método `update` propaga todos os campos recebidos em `data`. Se não propagar, adicionar:

```typescript
async update(id: string, tenantId: string, data: Partial<UpdateCrewData>): Promise<Crew> {
  const row = await this.prisma.crew.update({
    where: { id, tenantId },
    data: {
      ...data, // inclui humanHandoffWhatsappNumber e humanHandoffWebhookUrl
      updatedAt: new Date(),
    },
  })
  return this.toDomain(row)
}
```

E garantir que `toDomain` mapeia os novos campos:

```typescript
private toDomain(row: any): Crew {
  return {
    ...
    humanHandoffWhatsappNumber: row.humanHandoffWhatsappNumber ?? null,
    humanHandoffWebhookUrl: row.humanHandoffWebhookUrl ?? null,
  }
}
```

- [ ] **Passo 9.4: Commit**

```bash
git add src/app/api/v1/crews/ src/infrastructure/db/repositories/PrismaCrewRepository.ts
git commit -m "feat(crew): expose humanHandoffWhatsappNumber and humanHandoffWebhookUrl in PATCH API"
```

---

## Task 10: UI — Seção "Escalada Humana" na página de detalhes da crew

> **OBRIGATÓRIO:** Antes de implementar esta task, invocar o skill `frontend-design:frontend-design` para definir o layout da seção "Escalada Humana" dentro da página de detalhes da crew. Descreva: formulário com dois campos (número WA + URL webhook opcional), preview do link gerado, estado vazio vs preenchido.

**Files:**
- Modify: `src/app/(dashboard)/crews/[id]/page.tsx` (ou componente de edição da crew)

- [ ] **Passo 10.1: Invocar frontend-design skill**

Invocar o skill com: "Seção 'Escalada Humana' na página de detalhes da crew. Dois campos: humanHandoffWhatsappNumber (input texto, formato +DDI...número) e humanHandoffWebhookUrl (input URL, opcional). Abaixo dos campos, preview do link wa.me gerado. Seguir Design System Gradient Shell (Inter, ciano→roxo)."

- [ ] **Passo 10.2: Implementar conforme design aprovado**

A seção deve:
- Exibir os valores atuais de `crew.humanHandoffWhatsappNumber` e `crew.humanHandoffWebhookUrl`
- Permitir edição via PATCH `/api/v1/crews/:id`
- Mostrar preview do link `wa.me/{numero}` quando número está preenchido
- Mostrar feedback de sucesso ao salvar

- [ ] **Passo 10.3: Commit**

```bash
git add src/app/\(dashboard\)/crews/
git commit -m "feat(ui): add Escalada Humana section to crew detail page"
```

---

## Task 11: Widget UX — quick replies + phone input + fallback link

> **OBRIGATÓRIO:** Antes de implementar esta task, invocar o skill `frontend-design:frontend-design` para definir os 3 estados do handoff no widget: (1) quick replies "Sim, transferir / Não", (2) input de telefone com botão confirmar + link "prefiro não informar", (3) tela de confirmação/link click-to-chat. Seguir Design System Gradient Shell.

**Files:**
- Modify: `src/components/chat/widget/` (componentes relevantes)

- [ ] **Passo 11.1: Invocar frontend-design skill**

Invocar o skill com: "3 estados do handoff no chat widget: (1) mensagem do agente + quick replies 'Sim, transferir' e 'Não, continuar aqui' (botões pill arredondados); (2) input telefone E.164 + botão Confirmar + link 'Prefiro não informar → falar no WhatsApp direto'; (3) mensagem de confirmação '✓ Transferência realizada! Você receberá mensagem no WhatsApp.' com chat desabilitado. Design Gradient Shell."

- [ ] **Passo 11.2: Detectar `humanHandoffSuggestion` na resposta da API**

Quando `SendMessage` retornar `humanHandoffSuggestion`, o componente de chat deve exibir o Estado 1 (quick replies) em vez do input normal.

- [ ] **Passo 11.3: Implementar fluxo de aceite**

- Ao clicar "Sim, transferir": 
  - Verificar se `contactPhone` é conhecido
  - Se sim: `POST /api/v1/conversations/:id/human-handoff/accept` (sem body)
  - Se não: exibir Estado 2 (input de telefone)
- Ao confirmar telefone: `POST /api/v1/conversations/:id/human-handoff/accept` com `{ contactPhone }`
- Ao clicar "Prefiro não informar": `POST /api/v1/conversations/:id/human-handoff/accept` (sem phone) → recebe `linkUrl` → exibir Estado 3 com botão wa.me
- Ao clicar "Não, continuar aqui": `POST /api/v1/conversations/:id/human-handoff/reject` → chat volta ao normal

- [ ] **Passo 11.4: Desabilitar input quando `TRANSFERRED_TO_HUMAN`**

Checar o status da conversa e exibir overlay de "Atendimento transferido. Verifique seu WhatsApp."

- [ ] **Passo 11.5: Commit**

```bash
git add src/components/chat/widget/
git commit -m "feat(widget): add human handoff UX — quick replies, phone input, fallback link"
```

---

## Verificação Final

- [ ] Rodar suite completa: `npx vitest run`
- [ ] Build sem erros: `npx tsc --noEmit` e `npx next build`
- [ ] Testar manualmente: configurar um número em uma crew, iniciar conversa, agente sugere handoff, aceitar com e sem número, verificar WA despachado

```bash
npx vitest run && npx tsc --noEmit
```

Esperado: todos os testes passando, zero erros de tipo.
