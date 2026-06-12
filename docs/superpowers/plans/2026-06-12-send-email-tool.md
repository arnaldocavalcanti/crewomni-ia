# send_email Tool for Agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `send_email` agent tool that lets the LLM compose and dispatch a real email (via SendGrid) based on conversation history, with clear error feedback when the channel is not configured.

**Architecture:** `SendMessage` gains an optional `emailDispatcher` dependency and registers the `send_email` tool alongside `transfer_conversation`. When the LLM calls the tool, `EmailDispatcher.send()` is invoked; on success the LLM's pre-generated reply is preserved, on failure the reply is overridden with an explicit error message.

**Tech Stack:** TypeScript, Vitest, existing `IChannelDispatcher` / `EmailDispatcher` (SendGrid)

---

## File Map

| File | Action |
|------|--------|
| `src/domains/conversation/use-cases/SendMessage.ts` | Add `emailDispatcher?: IChannelDispatcher` param; register `send_email` tool; handle tool call |
| `src/infrastructure/di/index.ts` | Inject `new EmailDispatcher(channelConfigRepo)` into `SendMessage` |
| `tests/unit/domains/conversation/SendMessage.test.ts` | Add 3 tests: send success, send failure (not configured), missing `to` field |

---

## Task 1: Add `emailDispatcher` dependency to `SendMessage`

**Files:**
- Modify: `src/domains/conversation/use-cases/SendMessage.ts`

- [ ] **Step 1.1 — Add import and optional constructor parameter**

In `SendMessage.ts`, add the import at the top and extend the constructor:

```typescript
// Add this import near the top (after existing imports)
import type { IChannelDispatcher } from '@/infrastructure/channel/IChannelDispatcher'
```

Change the constructor signature to add `emailDispatcher` as the last optional parameter:

```typescript
  constructor(
    private repo: IConversationRepository,
    private ragContext: BuildRAGContext,
    private auditLogger: IAuditLogger,
    private qualStateRepo: IQualificationStateRepository,
    private extractState: ExtractAndUpdateState,
    private crewMemberRepo: ICrewMemberRepository,
    private transferConversation: TransferConversation,
    private agentRepo: IAgentRepository,
    private getQualificationSchema?: GetQualificationSchema,
    private checkUsageLimit?: { execute(input: { tenantId: string }): Promise<{ allowed: boolean; reason?: string }> },
    private recordUsage?: { execute(input: { tenantId: string, inputTokens: number, outputTokens: number, estimatedCostUsd: number }): Promise<void> },
    private emailDispatcher?: IChannelDispatcher,
  ) {}
```

- [ ] **Step 1.2 — Register the `send_email` tool when dispatcher is available**

In `SendMessage.ts`, find the block that builds `tools` (around line 142–159). After the existing `transfer_conversation` tool definition, add `send_email`:

```typescript
    if (crewMembers.length > 0) {
      tools = [
        {
          type: 'function',
          function: {
            name: 'transfer_conversation',
            description: 'Transfere a conversa atual para outro membro da equipe especializado em um assunto.',
            parameters: {
              type: 'object',
              properties: {
                targetAgentSlug: { type: 'string', description: 'O identificador (slug) do agente alvo.' },
              },
              required: ['targetAgentSlug'],
            },
          },
        },
      ]
    }

    // send_email is always offered when the dispatcher is injected (crew or solo agent)
    if (this.emailDispatcher) {
      tools = tools ?? []
      tools.push({
        type: 'function',
        function: {
          name: 'send_email',
          description: 'Envia um email para o lead com conteúdo gerado a partir do histórico da conversa.',
          parameters: {
            type: 'object',
            properties: {
              to:      { type: 'string', description: 'Endereço de email do destinatário.' },
              subject: { type: 'string', description: 'Assunto do email.' },
              body:    { type: 'string', description: 'Corpo do email em texto puro.' },
            },
            required: ['to', 'subject', 'body'],
          },
        },
      })
    }
```

- [ ] **Step 1.3 — Handle the `send_email` tool call after the `transfer_conversation` handler**

In the `toolCalls` loop (inside the `if (ragResult[0].status === 'fulfilled')` block), add a new branch after the `transfer_conversation` handler:

```typescript
          if (tc.function?.name === 'send_email') {
            try {
              const args = JSON.parse(tc.function.arguments)
              const { to, subject, body } = args
              if (to && subject && body && this.emailDispatcher) {
                const dispatchResult = await this.emailDispatcher.send({
                  tenantId: input.tenantId,
                  conversationId,
                  to,
                  text: body,
                  metadata: { subject },
                })
                if (!dispatchResult.success) {
                  // Override LLM reply with explicit error — user chose Option A
                  reply = `Não foi possível enviar o email: ${dispatchResult.error ?? 'canal não configurado'}.`
                }
                // On success: keep the LLM's pre-generated reply (or the global fallback below)
              }
            } catch (e) {
              console.error('Failed to parse or execute send_email tool call:', e)
            }
          }
```

- [ ] **Step 1.4 — Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

Expected: no errors related to `SendMessage.ts`.

- [ ] **Step 1.5 — Commit**

```bash
git add src/domains/conversation/use-cases/SendMessage.ts
git commit -m "feat(agent): add send_email tool to SendMessage use-case"
```

