# Crew Test Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Test Lab" tab to `/dashboard/crews/:id` that lets operators and admins simulate WhatsApp conversations and visualize the full agent flow (who responded, handoffs, trace).

**Architecture:** New use-case `SimulateCrewMessage` calls `SendMessage` directly (bypassing the queue), then reads lifecycle events to reconstruct the flow path. API route `POST /api/v1/crews/:id/simulate` returns a `TestSessionResult` with reply, flowPath, handoffs and trace. Four UI components render the chat simulator (left panel) and flow diagram + trace accordion (right panel) inside a new tab on the crew detail page.

**Tech Stack:** TypeScript, Next.js 16 App Router, Vitest, Tailwind CSS 4, SVG (no React Flow), `@/lib/api.ts` client, existing `SendMessage` + `TransferConversation` + lifecycle repos.

---

## File Map

**New files:**
- `src/domains/crew/entities/TestSessionResult.ts` — types for the simulation result
- `src/domains/crew/use-cases/SimulateCrewMessage.ts` — core use-case
- `src/app/api/v1/crews/[id]/simulate/route.ts` — API route
- `src/components/crews/test-lab/CrewTestLab.tsx` — parent component
- `src/components/crews/test-lab/TestChatSimulator.tsx` — left panel (chat)
- `src/components/crews/test-lab/CrewFlowDiagram.tsx` — right panel top (SVG flow)
- `src/components/crews/test-lab/AgentTraceAccordion.tsx` — right panel bottom (trace)
- `tests/unit/crew/SimulateCrewMessage.test.ts` — unit tests
- `tests/integration/crew-simulate-route.test.ts` — integration tests

**Modified files:**
- `src/shared/utils/apiResponse.ts` — add new error codes
- `src/infrastructure/di/index.ts` — wire `SimulateCrewMessage`
- `src/lib/api.ts` — add `api.crews.simulate()`
- `src/app/(dashboard)/dashboard/crews/[id]/page.tsx` — add Test Lab tab

---

## Task 1: TestSessionResult type + new error codes

**Files:**
- Create: `src/domains/crew/entities/TestSessionResult.ts`
- Modify: `src/shared/utils/apiResponse.ts`

- [ ] **Step 1.1: Create `TestSessionResult.ts`**

```typescript
// src/domains/crew/entities/TestSessionResult.ts

export type FlowPathEntry = {
  agentId: string
  agentName: string
  agentType: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
  action: 'RESPONDED' | 'TRANSFERRED' | 'WAITING'
  responseSnippet?: string
  durationMs: number
}

export type HandoffEntry = {
  fromAgentId: string
  fromAgentName: string
  toAgentId: string
  toAgentName: string
  reason?: string
}

export type TraceStep = {
  step: string
  durationMs: number
  detail?: string
}

export type TestSessionTrace = {
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  durationMs: number
  memoryBlocksUsed: string[]
  chunksUsed: string[]
  steps?: TraceStep[]   // only for TENANT_ADMIN
}

export type TestSessionResult = {
  conversationId: string
  reply: string
  flowPath: FlowPathEntry[]
  handoffs: HandoffEntry[]
  trace: TestSessionTrace
}
```

- [ ] **Step 1.2: Add new error codes to `apiResponse.ts`**

Open `src/shared/utils/apiResponse.ts` and add to the `ERROR_STATUS` record (after the `CREW_HAS_MEMBERS` line):

```typescript
  CREW_HAS_NO_MEMBERS:             400,
  WHATSAPP_CHANNEL_NOT_CONFIGURED: 400,
```

- [ ] **Step 1.3: Commit**

```bash
git add src/domains/crew/entities/TestSessionResult.ts src/shared/utils/apiResponse.ts
git commit -m "feat(test-lab): add TestSessionResult types and error codes"
```

---

## Task 2: SimulateCrewMessage use-case — failing tests first

**Files:**
- Create: `tests/unit/crew/SimulateCrewMessage.test.ts`
- Create: `src/domains/crew/use-cases/SimulateCrewMessage.ts`

- [ ] **Step 2.1: Write failing tests**

