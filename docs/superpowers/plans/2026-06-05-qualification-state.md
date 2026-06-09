# QualificationState — Etapa 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent lead qualification state layer to the SDR agent so it never asks a lead for information it already collected — resolving the "repeating questions" problem.

**Architecture:** New `domains/qualification/` domain holds a `QualificationState` entity (per-conversation JSON blob with lead fields + current stage + last intent). `ExtractAndUpdateState` makes a gpt-4o-mini call after each user message to extract structured fields, then merges them into the existing state (never overwriting non-null with null). `SendMessage` loads/creates the state, runs extraction, then passes the updated state to `BuildRAGContext` which injects it as a `---ESTADO DA QUALIFICAÇÃO---` block in the system prompt.

**Tech Stack:** TypeScript, Vitest, existing `ILLMProvider` (OpenAI), module-level `Map` for in-memory storage.

---

## File Map

### New files
- `src/domains/qualification/entities/QualificationState.ts` — enums + entity types
- `src/domains/qualification/repositories/IQualificationStateRepository.ts` — interface
- `src/domains/qualification/use-cases/ExtractAndUpdateState.ts` — LLM extraction + merge
- `src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts` — in-memory impl
- `tests/unit/domains/qualification/InMemoryQualificationStateRepository.test.ts`
- `tests/unit/domains/qualification/ExtractAndUpdateState.test.ts`

### Modified files
- `src/domains/knowledge/use-cases/BuildRAGContext.ts` — add `qualificationState?` to input, inject into system prompt
- `src/domains/conversation/use-cases/SendMessage.ts` — add `qualStateRepo` + `extractState` deps, orchestrate new flow
- `src/infrastructure/di/index.ts` — wire up new repo + use case
- `tests/unit/domains/conversation/SendMessage.test.ts` — update constructor call + add qual-state-related assertions

---

## Task 1: QualificationState entity + repository interface

**Files:**
- Create: `src/domains/qualification/entities/QualificationState.ts`
- Create: `src/domains/qualification/repositories/IQualificationStateRepository.ts`

- [ ] **Step 1.1: Create the entity file**

```typescript
// src/domains/qualification/entities/QualificationState.ts

export const ConversationStage = {
  QUALIFYING: 'QUALIFYING',
  PRICE_INQUIRY: 'PRICE_INQUIRY',
  OBJECTION: 'OBJECTION',
  DEMO_SCHEDULED: 'DEMO_SCHEDULED',
  CONTACT_COLLECTED: 'CONTACT_COLLECTED',
  CLOSED: 'CLOSED',
} as const

export type ConversationStage = (typeof ConversationStage)[keyof typeof ConversationStage]

export const LeadIntent = {
  QUALIFICATION_ANSWER: 'QUALIFICATION_ANSWER',
  PRICE_INQUIRY: 'PRICE_INQUIRY',
  OBJECTION: 'OBJECTION',
  CONTACT_SHARED: 'CONTACT_SHARED',
  VIDEO_REQUEST: 'VIDEO_REQUEST',
  GREETING: 'GREETING',
  OTHER: 'OTHER',
} as const

export type LeadIntent = (typeof LeadIntent)[keyof typeof LeadIntent]

export type QualificationFields = {
  tipo_empresa: string | null
  numero_colaboradores: string | null
  usa_crm: string | null
  nome_contato: string | null
  telefone: string | null
  email: string | null
  nivel_interesse: string | null
  objecao: string | null
}

export type QualificationState = {
  id: string
  conversationId: string
  tenantId: string
  agentId: string
  stage: ConversationStage
  lastIntent: LeadIntent | null
  fields: QualificationFields
  updatedAt: Date
}

export type CreateQualificationStateData = {
  conversationId: string
  tenantId: string
  agentId: string
}

export type UpdateQualificationStateData = {
  stage?: ConversationStage
  lastIntent?: LeadIntent
  fields?: Partial<QualificationFields>
}
```

- [ ] **Step 1.2: Create the repository interface**