---

## Task 2: Wire `EmailDispatcher` into the DI container

**Files:**
- Modify: `src/infrastructure/di/index.ts`

- [ ] **Step 2.1 — Inject `EmailDispatcher` into `SendMessage`**

Find the `di.sendMessage = new SendMessage(...)` block (around line 346) and add the email dispatcher as the last argument:

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
  new EmailDispatcher(channelConfigRepo),  // ← add this line
)
```

`EmailDispatcher` is already imported at the top of `di/index.ts` (line 102). No new import needed.

- [ ] **Step 2.2 — Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

Expected: no errors.

- [ ] **Step 2.3 — Commit**

```bash
git add src/infrastructure/di/index.ts
git commit -m "feat(di): inject EmailDispatcher into SendMessage"
```

---

## Task 3: Tests for `send_email` tool

**Files:**
- Modify: `tests/unit/domains/conversation/SendMessage.test.ts`

- [ ] **Step 3.1 — Add `emailDispatcher` mock and three tests**

At the end of `SendMessage.test.ts` (before the closing `})`), add:

```typescript
  // ── send_email tool ───────────────────────────────────────────────────────

  it('deve chamar emailDispatcher quando LLM acionar a tool send_email com sucesso', async () => {
    const emailDispatcher = { send: vi.fn().mockResolvedValue({ success: true, providerId: 'msg-abc' }) }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: 'Enviei o email com o link do vídeo para você!',
      model: 'gpt-4o',
      tokensUsed: 80,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          arguments: JSON.stringify({
            to: 'lead@example.com',
            subject: 'Vídeo App Devolus',
            body: 'Segue o link do vídeo conforme combinado.',
          }),
        },
      }],
    })

    const result = await useCase.execute(makeInput())

    expect(emailDispatcher.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        to: 'lead@example.com',
        text: 'Segue o link do vídeo conforme combinado.',
        metadata: expect.objectContaining({ subject: 'Vídeo App Devolus' }),
      })
    )
    // LLM reply preserved on success
    expect(result.reply).toBe('Enviei o email com o link do vídeo para você!')
  })

  it('deve substituir reply por mensagem de erro quando emailDispatcher falhar', async () => {
    const emailDispatcher = {
      send: vi.fn().mockResolvedValue({ success: false, error: 'MISSING_CREDENTIALS' }),
    }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: 'Já estou enviando o email!',
      model: 'gpt-4o',
      tokensUsed: 50,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          arguments: JSON.stringify({
            to: 'lead@example.com',
            subject: 'Assunto',
            body: 'Corpo',
          }),
        },
      }],
    })

    const result = await useCase.execute(makeInput())

    // Failure overrides whatever the LLM said
    expect(result.reply).toContain('Não foi possível enviar o email')
    expect(result.reply).toContain('MISSING_CREDENTIALS')
  })

  it('não deve chamar emailDispatcher quando parâmetros obrigatórios estiverem ausentes', async () => {
    const emailDispatcher = { send: vi.fn().mockResolvedValue({ success: true }) }
    useCase = new SendMessage(
      repo, ragContext as BuildRAGContext, auditLogger, qualStateRepo,
      extractState as unknown as ExtractAndUpdateState,
      crewMemberRepo, transferConversation, agentRepo,
      undefined, undefined, undefined,
      emailDispatcher,
    )

    vi.mocked(ragContext.execute).mockResolvedValue({
      reply: '',
      model: 'gpt-4o',
      tokensUsed: 30,
      chunksUsed: [],
      toolCalls: [{
        function: {
          name: 'send_email',
          // missing 'to'
          arguments: JSON.stringify({ subject: 'Assunto', body: 'Corpo' }),
        },
      }],
    })

    await useCase.execute(makeInput())

    expect(emailDispatcher.send).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3.2 — Run the new tests (expect failure first)**

```bash
npx vitest run tests/unit/domains/conversation/SendMessage.test.ts 2>&1 | tail -20
```

Expected: 3 new tests FAIL (tool not implemented yet if running before Task 1) — or PASS if Tasks 1–2 are already done.

- [ ] **Step 3.3 — Run full unit test suite**

```bash
npx vitest run tests/unit 2>&1 | tail -15
```

Expected: all tests pass, 0 failures.

- [ ] **Step 3.4 — Commit**

```bash
git add tests/unit/domains/conversation/SendMessage.test.ts
git commit -m "test(agent): add send_email tool tests for SendMessage"
```

---

## Task 4: Final verification

- [ ] **Step 4.1 — Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all test files pass.

- [ ] **Step 4.2 — TypeScript clean**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

Expected: no output (zero errors in project source).

- [ ] **Step 4.3 — Push**

```bash
git push origin main
```

---

## Manual verification checklist (Test Lab)

After deploying / running `npm run dev`:

1. Configure canal EMAIL no tenant (via `/dashboard/channels`) com uma SendGrid API key válida + `fromAddress`
2. Abrir o Test Lab de uma crew que contenha um "Especialista em Email"
3. Simular o fluxo SDR → lead fornece email → SDR transfere para Especialista
4. Especialista deve chamar `send_email` → email deve chegar na caixa do destinatário
5. Testar sem canal configurado → resposta do agente deve conter "Não foi possível enviar o email"
