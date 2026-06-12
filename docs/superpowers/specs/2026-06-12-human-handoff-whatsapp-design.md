# Human Handoff via WhatsApp Business Bot

**Data:** 2026-06-12  
**Status:** Aprovado  
**Feature:** Transferência de conversa AI → WhatsApp Business bot humano por crew

---

## Contexto

Quando um agente AI de uma crew não consegue resolver uma solicitação, ele deve poder sugerir que o cliente seja atendido por um humano via WhatsApp Business bot. Cada crew pode ter seu próprio bot configurado. O cliente aceita ou rejeita a sugestão diretamente no chat.

---

## Canais suportados

A feature funciona tanto para clientes no widget web quanto no WhatsApp:

| Canal do cliente | Número WA conhecido? | Ação |
|---|---|---|
| WhatsApp | Sim (sempre) | WA proativo direto |
| Widget web | Sim (Contact já tem) | WA proativo direto |
| Widget web | Não | Pede número → WA / fallback link |

---

## Fluxo completo

```
[Agente AI detecta necessidade]
  → chama tool suggest_human_handoff(reason)
  → SendMessage sinaliza sugestão na resposta (não executa handoff)
  → Chat exibe quick replies: "👍 Sim, transferir" / "Não, continuar aqui"

[Cliente aceita]
  → POST /api/v1/conversations/:id/human-handoff/accept
  → Sistema verifica contactPhone em ContactChannelIdentity
    → Conhecido: dispara WA proativo ao cliente + WA ao bot da crew
    → Não conhecido:
        → Chat exibe input de telefone
        → Cliente informa → salva no Contact → dispara WA ao cliente + bot
        → Cliente recusa informar → exibe link click-to-chat para o número do bot

[Pós-handoff]
  → Conversation.status = TRANSFERRED_TO_HUMAN
  → AI para de responder (SendMessage retorna cedo)
  → Se crew.humanHandoffWebhookUrl existir → dispara webhook JSON adicional
```

---

## Modelo de dados

### Prisma schema — mudanças