```typescript
// src/domains/qualification/repositories/IQualificationStateRepository.ts

import type {
  QualificationState,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '../entities/QualificationState'

export interface IQualificationStateRepository {
  findByConversation(conversationId: string, tenantId: string): Promise<QualificationState | null>
  create(data: CreateQualificationStateData): Promise<QualificationState>
  update(id: string, tenantId: string, data: UpdateQualificationStateData): Promise<QualificationState>
}
```

- [ ] **Step 1.3: Verify TypeScript compiles (no tests yet — pure types)**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to the new files.

- [ ] **Step 1.4: Commit**

```bash
git add src/domains/qualification/entities/QualificationState.ts src/domains/qualification/repositories/IQualificationStateRepository.ts
git commit -m "feat(qualification): add QualificationState entity + repository interface"
```

---

## Task 2: InMemoryQualificationStateRepository

**Files:**
- Create: `src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts`
- Create: `tests/unit/domains/qualification/InMemoryQualificationStateRepository.test.ts`

- [ ] **Step 2.1: Write the failing tests**

```typescript
// tests/unit/domains/qualification/InMemoryQualificationStateRepository.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { ConversationStage, LeadIntent } from '@/domains/qualification/entities/QualificationState'

describe('InMemoryQualificationStateRepository', () => {
  let repo: InMemoryQualificationStateRepository

  beforeEach(() => {
    repo = new InMemoryQualificationStateRepository()
    repo.clear()
  })

  it('create: deve criar estado inicial com campos nulos e stage QUALIFYING', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    expect(state.id).toBeDefined()
    expect(state.conversationId).toBe('conv-1')
    expect(state.tenantId).toBe('tenant-1')
    expect(state.agentId).toBe('agent-1')
    expect(state.stage).toBe(ConversationStage.QUALIFYING)
    expect(state.lastIntent).toBeNull()
    expect(state.fields.tipo_empresa).toBeNull()
    expect(state.fields.telefone).toBeNull()
    expect(state.fields.email).toBeNull()
  })

  it('findByConversation: deve retornar o estado correto pelo conversationId', async () => {
    await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-1', agentId: 'agent-1' })
    await repo.create({ conversationId: 'conv-2', tenantId: 'tenant-1', agentId: 'agent-1' })

    const found = await repo.findByConversation('conv-1', 'tenant-1')
    expect(found?.conversationId).toBe('conv-1')
  })

  it('findByConversation: deve retornar null para conversa inexistente', async () => {
    const found = await repo.findByConversation('nao-existe', 'tenant-1')
    expect(found).toBeNull()
  })

  it('findByConversation: isolamento — não retorna conversa de outro tenant', async () => {
    await repo.create({ conversationId: 'conv-1', tenantId: 'tenant-A', agentId: 'agent-1' })

    const found = await repo.findByConversation('conv-1', 'tenant-B')
    expect(found).toBeNull()
  })

  it('update: deve mesclar campos novos sem sobrescrever campos existentes com null', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    // Primeira atualização: define tipo_empresa
    const after1 = await repo.update(created.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliária' },
    })
    expect(after1.fields.tipo_empresa).toBe('imobiliária')

    // Segunda atualização: extraction retornou null para tipo_empresa — não deve sobrescrever
    const after2 = await repo.update(after1.id, 'tenant-1', {
      fields: { tipo_empresa: null, nome_contato: 'João Silva' },
    })
    expect(after2.fields.tipo_empresa).toBe('imobiliária')
    expect(after2.fields.nome_contato).toBe('João Silva')
  })

  it('update: deve atualizar stage e lastIntent', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    const updated = await repo.update(created.id, 'tenant-1', {
      stage: ConversationStage.PRICE_INQUIRY,
      lastIntent: LeadIntent.PRICE_INQUIRY,
    })

    expect(updated.stage).toBe(ConversationStage.PRICE_INQUIRY)
    expect(updated.lastIntent).toBe(LeadIntent.PRICE_INQUIRY)
  })

  it('update: deve lançar erro para estado de outro tenant', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })

    await expect(
      repo.update(created.id, 'tenant-outro', { stage: ConversationStage.CLOSED })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/qualification/InMemoryQualificationStateRepository.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'`