```typescript
// tests/unit/crew/SimulateCrewMessage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SimulateCrewMessage } from '@/domains/crew/use-cases/SimulateCrewMessage'
import { AppError } from '@/shared/errors/AppError'

const TENANT_ID = 'tenant-1'
const CREW_ID = 'crew-1'
const AGENT_DIRECTOR_ID = 'agent-director'
const AGENT_MEMBER_ID = 'agent-member'

function makeCrew(overrides?: object) {
  return {
    id: CREW_ID,
    tenantId: TENANT_ID,
    name: 'SDR Devolus',
    slug: 'sdr-devolus',
    status: 'ACTIVE',
    departmentId: 'dept-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMember(agentId: string, role: 'DIRECTOR' | 'MEMBER', order: number) {
  return {
    id: `member-${agentId}`,
    crewId: CREW_ID,
    tenantId: TENANT_ID,
    agentId,
    role,
    order,
    isRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeAgent(id: string, name: string, type = 'SDR') {
  return { id, tenantId: TENANT_ID, name, type, status: 'ACTIVE', slug: id }
}

describe('SimulateCrewMessage', () => {
  let crewRepo: any
  let crewMemberRepo: any
  let agentRepo: any
  let sendMessage: any
  let lifecycleRepo: any
  let channelConfigRepo: any
  let useCase: SimulateCrewMessage

  beforeEach(() => {
    crewRepo = {
      findById: vi.fn().mockResolvedValue(makeCrew()),
    }
    crewMemberRepo = {
      findByCrewId: vi.fn().mockResolvedValue([
        makeMember(AGENT_DIRECTOR_ID, 'DIRECTOR', 1),
      ]),
    }
    agentRepo = {
      findById: vi.fn((id: string, _tenantId: string) =>
        Promise.resolve(makeAgent(id, id === AGENT_DIRECTOR_ID ? 'Receptor SDR' : 'Qualificador'))
      ),
    }
    sendMessage = {
      execute: vi.fn().mockResolvedValue({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        reply: 'Olá! Como posso ajudar?',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
        isNewConversation: true,
      }),
    }
    lifecycleRepo = {
      findByConversationId: vi.fn().mockResolvedValue([]),
    }
    channelConfigRepo = {
      findByTenantId: vi.fn().mockResolvedValue([]),
    }
    useCase = new SimulateCrewMessage(
      crewRepo, crewMemberRepo, agentRepo, sendMessage, lifecycleRepo, channelConfigRepo
    )
  })

  it('returns reply and flowPath with one agent for a crew with one member', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      crewId: CREW_ID,
      message: 'Olá',
      mode: 'SIMULATE',
    })

    expect(result.reply).toBe('Olá! Como posso ajudar?')
    expect(result.flowPath).toHaveLength(1)
    expect(result.flowPath[0].agentId).toBe(AGENT_DIRECTOR_ID)
    expect(result.flowPath[0].role).toBe('DIRECTOR')
    expect(result.flowPath[0].action).toBe('RESPONDED')
    expect(result.handoffs).toHaveLength(0)
  })

  it('throws CREW_HAS_NO_MEMBERS when crew has no members', async () => {
    crewMemberRepo.findByCrewId.mockResolvedValue([])

    await expect(
      useCase.execute({ tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE' })
    ).rejects.toThrow(new AppError('CREW_HAS_NO_MEMBERS', 'A Crew não tem agentes configurados'))
  })

  it('throws CREW_NOT_FOUND for crew of a different tenant', async () => {
    crewRepo.findById.mockResolvedValue(null)

    await expect(
      useCase.execute({ tenantId: 'other-tenant', crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE' })
    ).rejects.toThrow(new AppError('CREW_NOT_FOUND', 'Crew não encontrada'))
  })

  it('throws WHATSAPP_CHANNEL_NOT_CONFIGURED for WHATSAPP_REAL mode without channel', async () => {
    channelConfigRepo.findByTenantId.mockResolvedValue([])

    await expect(
      useCase.execute({
        tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá',
        mode: 'WHATSAPP_REAL', toPhone: '+5511999999999',
      })
    ).rejects.toThrow(new AppError('WHATSAPP_CHANNEL_NOT_CONFIGURED', 'Nenhum canal WhatsApp configurado para este tenant'))
  })

  it('builds handoffs from lifecycle events when TransferConversation was called', async () => {
    const secondMember = makeMember(AGENT_MEMBER_ID, 'MEMBER', 2)
    crewMemberRepo.findByCrewId.mockResolvedValue([
      makeMember(AGENT_DIRECTOR_ID, 'DIRECTOR', 1),
      secondMember,
    ])
    lifecycleRepo.findByConversationId.mockResolvedValue([{
      id: 'lc-1',
      conversationId: 'conv-1',
      fromStatus: 'ACTIVE',
      toStatus: 'ACTIVE',
      triggeredBy: 'AGENT',
      metadata: {
        type: 'TRANSFER',
        fromAgentId: AGENT_DIRECTOR_ID,
        toAgentId: AGENT_MEMBER_ID,
      },
      createdAt: new Date(),
    }])

    const result = await useCase.execute({
      tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE',
    })

    expect(result.handoffs).toHaveLength(1)
    expect(result.handoffs[0].fromAgentId).toBe(AGENT_DIRECTOR_ID)
    expect(result.handoffs[0].toAgentId).toBe(AGENT_MEMBER_ID)
  })

  it('includes trace with model and token info', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID, crewId: CREW_ID, message: 'Olá', mode: 'SIMULATE',
    })

    expect(result.trace.model).toBe('gpt-4o-mini')
    expect(result.trace.inputTokens).toBeGreaterThanOrEqual(0)
    expect(result.trace.outputTokens).toBeGreaterThanOrEqual(0)
    expect(result.trace.durationMs).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
npm run test -- tests/unit/crew/SimulateCrewMessage.test.ts
```

Expected: FAIL — `SimulateCrewMessage` not found.

- [ ] **Step 2.3: Implement `SimulateCrewMessage`**