```prisma
model Crew {
  // campos existentes...
  humanHandoffWhatsappNumber String?  // ex: "+5511999990000"
  humanHandoffWebhookUrl     String?  // opcional: URL para n8n/ManyChat/etc.
}

enum ConversationStatus {
  // valores existentes...
  TRANSFERRED_TO_HUMAN
}

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

### Entidade de domínio

```typescript
// src/domains/conversation/entities/HumanHandoff.ts
type HumanHandoff = {
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

---

## Tool LLM

```typescript
{
  name: "suggest_human_handoff",
  description: "Use quando o cliente precisar de atendimento humano especializado que vai além da sua capacidade. Só use se a crew tiver suporte humano configurado.",
  parameters: {
    reason: { type: "string", description: "Por que está sugerindo a transferência" }
  }
}
```

**Comportamento no SendMessage:**
- Quando o agente chama `suggest_human_handoff`, `SendMessage` **não executa o handoff** — apenas inclui a sugestão na resposta para o cliente aceitar ou rejeitar.
- Antes de registrar a tool, `SuggestHumanHandoff` verifica se `crew.humanHandoffWhatsappNumber` está configurado. Se não estiver, a tool não é oferecida ao agente.

---

## Use-cases

### `SuggestHumanHandoff`
- Valida se a crew tem `humanHandoffWhatsappNumber` configurado
- Retorna `{ canSuggest: boolean, crewName: string, reason: string }`
- Chamado internamente pelo `SendMessage` ao processar a tool call

### `AcceptHumanHandoff`
Acionado pelo endpoint `POST /api/v1/conversations/:id/human-handoff/accept`:

1. Carrega `Conversation` + `Crew` + `Contact`
2. Resolve `contactPhone` via `ContactChannelIdentity` ou parâmetro `body.contactPhone`
3. Gera resumo da conversa (últimas 10 mensagens formatadas)
4. **Dispatch WA ao cliente** (se `contactPhone` disponível):
   > "Você foi transferido para [crew.name]. Nossa equipe entrará em contato em breve via WhatsApp."
5. **Dispatch WA ao bot da crew** (`crew.humanHandoffWhatsappNumber`):
   > "HANDOFF\nCliente: [nome] [telefone]\nResumo: [texto]\nÚltimas msgs: [transcript]"
6. **Webhook JSON** (se `crew.humanHandoffWebhookUrl` presente):
   ```json
   {
     "contactName": "string",
     "contactPhone": "string",
     "crewName": "string",
     "crewSlug": "string",
     "reason": "string",
     "summary": "string",
     "transcript": [{ "role": "user|assistant", "content": "string", "createdAt": "ISO" }]
   }
   ```
7. Persiste `HumanHandoff`
8. Atualiza `Conversation.status = TRANSFERRED_TO_HUMAN`
9. Retorna `{ success: true, channel: "whatsapp" | "link", linkUrl?: string }`

---

## API

```
POST /api/v1/conversations/:id/human-handoff/accept
  Body: { contactPhone?: string }
  Response: { success, channel: "whatsapp" | "link", linkUrl?: string }

POST /api/v1/conversations/:id/human-handoff/reject
  Response: { success: true }
  → Apenas registra rejeição; conversa continua com AI normalmente
```

---

## UX do widget — 3 estados

### Estado 1 — Sugestão (quando agente chama a tool)
```
[Msg do agente]: "Sua dúvida precisa de atenção especializada..."
[Quick replies]: 👍 Sim, transferir  |  Não, continuar aqui
```

### Estado 2a — Sem número WA (após aceitar)
```
[Sistema]: "Para continuar pelo WhatsApp, qual é o seu número?"
[Campo telefone + botão Confirmar]
[Link]: "Prefiro não informar → falar no WhatsApp direto"
```

### Estado 2b — Com número WA (vai direto)
```
[Sistema]: "✓ Transferência realizada! Você receberá uma mensagem no WhatsApp em instantes."
[Chat desabilitado — campo de input oculto, AI não responde]
```

### Estado 3 — Fallback (recusou informar número)
```
[Sistema]: "Tudo bem! Você pode continuar pelo WhatsApp:"
[Botão]: "💬 Falar com [crew.name]"
→ wa.me/{numero}?text=Olá,+preciso+de+ajuda+[resumo_encoded]
```

---

## Proteção no SendMessage

```typescript
// No início de SendMessage.execute()
if (conversation.status === 'TRANSFERRED_TO_HUMAN') {
  return { skipped: true, reason: 'transferred_to_human' }
}
```

---

## Config na tela da crew

Nova seção **"Escalada Humana"** na página de detalhes da crew:
- Campo: "Número WhatsApp Business" (com código do país, ex: +5511999990000)
- Campo opcional: "Webhook URL para notificação (n8n, ManyChat, etc.)"
- Preview do link click-to-chat gerado

---

## Testes (TDD obrigatório)

### `AcceptHumanHandoff.test.ts`
- Cliente com número WA conhecido → dispatcha WA ao cliente + bot, persiste HumanHandoff
- Cliente sem número, fornece agora → salva Contact, dispatcha normalmente
- Cliente sem número, recusa → retorna `{ channel: "link", linkUrl }`, não dispatcha WA
- Crew sem `humanHandoffWhatsappNumber` → lança erro de pré-condição
- Crew com `humanHandoffWebhookUrl` → POST JSON disparado
- Crew sem `humanHandoffWebhookUrl` → nenhum POST externo

### `SendMessage.test.ts` (adições)
- `conversation.status = TRANSFERRED_TO_HUMAN` → retorna sem chamar LLM
- Agente chama `suggest_human_handoff` → resposta com flag de sugestão, handoff não executado

### `SuggestHumanHandoff.test.ts`
- Crew com número configurado → `canSuggest: true`
- Crew sem número → `canSuggest: false`, tool não registrada

### Integração (widget)
- Quick replies aparecem quando flag de sugestão presente
- Input de telefone valida formato E.164 antes de submeter
- Link click-to-chat gerado com texto pré-preenchido codificado

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar campos Crew + enum + model HumanHandoff |
| `src/domains/conversation/entities/HumanHandoff.ts` | Criar |
| `src/domains/conversation/use-cases/SuggestHumanHandoff.ts` | Criar |
| `src/domains/conversation/use-cases/AcceptHumanHandoff.ts` | Criar |
| `src/domains/conversation/use-cases/SendMessage.ts` | Adicionar tool + guard status |
| `src/app/api/v1/conversations/[id]/human-handoff/accept/route.ts` | Criar |
| `src/app/api/v1/conversations/[id]/human-handoff/reject/route.ts` | Criar |
| `src/app/(dashboard)/crews/[id]/page.tsx` | Seção "Escalada Humana" |
| `src/components/chat/widget/` | Quick replies + estados de handoff |
| `tests/unit/domains/conversation/AcceptHumanHandoff.test.ts` | Criar |
| `tests/unit/domains/conversation/SuggestHumanHandoff.test.ts` | Criar |