- [ ] **Step 2.3: Implement the repository**

```typescript
// src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts

import { randomUUID } from 'crypto'
import type {
  QualificationState,
  QualificationFields,
  CreateQualificationStateData,
  UpdateQualificationStateData,
} from '@/domains/qualification/entities/QualificationState'
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'

const store = new Map<string, QualificationState>()

function emptyFields(): QualificationFields {
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

function mergeFields(
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

export class InMemoryQualificationStateRepository implements IQualificationStateRepository {
  async findByConversation(
    conversationId: string,
    tenantId: string,
  ): Promise<QualificationState | null> {
    return (
      Array.from(store.values()).find(
        (s) => s.conversationId === conversationId && s.tenantId === tenantId,
      ) ?? null
    )
  }

  async create(data: CreateQualificationStateData): Promise<QualificationState> {
    const state: QualificationState = {
      id: randomUUID(),
      conversationId: data.conversationId,
      tenantId: data.tenantId,
      agentId: data.agentId,
      stage: ConversationStage.QUALIFYING,
      lastIntent: null,
      fields: emptyFields(),
      updatedAt: new Date(),
    }
    store.set(state.id, state)
    return state
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateQualificationStateData,
  ): Promise<QualificationState> {
    const state = store.get(id)
    if (!state || state.tenantId !== tenantId) {
      throw new Error('QualificationState not found')
    }
    const updated: QualificationState = {
      ...state,
      ...(data.stage !== undefined ? { stage: data.stage } : {}),
      ...(data.lastIntent !== undefined ? { lastIntent: data.lastIntent } : {}),
      fields: data.fields ? mergeFields(state.fields, data.fields) : state.fields,
      updatedAt: new Date(),
    }
    store.set(id, updated)
    return updated
  }

  clear(): void {
    store.clear()
  }
}
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/qualification/InMemoryQualificationStateRepository.test.ts 2>&1 | tail -10
```

Expected: PASS — all 7 tests green.

- [ ] **Step 2.5: Commit**

```bash
git add src/infrastructure/db/repositories/InMemoryQualificationStateRepository.ts tests/unit/domains/qualification/InMemoryQualificationStateRepository.test.ts
git commit -m "feat(qualification): add InMemoryQualificationStateRepository with merge semantics"
```

---

## Task 3: ExtractAndUpdateState use case

**Files:**
- Create: `src/domains/qualification/use-cases/ExtractAndUpdateState.ts`
- Create: `tests/unit/domains/qualification/ExtractAndUpdateState.test.ts`

- [ ] **Step 3.1: Write the failing tests**