```typescript
// src/domains/crew/use-cases/SimulateCrewMessage.ts
import { AppError } from '@/shared/errors/AppError'
import type { ICrewRepository } from '../repositories/ICrewRepository'
import type { ICrewMemberRepository } from '../repositories/ICrewMemberRepository'
import type { IAgentRepository } from '@/domains/agent/repositories/IAgentRepository'
import type { SendMessage } from '@/domains/conversation/use-cases/SendMessage'
import type { IConversationLifecycleRepository } from '@/domains/conversation-lifecycle/repositories/IConversationLifecycleRepository'
import type { IChannelConfigRepository } from '@/domains/channel/repositories/IChannelConfigRepository'
import type { TestSessionResult, FlowPathEntry, HandoffEntry } from '../entities/TestSessionResult'
import { estimateCost } from '@/domains/observability/entities/AgentExecutionTrace'

type SimulateInput = {
  tenantId: string
  crewId: string
  message: string
  mode: 'SIMULATE' | 'WHATSAPP_REAL'
  toPhone?: string
  isAdmin?: boolean
}

export class SimulateCrewMessage {
  constructor(
    private crewRepo: ICrewRepository,
    private crewMemberRepo: ICrewMemberRepository,
    private agentRepo: IAgentRepository,
    private sendMessage: SendMessage,
    private lifecycleRepo: IConversationLifecycleRepository,
    private channelConfigRepo: IChannelConfigRepository,
  ) {}

  async execute(input: SimulateInput): Promise<TestSessionResult> {
    // 1. Validate crew ownership
    const crew = await this.crewRepo.findById(input.crewId, input.tenantId)
    if (!crew) throw new AppError('CREW_NOT_FOUND', 'Crew não encontrada')

    // 2. Validate members
    const members = await this.crewMemberRepo.findByCrewId(input.crewId, input.tenantId)
    if (!members || members.length === 0) {
      throw new AppError('CREW_HAS_NO_MEMBERS', 'A Crew não tem agentes configurados')
    }

    // 3. For WHATSAPP_REAL: validate channel exists
    if (input.mode === 'WHATSAPP_REAL') {
      const channels = await this.channelConfigRepo.findByTenantId(input.tenantId)
      const waChannel = channels.find((c) => c.provider === 'WHATSAPP')
      if (!waChannel) {
        throw new AppError('WHATSAPP_CHANNEL_NOT_CONFIGURED', 'Nenhum canal WhatsApp configurado para este tenant')
      }
    }

    // 4. Select director agent (or first member by order)
    const director = members.find((m) => m.role === 'DIRECTOR') ?? members[0]

    const startTime = Date.now()

    // 5. Execute SendMessage
    const result = await this.sendMessage.execute({
      tenantId: input.tenantId,
      agentId: director.agentId,
      message: input.message,
      crewId: input.crewId,
    })

    const durationMs = Date.now() - startTime

    // 6. Load agent details for all members (for names/types)
    const agentDetails = await Promise.all(
      members.map((m) => this.agentRepo.findById(m.agentId, input.tenantId))
    )
    const agentMap = new Map(
      agentDetails
        .filter(Boolean)
        .map((a) => [a!.id, a!])
    )

    // 7. Read lifecycle events to detect handoffs
    const lifecycleEvents = await this.lifecycleRepo.findByConversationId(
      result.conversationId,
      input.tenantId,
    )

    const handoffs: HandoffEntry[] = lifecycleEvents
      .filter((e) => e.metadata?.type === 'TRANSFER')
      .map((e) => {
        const from = agentMap.get(e.metadata.fromAgentId as string)
        const to = agentMap.get(e.metadata.toAgentId as string)
        return {
          fromAgentId: e.metadata.fromAgentId as string,
          fromAgentName: from?.name ?? 'Agente desconhecido',
          toAgentId: e.metadata.toAgentId as string,
          toAgentName: to?.name ?? 'Agente desconhecido',
          reason: e.metadata.reason as string | undefined,
        }
      })

    // 8. Build flowPath
    const flowPath: FlowPathEntry[] = []

    // Director entry
    const directorAgent = agentMap.get(director.agentId)
    flowPath.push({
      agentId: director.agentId,
      agentName: directorAgent?.name ?? 'Agente',
      agentType: (directorAgent as any)?.type ?? 'UNKNOWN',
      role: director.role as 'DIRECTOR' | 'MEMBER' | 'OBSERVER',
      action: handoffs.length > 0 ? 'TRANSFERRED' : 'RESPONDED',
      responseSnippet: handoffs.length === 0 ? result.reply.slice(0, 120) : undefined,
      durationMs,
    })

    // Transferred-to agents
    for (const handoff of handoffs) {
      const toMember = members.find((m) => m.agentId === handoff.toAgentId)
      const toAgent = agentMap.get(handoff.toAgentId)
      flowPath.push({
        agentId: handoff.toAgentId,
        agentName: handoff.toAgentName,
        agentType: (toAgent as any)?.type ?? 'UNKNOWN',
        role: (toMember?.role ?? 'MEMBER') as 'DIRECTOR' | 'MEMBER' | 'OBSERVER',
        action: 'WAITING',
        durationMs: 0,
      })
    }

    // Update last agent in flowPath to RESPONDED
    if (flowPath.length > 0) {
      flowPath[flowPath.length - 1].action = 'RESPONDED'
      flowPath[flowPath.length - 1].responseSnippet = result.reply.slice(0, 120)
    }

    // 9. Build trace
    const inputTokens = Math.floor((result.tokensUsed ?? 0) * 0.8)
    const outputTokens = Math.floor((result.tokensUsed ?? 0) * 0.2)

    const trace = {
      model: result.model ?? 'gpt-4o-mini',
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(result.model ?? 'gpt-4o-mini', inputTokens, outputTokens),
      durationMs,
      memoryBlocksUsed: ['buffer'],
      chunksUsed: [],
      steps: input.isAdmin
        ? [
            { step: 'CREW_VALIDATION', durationMs: 5, detail: `Crew: ${crew.name}` },
            { step: 'MEMBER_RESOLUTION', durationMs: 3, detail: `Director: ${directorAgent?.name}` },
            { step: 'LLM_CALL', durationMs: durationMs - 10, detail: `Model: ${result.model}` },
          ]
        : undefined,
    }

    return {
      conversationId: result.conversationId,
      reply: result.reply,
      flowPath,
      handoffs,
      trace,
    }
  }
}
```

- [ ] **Step 2.4: Check what `IConversationLifecycleRepository.findByConversationId` signature looks like**