```typescript
// tests/unit/domains/qualification/ExtractAndUpdateState.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import {
  ConversationStage,
  LeadIntent,
} from '@/domains/qualification/entities/QualificationState'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'

function makeLLM(responseContent: string): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: responseContent,
      model: 'gpt-4o-mini',
      tokensUsed: 50,
    }),
  }
}

describe('ExtractAndUpdateState', () => {
  let repo: InMemoryQualificationStateRepository

  beforeEach(() => {
    repo = new InMemoryQualificationStateRepository()
    repo.clear()
  })

  it('deve extrair campo tipo_empresa e atualizar o estado', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM(
      JSON.stringify({
        fields: { tipo_empresa: 'imobiliária' },
        intent: 'QUALIFICATION_ANSWER',
        stage: 'QUALIFYING',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)

    const updated = await uc.execute({ state, message: 'trabalhamos com imobiliária' })

    expect(updated.fields.tipo_empresa).toBe('imobiliária')
    expect(updated.lastIntent).toBe(LeadIntent.QUALIFICATION_ANSWER)
    expect(updated.stage).toBe(ConversationStage.QUALIFYING)
  })

  it('deve detectar intenção PRICE_INQUIRY e avançar o stage', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM(
      JSON.stringify({
        fields: {},
        intent: 'PRICE_INQUIRY',
        stage: 'PRICE_INQUIRY',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)

    const updated = await uc.execute({ state, message: 'quanto custa?' })

    expect(updated.lastIntent).toBe(LeadIntent.PRICE_INQUIRY)
    expect(updated.stage).toBe(ConversationStage.PRICE_INQUIRY)
  })

  it('não deve sobrescrever campo já coletado com null vindo da extração', async () => {
    const created = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    // Primeiro set: tipo_empresa definido
    const withField = await repo.update(created.id, 'tenant-1', {
      fields: { tipo_empresa: 'imobiliária' },
    })

    const llm = makeLLM(
      JSON.stringify({
        fields: { tipo_empresa: null, nome_contato: 'Ana' },
        intent: 'QUALIFICATION_ANSWER',
        stage: 'QUALIFYING',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, withField.tenantId as never)

    // Injeta repo manualmente (workaround — use internal constructor)
    const ucCorrect = new ExtractAndUpdateState(repo, llm)
    const updated = await ucCorrect.execute({ state: withField, message: 'meu nome é Ana' })

    expect(updated.fields.tipo_empresa).toBe('imobiliária')
    expect(updated.fields.nome_contato).toBe('Ana')
  })

  it('deve retornar o estado original sem modificações quando o LLM retorna JSON inválido', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM('não sou um JSON válido :-)')
    const uc = new ExtractAndUpdateState(repo, llm)

    const result = await uc.execute({ state, message: 'oi' })

    expect(result.id).toBe(state.id)
    expect(result.lastIntent).toBeNull()
  })

  it('deve retornar o estado original sem modificações quando o LLM falha', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm: ILLMProvider = {
      complete: vi.fn().mockRejectedValue(new Error('network error')),
    }
    const uc = new ExtractAndUpdateState(repo, llm)

    const result = await uc.execute({ state, message: 'oi' })

    expect(result.id).toBe(state.id)
  })

  it('deve mapear intent desconhecido para OTHER', async () => {
    const state = await repo.create({
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
    })
    const llm = makeLLM(
      JSON.stringify({
        fields: {},
        intent: 'VALOR_INEXISTENTE',
        stage: 'QUALIFYING',
      }),
    )
    const uc = new ExtractAndUpdateState(repo, llm)

    const updated = await uc.execute({ state, message: 'algo estranho' })

    expect(updated.lastIntent).toBe(LeadIntent.OTHER)
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/qualification/ExtractAndUpdateState.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/domains/qualification/use-cases/ExtractAndUpdateState'`

- [ ] **Step 3.3: Implement the use case**

```typescript
// src/domains/qualification/use-cases/ExtractAndUpdateState.ts

import type { IQualificationStateRepository } from '../repositories/IQualificationStateRepository'
import type { ILLMProvider } from '@/shared/types/ILLMProvider'
import type { QualificationState, QualificationFields } from '../entities/QualificationState'
import { ConversationStage, LeadIntent } from '../entities/QualificationState'

type ExtractAndUpdateStateInput = {
  state: QualificationState
  message: string
}

type ExtractionResult = {
  fields: Partial<QualificationFields>
  intent: string
  stage: string
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um extrator de dados estruturado para agente SDR.
Analise a mensagem do lead e retorne um JSON válido com:
- "fields": objeto com os campos extraídos (use null para campos não mencionados na mensagem)
- "intent": um de: QUALIFICATION_ANSWER, PRICE_INQUIRY, OBJECTION, CONTACT_SHARED, VIDEO_REQUEST, GREETING, OTHER
- "stage": um de: QUALIFYING, PRICE_INQUIRY, OBJECTION, DEMO_SCHEDULED, CONTACT_COLLECTED, CLOSED

Campos disponíveis: tipo_empresa, numero_colaboradores, usa_crm, nome_contato, telefone, email, nivel_interesse, objecao

Retorne APENAS o JSON, sem markdown, sem explicação.`

export class ExtractAndUpdateState {
  constructor(
    private repo: IQualificationStateRepository,
    private llmProvider: ILLMProvider,
  ) {}

  async execute(input: ExtractAndUpdateStateInput): Promise<QualificationState> {
    let extraction: ExtractionResult
    try {
      const result = await this.llmProvider.complete({
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: input.message }],
        model: 'gpt-4o-mini',
        maxTokens: 200,
      })
      extraction = JSON.parse(result.content) as ExtractionResult
    } catch {
      return input.state
    }

    const intent = (Object.values(LeadIntent) as string[]).includes(extraction.intent)
      ? (extraction.intent as LeadIntent)
      : LeadIntent.OTHER

    const stage = (Object.values(ConversationStage) as string[]).includes(extraction.stage)
      ? (extraction.stage as ConversationStage)
      : input.state.stage

    return this.repo.update(input.state.id, input.state.tenantId, {
      lastIntent: intent,
      stage,
      fields: extraction.fields ?? {},
    })
  }
}
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/qualification/ExtractAndUpdateState.test.ts 2>&1 | tail -10
```

Expected: PASS — all 6 tests green.

- [ ] **Step 3.5: Commit**

```bash
git add src/domains/qualification/use-cases/ExtractAndUpdateState.ts tests/unit/domains/qualification/ExtractAndUpdateState.test.ts
git commit -m "feat(qualification): add ExtractAndUpdateState use case with graceful LLM failure handling"
```

---

## Task 4: Inject QualificationState into BuildRAGContext

**Files:**
- Modify: `src/domains/knowledge/use-cases/BuildRAGContext.ts`

The change is purely additive: add `qualificationState?` to the input type and inject it into the system prompt between the base prompt and the KB section.

- [ ] **Step 4.1: Add import + extend input type**

In `src/domains/knowledge/use-cases/BuildRAGContext.ts`, add the import after the existing imports:

```typescript
import type { QualificationState } from '@/domains/qualification/entities/QualificationState'
```

Change `BuildRAGContextInput` to:

```typescript
type BuildRAGContextInput = {
  tenantId: string
  agentId: string
  message: string
  conversationHistory?: ConversationMessage[]
  qualificationState?: QualificationState
}
```

- [ ] **Step 4.2: Pass qualificationState to buildSystemPrompt**

In the `execute` method, change line 93 from:
```typescript
const systemPrompt = buildSystemPrompt(baseSystemPrompt, trimmedTenant, trimmedAgent)
```
to:
```typescript
const systemPrompt = buildSystemPrompt(baseSystemPrompt, trimmedTenant, trimmedAgent, input.qualificationState)
```

- [ ] **Step 4.3: Update the buildSystemPrompt helper**

Replace the existing `buildSystemPrompt` function with:

```typescript
function buildSystemPrompt(
  base: string,
  tenantChunks: VectorSearchResult[],
  agentChunks: VectorSearchResult[],
  qualificationState?: QualificationState,
): string {
  const parts: string[] = [base]

  if (qualificationState) {
    const nonNullFields = Object.entries(qualificationState.fields).filter(([, v]) => v !== null)
    parts.push('', '---ESTADO DA QUALIFICAÇÃO---')
    parts.push(`Estágio: ${qualificationState.stage}`)
    if (qualificationState.lastIntent) {
      parts.push(`Última intenção: ${qualificationState.lastIntent}`)
    }
    if (nonNullFields.length > 0) {
      parts.push('Dados coletados:')
      nonNullFields.forEach(([k, v]) => parts.push(`  ${k}: ${v}`))
    }
    parts.push('')
  }

  const hasKb = tenantChunks.length > 0 || agentChunks.length > 0
  if (hasKb) {
    parts.push('---CONHECIMENTO RELEVANTE---')
    if (tenantChunks.length > 0) {
      parts.push('[Base de Conhecimento]')
      tenantChunks.forEach((c) => parts.push(c.content))
      parts.push('')
    }
    if (agentChunks.length > 0) {
      parts.push('[Instruções Específicas]')
      agentChunks.forEach((c) => parts.push(c.content))
      parts.push('')
    }
  }

  return parts.join('\n')
}
```

- [ ] **Step 4.4: Verify TypeScript compiles**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4.5: Run full test suite to catch regressions**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run 2>&1 | tail -15
```