```bash
grep -r "findByConversationId" /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/src --include="*.ts" | head -10
```

If the method signature differs from `(conversationId: string, tenantId: string)`, adjust the call in `SimulateCrewMessage.ts` to match the actual interface.

- [ ] **Step 2.5: Run tests to confirm they pass**

```bash
npm run test -- tests/unit/crew/SimulateCrewMessage.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 2.6: Commit**

```bash
git add tests/unit/crew/SimulateCrewMessage.test.ts src/domains/crew/use-cases/SimulateCrewMessage.ts
git commit -m "feat(test-lab): add SimulateCrewMessage use-case with TDD"
```

---

## Task 3: API route + DI wiring + integration tests

**Files:**
- Create: `src/app/api/v1/crews/[id]/simulate/route.ts`
- Modify: `src/infrastructure/di/index.ts`
- Create: `tests/integration/crew-simulate-route.test.ts`

- [ ] **Step 3.1: Wire `SimulateCrewMessage` in DI container**

Open `src/infrastructure/di/index.ts`. Add import at top (after existing crew imports):

```typescript
import { SimulateCrewMessage } from '@/domains/crew/use-cases/SimulateCrewMessage'
```

Add to the exports object (after `getCrewMetrics`):

```typescript
simulateCrewMessage: new SimulateCrewMessage(
  crewRepo,
  crewMemberRepo,
  agentRepo,
  sendMessage,
  conversationLifecycleRepo,
  channelConfigRepo,
),
```

**Note:** Check that `conversationLifecycleRepo` and `channelConfigRepo` are already named exports in the DI container. Run `grep -n "lifecycleRepo\|channelConfigRepo" src/infrastructure/di/index.ts` to verify names, and use the exact variable names found.

- [ ] **Step 3.2: Write integration tests**

```typescript
// tests/integration/crew-simulate-route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { SimulateCrewMessage } from '@/domains/crew/use-cases/SimulateCrewMessage'
import { AppError } from '@/shared/errors/AppError'

describe('SimulateCrewMessage — integration edge cases', () => {
  it('returns 422-like error for empty message', async () => {
    const crewRepo = { findById: vi.fn().mockResolvedValue({ id: 'c1', tenantId: 't1', name: 'X', status: 'ACTIVE' }) }
    const crewMemberRepo = { findByCrewId: vi.fn().mockResolvedValue([{ agentId: 'a1', role: 'DIRECTOR', order: 1 }]) }
    const agentRepo = { findById: vi.fn().mockResolvedValue({ id: 'a1', name: 'SDR', type: 'SDR', status: 'ACTIVE' }) }
    const sendMessage = {
      execute: vi.fn().mockRejectedValue(new AppError('VALIDATION_ERROR', 'A mensagem não pode ser vazia.')),
    }
    const lifecycleRepo = { findByConversationId: vi.fn().mockResolvedValue([]) }
    const channelConfigRepo = { findByTenantId: vi.fn().mockResolvedValue([]) }

    const uc = new SimulateCrewMessage(
      crewRepo as any, crewMemberRepo as any, agentRepo as any,
      sendMessage as any, lifecycleRepo as any, channelConfigRepo as any
    )

    await expect(
      uc.execute({ tenantId: 't1', crewId: 'c1', message: '', mode: 'SIMULATE' })
    ).rejects.toThrow('A mensagem não pode ser vazia.')
  })

  it('does not expose crew of another tenant', async () => {
    const crewRepo = { findById: vi.fn().mockResolvedValue(null) }
    const crewMemberRepo = { findByCrewId: vi.fn() }
    const agentRepo = { findById: vi.fn() }
    const sendMessage = { execute: vi.fn() }
    const lifecycleRepo = { findByConversationId: vi.fn() }
    const channelConfigRepo = { findByTenantId: vi.fn() }

    const uc = new SimulateCrewMessage(
      crewRepo as any, crewMemberRepo as any, agentRepo as any,
      sendMessage as any, lifecycleRepo as any, channelConfigRepo as any
    )

    await expect(
      uc.execute({ tenantId: 'other-tenant', crewId: 'crew-belongs-to-tenant-1', message: 'hi', mode: 'SIMULATE' })
    ).rejects.toThrow(new AppError('CREW_NOT_FOUND', 'Crew não encontrada'))
  })
})
```

- [ ] **Step 3.3: Run integration tests**

```bash
npm run test -- tests/integration/crew-simulate-route.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 3.4: Create API route**

```typescript
// src/app/api/v1/crews/[id]/simulate/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { di } from '@/infrastructure/di'
import { errorResponse } from '@/shared/utils/apiResponse'
import { getValidatedSession as getSession } from '@/infrastructure/guards/withValidatedSession'

const schema = z.object({
  message: z.string().min(1, 'Mensagem não pode ser vazia').max(2000),
  mode: z.enum(['SIMULATE', 'WHATSAPP_REAL']),
  toPhone: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [session, { id }, body] = await Promise.all([
      getSession(request),
      params,
      request.json(),
    ])

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    if (parsed.data.mode === 'WHATSAPP_REAL' && !parsed.data.toPhone) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'toPhone é obrigatório no modo WHATSAPP_REAL' },
        { status: 422 },
      )
    }

    const isAdmin = session.role === 'TENANT_ADMIN' || session.role === 'PLATFORM_ADMIN'

    const result = await di.simulateCrewMessage.execute({
      tenantId: session.tenantId!,
      crewId: id,
      message: parsed.data.message,
      mode: parsed.data.mode,
      toPhone: parsed.data.toPhone,
      isAdmin,
    })

    return Response.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

- [ ] **Step 3.5: Run all tests**

```bash
npm run test
```

Expected: all existing tests still PASS, new tests PASS.

- [ ] **Step 3.6: Commit**

```bash
git add src/app/api/v1/crews/[id]/simulate/route.ts src/infrastructure/di/index.ts tests/integration/crew-simulate-route.test.ts
git commit -m "feat(test-lab): add POST /api/v1/crews/:id/simulate route"
```

---

## Task 4: Add `api.crews.simulate()` to the client

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 4.1: Add simulate method**

Open `src/lib/api.ts`. Find the `crews` block and add after `getMetrics`:

```typescript
simulate: (id: string, data: { message: string; mode: 'SIMULATE' | 'WHATSAPP_REAL'; toPhone?: string }) =>
  request<TestSessionResult>(`/crews/${id}/simulate`, { method: 'POST', body: JSON.stringify(data) }),
```

Also add the import for `TestSessionResult` at the top of the file (or in the types section if api.ts has one):

```typescript
import type { TestSessionResult } from '@/domains/crew/entities/TestSessionResult'
```

- [ ] **Step 4.2: Run all tests to confirm no regressions**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(test-lab): add api.crews.simulate client method"
```

---

## Task 5: `AgentTraceAccordion` component

**Files:**
- Create: `src/components/crews/test-lab/AgentTraceAccordion.tsx`

- [ ] **Step 5.1: Create the component**

```typescript
// src/components/crews/test-lab/AgentTraceAccordion.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { TestSessionTrace } from '@/domains/crew/entities/TestSessionResult'

type Props = {
  trace: TestSessionTrace | null
  isAdmin: boolean
}

export function AgentTraceAccordion({ trace, isAdmin }: Props) {
  const [open, setOpen] = useState(false)

  if (!trace) return null

  return (
    <div className="border-t border-border bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="font-semibold text-foreground flex items-center gap-2">
          🔍 Trace Detalhado {isAdmin && <span className="text-xs font-normal text-muted-foreground">(Admin)</span>}
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{trace.durationMs}ms total</span>
          <span>{trace.inputTokens + trace.outputTokens} tokens</span>
          <span>${trace.estimatedCostUsd.toFixed(6)}</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Modelo</div>
              <div className="font-mono font-semibold">{trace.model}</div>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Tokens (entrada / saída)</div>
              <div className="font-mono font-semibold">{trace.inputTokens} / {trace.outputTokens}</div>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Custo estimado</div>
              <div className="font-mono font-semibold">${trace.estimatedCostUsd.toFixed(6)}</div>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-muted-foreground mb-1">Duração total</div>
              <div className="font-mono font-semibold">{trace.durationMs}ms</div>
            </div>
          </div>

          {isAdmin && trace.steps && trace.steps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Pipeline steps</div>
              <div className="space-y-1">
                {trace.steps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-2">
                    <span className="font-mono text-foreground">{step.step}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {step.detail && <span className="italic">{step.detail}</span>}
                      <span className="font-semibold">{step.durationMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trace.memoryBlocksUsed.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Memória usada: {trace.memoryBlocksUsed.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/crews/test-lab/AgentTraceAccordion.tsx
git commit -m "feat(test-lab): add AgentTraceAccordion component"
```

---

## Task 6: `CrewFlowDiagram` component

**Files:**
- Create: `src/components/crews/test-lab/CrewFlowDiagram.tsx`

- [ ] **Step 6.1: Create the component**