Expected: all previously passing tests still pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/domains/knowledge/use-cases/BuildRAGContext.ts
git commit -m "feat(qualification): inject QualificationState into RAG system prompt"
```

---

## Task 5: Update SendMessage to orchestrate qualification flow

**Files:**
- Modify: `src/domains/conversation/use-cases/SendMessage.ts`
- Modify: `tests/unit/domains/conversation/SendMessage.test.ts`

- [ ] **Step 5.1: Update SendMessage.test.ts — add mock deps and assertions**

In `tests/unit/domains/conversation/SendMessage.test.ts`:

Add this import at the top:
```typescript
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'
import type { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
import { ConversationStage } from '@/domains/qualification/entities/QualificationState'
```

Add these factory functions after `makeInput`:

```typescript
function makeQualState(overrides = {}) {
  return {
    id: 'qs-1',
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    stage: ConversationStage.QUALIFYING,
    lastIntent: null,
    fields: {
      tipo_empresa: null,
      numero_colaboradores: null,
      usa_crm: null,
      nome_contato: null,
      telefone: null,
      email: null,
      nivel_interesse: null,
      objecao: null,
    },
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeQualStateRepo(): IQualificationStateRepository {
  return {
    findByConversation: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeQualState()),
    update: vi.fn().mockResolvedValue(makeQualState()),
  }
}

function makeExtractState(): Pick<ExtractAndUpdateState, 'execute'> {
  return {
    execute: vi.fn().mockResolvedValue(makeQualState()),
  }
}
```

In the `beforeEach`, change the `useCase` construction from:
```typescript
useCase = new SendMessage(repo, ragContext as BuildRAGContext, auditLogger)
```
to:
```typescript
const qualStateRepo = makeQualStateRepo()
const extractState = makeExtractState()
useCase = new SendMessage(repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo, extractState as unknown as ExtractAndUpdateState)
```

Declare `qualStateRepo` and `extractState` at the describe-scope so tests can access them:

```typescript
describe('SendMessage', () => {
  let useCase: SendMessage
  let repo: IConversationRepository
  let ragContext: Pick<BuildRAGContext, 'execute'>
  let auditLogger: IAuditLogger
  let qualStateRepo: IQualificationStateRepository
  let extractState: Pick<ExtractAndUpdateState, 'execute'>

  beforeEach(() => {
    repo = makeRepo()
    ragContext = makeRAG()
    auditLogger = { log: vi.fn() }
    qualStateRepo = makeQualStateRepo()
    extractState = makeExtractState()
    useCase = new SendMessage(
      repo,
      ragContext as BuildRAGContext,
      auditLogger,
      qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
    )
  })
```

Add new test at the end of the describe block:

```typescript
  // ── QualificationState ───────────────────────────────────────────────────

  it('deve criar QualificationState na primeira mensagem de uma nova conversa', async () => {
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(null)

    await useCase.execute(makeInput())

    expect(qualStateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        agentId: 'agent-1',
      })
    )
  })

  it('deve reusar QualificationState existente em conversas subsequentes', async () => {
    const existing = makeQualState()
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(existing)

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(qualStateRepo.create).not.toHaveBeenCalled()
  })

  it('deve passar qualificationState para o RAG context', async () => {
    const state = makeQualState({ fields: { tipo_empresa: 'imobiliária' } })
    vi.mocked(qualStateRepo.findByConversation).mockResolvedValue(state)
    vi.mocked(extractState.execute).mockResolvedValue(state)

    await useCase.execute(makeInput({ conversationId: 'conv-1' }))

    expect(ragContext.execute).toHaveBeenCalledWith(
      expect.objectContaining({ qualificationState: state })
    )
  })
```

- [ ] **Step 5.2: Run the existing tests to confirm they fail at the constructor call**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/conversation/SendMessage.test.ts 2>&1 | tail -10
```

Expected: FAIL (tests still use old 3-param constructor; new 3 qual-state tests also fail).

- [ ] **Step 5.3: Update SendMessage.ts**

Add imports at the top of `src/domains/conversation/use-cases/SendMessage.ts`:

```typescript
import type { IQualificationStateRepository } from '@/domains/qualification/repositories/IQualificationStateRepository'
import type { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
```

Change the constructor to:

```typescript
export class SendMessage {
  constructor(
    private repo: IConversationRepository,
    private ragContext: BuildRAGContext,
    private auditLogger: IAuditLogger,
    private qualStateRepo: IQualificationStateRepository,
    private extractState: ExtractAndUpdateState,
  ) {}
```

In the `execute` method, insert a new block between step 4 (persist USER message) and step 5 (call RAG). Replace the comment `// 5. Call RAG — tolerant to LLM failure` and everything below it up to the closing brace. The new full step sequence starting at step 5:

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

    // 6. Extract and update state (non-critical — keep going if it fails)
    try {
      qualState = await this.extractState.execute({
        state: qualState,
        message: input.message.trim(),
      })
    } catch {
      // Extraction failure is non-fatal
    }

    // 7. Call RAG — tolerant to LLM failure
    let reply = ''
    let model = 'unknown'
    let tokensUsed = 0
    let chunksUsed: { layer: string; count: number; totalScore: number }[] = []
    let failed = false

    try {
      const ragResult = await this.ragContext.execute({
        tenantId: input.tenantId,
        agentId: input.agentId,
        message: input.message.trim(),
        conversationHistory,
        qualificationState: qualState,
      })
      reply = ragResult.reply
      model = ragResult.model
      tokensUsed = ragResult.tokensUsed
      chunksUsed = ragResult.chunksUsed
    } catch {
      failed = true
      reply = 'Desculpe, ocorreu um erro ao processar sua mensagem.'
    }

    // 8. Persist ASSISTANT message
    const assistantMessage = await this.repo.createMessage({
      conversationId,
      tenantId: input.tenantId,
      role: MessageRole.ASSISTANT,
      content: reply,
      metadata: failed ? { failed: true } : { model, tokensUsed, chunksUsed },
    })

    // 9. Auto-close if message limit reached
    const messageCount = await this.repo.countMessages(conversationId)
    if (messageCount >= MAX_MESSAGES) {
      await this.repo.closeConversation(conversationId, input.tenantId)
    }

    // 10. Audit log
    await this.auditLogger.log({
      action: 'conversation.message.sent',
      tenantId: input.tenantId,
      metadata: { agentId: input.agentId, conversationId, tokensUsed },
    })

    return {
      conversationId,
      messageId: assistantMessage.id,
      reply,
      model,
      tokensUsed,
      isNewConversation,
    }
```

- [ ] **Step 5.4: Run SendMessage tests**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run tests/unit/domains/conversation/SendMessage.test.ts 2>&1 | tail -15
```

Expected: PASS — all tests green including the 3 new qual-state ones.

- [ ] **Step 5.5: Commit**

```bash
git add src/domains/conversation/use-cases/SendMessage.ts tests/unit/domains/conversation/SendMessage.test.ts
git commit -m "feat(qualification): integrate QualificationState into SendMessage flow"
```

---

## Task 6: Wire DI container

**Files:**
- Modify: `src/infrastructure/di/index.ts`

- [ ] **Step 6.1: Add imports**

Add at the top of `src/infrastructure/di/index.ts` after the existing imports:

```typescript
import { InMemoryQualificationStateRepository } from '@/infrastructure/db/repositories/InMemoryQualificationStateRepository'
import { ExtractAndUpdateState } from '@/domains/qualification/use-cases/ExtractAndUpdateState'
```

- [ ] **Step 6.2: Add repository instantiation**

In the `// ─── Repositories ─────────────────────────────────────────────────────────────` block, add after `crewMemberRepo`:

```typescript
const qualStateRepo = new InMemoryQualificationStateRepository()
```

- [ ] **Step 6.3: Add use case instantiation + fix sendMessage wiring**

After the `const llmProvider = ...` block, add:

```typescript
const extractState = new ExtractAndUpdateState(qualStateRepo, llmProvider)
```

In the `di` object definition, update the `sendMessage` null placeholder comment and the final override at the bottom of the file:

Change:
```typescript
  sendMessage:             null as unknown as SendMessage,
```
(it stays as null in the object literal)

And change the bottom override from:
```typescript
di.sendMessage = new SendMessage(conversationRepo, di.buildRAGContext, auditLogger)
```
to:
```typescript
di.sendMessage = new SendMessage(conversationRepo, di.buildRAGContext, auditLogger, qualStateRepo, extractState)
```

- [ ] **Step 6.4: Verify TypeScript compiles**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6.5: Run full test suite**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6.6: Commit**

```bash
git add src/infrastructure/di/index.ts
git commit -m "feat(qualification): wire QualificationState repo + ExtractAndUpdateState into DI container"
```

---

## Task 7: Final verification

- [ ] **Step 7.1: Run the full test suite one last time**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx vitest run 2>&1 | tail -25
```

Expected: all tests pass, count >= previous count + 13 new tests.

- [ ] **Step 7.2: Type-check the full project**

```bash
cd /Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 7.3: Update CONTEXT.md**

In `CONTEXT.md`, add to the "O que está implementado" section:

```markdown
### QualificationState (Etapa 1)
- `domains/qualification/entities/QualificationState.ts` — enums ConversationStage + LeadIntent, QualificationFields, QualificationState entity
- `domains/qualification/repositories/IQualificationStateRepository.ts` — interface com findByConversation / create / update
- `domains/qualification/use-cases/ExtractAndUpdateState.ts` — chama gpt-4o-mini para extrair campos estruturados; merge sem sobrescrever campos não-nulos
- `infrastructure/db/repositories/InMemoryQualificationStateRepository.ts` — armazenamento in-memory com merge semantics
- `SendMessage` — carrega/cria estado, extrai campos após mensagem do usuário, passa estado para BuildRAGContext
- `BuildRAGContext` — injeta bloco `---ESTADO DA QUALIFICAÇÃO---` no system prompt quando estado presente
```

- [ ] **Step 7.4: Final commit**

```bash
git add CONTEXT.md
git commit -m "docs: update CONTEXT.md with QualificationState Etapa 1"
```

---

## Self-Review

### Spec coverage
| Requirement | Task |
|---|---|
| QualificationState entity + enums | Task 1 |
| IQualificationStateRepository interface | Task 1 |
| InMemoryQualificationStateRepository | Task 2 |
| Merge semantics (no null overwrite) | Task 2, step 2.3 |
| ExtractAndUpdateState (LLM call, JSON parse, graceful failure) | Task 3 |
| Intent mapping + unknown → OTHER | Task 3 |
| BuildRAGContext state injection | Task 4 |
| SendMessage orchestration (load → extract → RAG with state) | Task 5 |
| DI wiring | Task 6 |
| TDD throughout | All tasks |

### No placeholders: confirmed — every step has complete code.

### Type consistency
- `QualificationState` type imported consistently from `@/domains/qualification/entities/QualificationState`
- `IQualificationStateRepository` methods match: `findByConversation(conversationId, tenantId)`, `create(data)`, `update(id, tenantId, data)`
- `BuildRAGContextInput.qualificationState?: QualificationState` matches what `SendMessage` passes
- `ExtractAndUpdateState` constructor: `(repo: IQualificationStateRepository, llm: ILLMProvider)` — matches DI wiring in Task 6