```typescript
// src/components/crews/test-lab/CrewFlowDiagram.tsx
'use client'

import type { FlowPathEntry, HandoffEntry } from '@/domains/crew/entities/TestSessionResult'

type CrewMember = {
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}

type Props = {
  members: CrewMember[]
  flowPath: FlowPathEntry[]
  handoffs: HandoffEntry[]
  isRunning: boolean
}

export function CrewFlowDiagram({ members, flowPath, handoffs, isRunning }: Props) {
  const visitedIds = new Set(flowPath.map((f) => f.agentId))

  function nodeColor(member: CrewMember): string {
    if (!visitedIds.has(member.agentId)) return '#e5e7eb'  // grey — not visited
    return member.role === 'DIRECTOR' ? '#4F6EF7' : '#7C3AED'
  }

  function nodeTextColor(member: CrewMember): string {
    return visitedIds.has(member.agentId) ? '#ffffff' : '#6b7280'
  }

  function getBadge(member: CrewMember): string | null {
    const entry = flowPath.find((f) => f.agentId === member.agentId)
    if (!entry) return null
    if (entry.action === 'RESPONDED') return `✓ ${entry.durationMs}ms`
    if (entry.action === 'TRANSFERRED') return '⇄'
    if (entry.action === 'WAITING' && isRunning) return '⏳'
    return null
  }

  const NODE_W = 200
  const NODE_H = 44
  const ENTRY_H = 32
  const HARNESS_H = 32
  const GAP = 48
  const TRANSFER_H = 28
  const SVG_W = 340

  // Total height: entry + harness + members
  const memberCount = members.length
  // Each member: node + gap + (transfer badge between members)
  const membersHeight = memberCount * NODE_H + (memberCount - 1) * (GAP + TRANSFER_H)
  const totalH = ENTRY_H + GAP + HARNESS_H + GAP + membersHeight + 24

  const cx = SVG_W / 2
  let y = 16

  const entryY = y
  y += ENTRY_H + GAP
  const harnessY = y
  y += HARNESS_H + GAP

  const memberNodes = members.map((m, i) => {
    const nodeY = y
    y += NODE_H
    if (i < members.length - 1) y += GAP + TRANSFER_H
    return { member: m, y: nodeY }
  })

  return (
    <div className="flex-1 overflow-auto p-4 bg-muted/20 flex justify-center">
      <svg width={SVG_W} height={totalH} viewBox={`0 0 ${SVG_W} ${totalH}`} className="overflow-visible">

        {/* Entry node */}
        <rect x={cx - NODE_W / 2} y={entryY} width={NODE_W} height={ENTRY_H} rx={16} fill="#06C8E8" />
        <text x={cx} y={entryY + ENTRY_H / 2 + 5} textAnchor="middle" fontSize={11} fontWeight="600" fill="#fff">
          📥 WhatsApp
        </text>

        {/* Line entry → harness */}
        <line x1={cx} y1={entryY + ENTRY_H} x2={cx} y2={harnessY} stroke="#4F6EF7" strokeWidth={2} />

        {/* Harness node */}
        <rect x={cx - NODE_W / 2} y={harnessY} width={NODE_W} height={HARNESS_H} rx={6}
          fill="rgba(79,110,247,0.06)" stroke="#4F6EF7" strokeWidth={1.5} strokeDasharray="5,3" />
        <text x={cx} y={harnessY + HARNESS_H / 2 + 5} textAnchor="middle" fontSize={10} fill="#4F6EF7" fontWeight="600">
          Harness · idempotência OK
        </text>

        {/* Lines + nodes for members */}
        {memberNodes.map(({ member, y: my }, i) => {
          const isVisited = visitedIds.has(member.agentId)
          const badge = getBadge(member)
          const transferEntry = handoffs.find((h) => h.toAgentId === member.agentId)
          const prevY = i === 0 ? harnessY + HARNESS_H : memberNodes[i - 1].y + NODE_H

          return (
            <g key={member.agentId} opacity={isVisited ? 1 : 0.35}>
              {/* Line from previous node */}
              <line x1={cx} y1={prevY} x2={cx} y2={my} stroke={isVisited ? '#4F6EF7' : '#d1d5db'} strokeWidth={2} />

              {/* Transfer label between nodes */}
              {i > 0 && (
                <g>
                  <rect x={cx - 80} y={prevY + (my - prevY) / 2 - 11} width={160} height={22} rx={11}
                    fill={transferEntry ? '#f3f0ff' : '#f3f4f6'} />
                  <text x={cx} y={prevY + (my - prevY) / 2 + 5} textAnchor="middle" fontSize={10}
                    fill={transferEntry ? '#7C3AED' : '#9ca3af'} fontWeight="600">
                    {transferEntry ? '⇄ TransferConversation' : '↓'}
                  </text>
                </g>
              )}

              {/* Agent node */}
              <rect x={cx - NODE_W / 2} y={my} width={NODE_W} height={NODE_H} rx={10}
                fill={nodeColor(member)}
                style={{ filter: isVisited ? 'drop-shadow(0 3px 8px rgba(79,110,247,0.3))' : 'none' }} />
              <text x={cx} y={my + NODE_H / 2 - 4} textAnchor="middle" fontSize={12}
                fontWeight="700" fill={nodeTextColor(member)}>
                🤖 {member.agentName}
              </text>
              <text x={cx} y={my + NODE_H / 2 + 11} textAnchor="middle" fontSize={10}
                fill={isVisited ? 'rgba(255,255,255,0.8)' : '#9ca3af'}>
                {member.role}
              </text>

              {/* Badge */}
              {badge && (
                <g>
                  <rect x={cx + NODE_W / 2 - 52} y={my - 10} width={52} height={20} rx={10}
                    fill={badge.startsWith('✓') ? '#22c55e' : '#f59e0b'} />
                  <text x={cx + NODE_W / 2 - 26} y={my + 5} textAnchor="middle" fontSize={9}
                    fontWeight="700" fill="#fff">
                    {badge}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/crews/test-lab/CrewFlowDiagram.tsx
git commit -m "feat(test-lab): add CrewFlowDiagram SVG component"
```

---

## Task 7: `TestChatSimulator` component

**Files:**
- Create: `src/components/crews/test-lab/TestChatSimulator.tsx`

- [ ] **Step 7.1: Create the component**

```typescript
// src/components/crews/test-lab/TestChatSimulator.tsx
'use client'

import { useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  text: string
  agentName?: string
  agentRole?: string
  isHandoff?: boolean
  handoffTo?: string
}

type Props = {
  messages: ChatMessage[]
  mode: 'SIMULATE' | 'WHATSAPP_REAL'
  toPhone: string
  input: string
  isLoading: boolean
  error: string | null
  onModeChange: (mode: 'SIMULATE' | 'WHATSAPP_REAL') => void
  onPhoneChange: (phone: string) => void
  onInputChange: (text: string) => void
  onSend: () => void
}

export function TestChatSimulator({
  messages, mode, toPhone, input, isLoading, error,
  onModeChange, onPhoneChange, onInputChange, onSend,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex flex-col h-full border-r border-border">

      {/* Mode toggle */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Modo de teste</div>
        <div className="flex gap-2">
          <button
            onClick={() => onModeChange('SIMULATE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === 'SIMULATE'
                ? 'bg-[#4F6EF7] text-white'
                : 'bg-background border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            ⚡ Simular
          </button>
          <button
            onClick={() => onModeChange('WHATSAPP_REAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === 'WHATSAPP_REAL'
                ? 'bg-[#25D366] text-white'
                : 'bg-background border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            📱 WhatsApp Real
          </button>
        </div>
        {mode === 'WHATSAPP_REAL' && (
          <div className="mt-2">
            <Input
              placeholder="Seu número: +5511999999999"
              value={toPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="text-xs h-8"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use o número provisório da Meta (+1 555 555 5555) para testes
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f0f2f5] dark:bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground pt-8">
            <div className="text-2xl mb-2">🧪</div>
            <p>Digite uma mensagem para iniciar o teste</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.isHandoff) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs font-semibold text-[#7C3AED] bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full">
                  ⇄ Transferido para {msg.handoffTo}
                </span>
              </div>
            )
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-[#dcf8c6] dark:bg-green-900/50 rounded-xl rounded-br-sm px-3 py-2 max-w-[75%] shadow-sm">
                  <p className="text-sm text-foreground">{msg.text}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className="flex flex-col gap-1">
              {msg.agentName && (
                <span className="text-xs font-semibold pl-1" style={{
                  color: msg.agentRole === 'DIRECTOR' ? '#4F6EF7' : '#7C3AED'
                }}>
                  🤖 {msg.agentName}
                </span>
              )}
              <div className="bg-white dark:bg-card rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%] shadow-sm">
                <p className="text-sm text-foreground">{msg.text}</p>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex flex-col gap-1">
            <div className="bg-white dark:bg-card rounded-xl rounded-tl-sm px-3 py-2 w-16 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2 text-center">
            ⚠️ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-[#f0f2f5] dark:bg-muted/20 flex gap-2">
        <Input
          placeholder="Digite uma mensagem de teste..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 text-sm bg-white dark:bg-card"
        />
        <Button
          onClick={onSend}
          disabled={isLoading || !input.trim()}
          size="sm"
          className="bg-gradient-to-r from-[#06C8E8] via-[#4F6EF7] to-[#7C3AED] text-white hover:opacity-90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/components/crews/test-lab/TestChatSimulator.tsx
git commit -m "feat(test-lab): add TestChatSimulator component"
```

---

## Task 8: `CrewTestLab` parent component

**Files:**
- Create: `src/components/crews/test-lab/CrewTestLab.tsx`

- [ ] **Step 8.1: Create the parent component**

```typescript
// src/components/crews/test-lab/CrewTestLab.tsx
'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { TestChatSimulator, type ChatMessage } from './TestChatSimulator'
import { CrewFlowDiagram } from './CrewFlowDiagram'
import { AgentTraceAccordion } from './AgentTraceAccordion'
import type { TestSessionTrace, FlowPathEntry, HandoffEntry } from '@/domains/crew/entities/TestSessionResult'

type CrewMember = {
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}

type Props = {
  crewId: string
  crewStatus: string
  members: CrewMember[]
  isAdmin: boolean
}

export function CrewTestLab({ crewId, crewStatus, members, isAdmin }: Props) {
  const [mode, setMode] = useState<'SIMULATE' | 'WHATSAPP_REAL'>('SIMULATE')
  const [toPhone, setToPhone] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flowPath, setFlowPath] = useState<FlowPathEntry[]>([])
  const [handoffs, setHandoffs] = useState<HandoffEntry[]>([])
  const [trace, setTrace] = useState<TestSessionTrace | null>(null)
  const [viewMode, setViewMode] = useState<'flow' | 'trace'>('flow')

  const noMembers = members.length === 0

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const result = await api.crews.simulate(crewId, {
        message: userMsg.text,
        mode,
        toPhone: mode === 'WHATSAPP_REAL' ? toPhone : undefined,
      })

      setFlowPath(result.flowPath)
      setHandoffs(result.handoffs)
      setTrace(result.trace)

      // Insert handoff badges into the chat
      const newMessages: ChatMessage[] = []
      for (let i = 0; i < result.handoffs.length; i++) {
        newMessages.push({
          id: crypto.randomUUID(),
          role: 'agent',
          text: '',
          isHandoff: true,
          handoffTo: result.handoffs[i].toAgentName,
        })
      }

      const respondingAgent = result.flowPath.find((f) => f.action === 'RESPONDED')
      newMessages.push({
        id: crypto.randomUUID(),
        role: 'agent',
        text: result.reply,
        agentName: respondingAgent?.agentName,
        agentRole: respondingAgent?.role,
      })

      setMessages((prev) => [...prev, ...newMessages])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao processar mensagem')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, crewId, mode, toPhone])

  return (
    <div className="flex flex-col h-full">
      {/* Warnings */}
      {(crewStatus === 'DRAFT' || crewStatus === 'ARCHIVED') && (
        <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-800">
          ⚠️ Esta Crew não está ativa — os resultados do teste podem não refletir o comportamento em produção.
        </div>
      )}
      {noMembers && (
        <div className="px-4 py-2 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-800">
          ⛔ Adicione agentes à Crew antes de testar.
        </div>
      )}

      {/* Main panels */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Chat */}
        <div className="w-[360px] flex-shrink-0 flex flex-col min-h-0">
          <TestChatSimulator
            messages={messages}
            mode={mode}
            toPhone={toPhone}
            input={input}
            isLoading={isLoading}
            error={error}
            onModeChange={setMode}
            onPhoneChange={setToPhone}
            onInputChange={setInput}
            onSend={handleSend}
          />
        </div>

        {/* Right: Flow + Trace */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* View toggle */}
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-semibold text-foreground">Visualização do Fluxo</span>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('flow')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  viewMode === 'flow' ? 'bg-[#4F6EF7] text-white' : 'bg-background border border-border text-muted-foreground'
                }`}
              >
                Flow
              </button>
              <button
                onClick={() => setViewMode('trace')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  viewMode === 'trace' ? 'bg-[#4F6EF7] text-white' : 'bg-background border border-border text-muted-foreground'
                }`}
              >
                Trace
              </button>
            </div>
          </div>

          {/* Flow diagram */}
          <div className={`flex-1 overflow-auto ${viewMode !== 'flow' ? 'hidden' : ''}`}>
            <CrewFlowDiagram
              members={members}
              flowPath={flowPath}
              handoffs={handoffs}
              isRunning={isLoading}
            />
          </div>

          {/* Raw trace view */}
          {viewMode === 'trace' && (
            <div className="flex-1 overflow-auto p-4">
              {!trace ? (
                <p className="text-xs text-muted-foreground text-center pt-8">Envie uma mensagem para ver o trace.</p>
              ) : (
                <pre className="text-xs font-mono bg-muted/30 rounded-md p-4 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(trace, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Trace accordion */}
          <AgentTraceAccordion trace={trace} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2: Commit**

```bash
git add src/components/crews/test-lab/CrewTestLab.tsx
git commit -m "feat(test-lab): add CrewTestLab parent component"
```

---

## Task 9: Add Test Lab tab to crew detail page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/crews/[id]/page.tsx`

- [ ] **Step 9.1: Understand current page structure**

Open `src/app/(dashboard)/dashboard/crews/[id]/page.tsx` and read it fully. The current page is `EditCrewPage` — an edit form with crew fields and a `VisualWorkflowBuilder`. We will add a tab bar that wraps the existing edit form in a "Visão Geral" tab and adds "Test Lab" as a new tab.

- [ ] **Step 9.2: Add tab state and Test Lab tab**

At the top of the file, add the `CrewTestLab` import:

```typescript
import { CrewTestLab } from '@/components/crews/test-lab/CrewTestLab'
```

Inside the component, add tab state (after existing `useState` calls):

```typescript
const [activeTab, setActiveTab] = useState<'overview' | 'testlab'>('overview')
const [members, setMembers] = useState<Array<{ agentId: string; agentName: string; role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER' }>>([])
const [isAdmin] = useState(false) // TODO: derive from session role once exposed in client
```

Load members alongside the crew data. Find the `useEffect` that calls `api.crews.get(id)` and extend it:

```typescript
useEffect(() => {
  api.crews.get(id as string)
    .then((res) => {
      const crew = res.crew
      setName(crew.name)
      setObjective(crew.objective ?? '')
      setDescription(crew.description ?? '')
      setStatus(crew.status)
      // Map members to the shape CrewTestLab expects
      const mappedMembers = (res.members ?? []).map((m: any) => ({
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
```

- [ ] **Step 9.3: Add tab bar to the JSX**

In the return statement, after the crew header (the `<h1>` or back button row), and before the form, add the tab bar:

```tsx
{/* Tab bar */}
<div className="flex border-b border-border mb-6 -mx-6 px-6">
  <button
    onClick={() => setActiveTab('overview')}
    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
      activeTab === 'overview'
        ? 'border-[#4F6EF7] text-[#4F6EF7]'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`}
  >
    Visão Geral
  </button>
  <button
    onClick={() => setActiveTab('testlab')}
    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
      activeTab === 'testlab'
        ? 'border-[#4F6EF7] text-[#4F6EF7]'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`}
  >
    🧪 Test Lab
  </button>
</div>
```

Wrap the existing form in `{activeTab === 'overview' && (...)}` and add the Test Lab panel:

```tsx
{activeTab === 'testlab' && (
  <div className="-mx-6 -mb-6" style={{ height: 'calc(100vh - 200px)' }}>
    <CrewTestLab
      crewId={id as string}
      crewStatus={status}
      members={members}
      isAdmin={isAdmin}
    />
  </div>
)}
```

- [ ] **Step 9.4: Run all tests**

```bash
npm run test
```

Expected: all tests PASS (no regressions — no existing tests cover the page component directly).

- [ ] **Step 9.5: Start dev server and test manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard/crews/<any-id>`. Verify:
1. "Test Lab" tab appears in the tab bar
2. Clicking the tab shows the two-panel layout
3. Typing a message in Simular mode and pressing Enter calls the API
4. Bolhas aparecem no chat com o nome do agente
5. Flow diagram atualiza após a resposta (agente processado destacado)
6. Trace accordion expande ao clicar

- [ ] **Step 9.6: Commit**

```bash
git add src/app/(dashboard)/dashboard/crews/[id]/page.tsx
git commit -m "feat(test-lab): add Test Lab tab to crew detail page"
```

---

## Task 10: Final wiring check + full test run

- [ ] **Step 10.1: Run all tests**

```bash
npm run test
```

Expected: all tests PASS. If any fail, fix before proceeding.

- [ ] **Step 10.2: Verify API route is reachable**

```bash
# With dev server running in another terminal:
curl -s -X POST http://localhost:3000/api/v1/crews/nonexistent/simulate \
  -H "Content-Type: application/json" \
  -d '{"message":"test","mode":"SIMULATE"}' | jq .
```

Expected: `{ "code": "UNAUTHORIZED" }` or `{ "code": "SESSION_EXPIRED" }` (auth guard working).

- [ ] **Step 10.3: Check TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10.4: Final commit**

```bash
git add -A
git commit -m "feat(test-lab): complete Crew Test Lab — simulate + flow diagram + trace accordion"
```
