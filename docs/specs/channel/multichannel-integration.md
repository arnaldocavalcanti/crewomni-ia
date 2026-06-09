# Integração Multicanal — WhatsApp & E-mail (Fase 3.2)

> **Status:** APPROVED
> **Domínio:** channel
> **Autor:** @crewomni-ia
> **Data:** 2026-06-08

---

## 1. Objetivo

Integrar WhatsApp (Meta Cloud API) e e-mail como canais de entrada e saída da plataforma, usando a Agent Harness Core (Fase 2.2) como intermediária — os canais nunca chamam agentes diretamente.

---

## 2. Contexto de negócio

A plataforma já tem toda a lógica de orquestração de agentes via `OrchestrateInboundMessage`. Falta conectar canais reais (WhatsApp, e-mail) a essa harness. Os tenants-piloto (Devolus, Fast4Sign) precisam atender leads via WhatsApp como canal primário e e-mail como secundário.

---

## 3. Problema que resolve

- **Sem WhatsApp:** tenants precisam copiar/colar mensagens manualmente entre o chat widget e o WhatsApp Business
- **Sem e-mail:** leads que chegam por e-mail ficam fora do sistema — sem qualificação, sem histórico, sem handoff
- **Sem adapters corretos:** sem validação HMAC-SHA256, a plataforma fica vulnerável a webhooks forjados
- **Sem dispatcher:** a harness orquestra a resposta do agente, mas não tem como enviar de volta ao canal de origem

---

## 4. Regras de negócio

### WhatsApp
1. Todo webhook WhatsApp **deve** ter HMAC-SHA256 validado contra `WHATSAPP_APP_SECRET` antes de qualquer processamento
2. Resposta ao webhook Meta **deve** ser HTTP 200 em menos de 5 segundos (fire-and-forget obrigatório)
3. Mensagem duplicada **deve** ser detectada via `providerMessageId` único por tenant (idempotência da Fase 2.2)
4. Apenas mensagens do tipo `text` e `interactive` (botão/lista) são processadas na v1; outros tipos retornam `UNSUPPORTED_MESSAGE_TYPE`
5. Número do remetente é normalizado para E.164 antes de resolver o `Contact`
6. `WhatsAppDispatcher` **nunca** lança exceção ao falhar envio — registra erro e retorna gracefully (o agente não deve falhar por falha de envio)
7. Configuração de canal (token, número, webhook secret) é por tenant e armazenada criptografada

### E-mail
8. Webhook de entrada suporta provedores: **SendGrid Inbound Parse** e **AWS SES** (via S3 trigger)
9. E-mail de saída usa `REPLY-TO` do e-mail original para manter thread
10. Assunto do e-mail de resposta **deve** preservar o `Re: [assunto original]`
11. Conteúdo de resposta é texto plano + HTML (multipart) — sem HTML complexo no MVP
12. Endereço de e-mail de envio é por tenant (ex: `agente@tenant-dominio.com`)

### Geral
13. `tenantId` sempre resolvido pelo servidor a partir da configuração do canal — nunca de corpo/query
14. Falha de envio (WhatsApp ou e-mail) **não** reverte o status da conversa — é registrada em `AgentExecutionTrace`
15. Testes de isolamento multi-tenant obrigatórios para ambos os adapters

---

## 5. Fluxos principais

### WhatsApp — Receber mensagem

```
1. Meta envia POST /api/v1/channels/whatsapp/webhook
2. WhatsAppWebhookAdapter valida HMAC-SHA256 (401 se inválido)
3. Adapter extrai: providerMessageId, from (número E.164), text, timestamp
4. Adapter resolve tenantId pelo número do Business (phoneNumberId → tenant)
5. Adapter chama ReceiveInboundEvent { provider: 'WHATSAPP', ... }
6. ReceiveInboundEvent verifica idempotência, enfileira mensagem
7. Retorna HTTP 200 imediatamente (< 5s)
8. [Async] OrchestrateInboundMessage processa → agente gera resposta
9. [Async] WhatsAppDispatcher.send(tenantId, to, text) → Meta Cloud API
```

### WhatsApp — Enviar resposta

```
1. OrchestrateInboundMessage obtém resposta do agente
2. Resolve IChannelDispatcher correto (WHATSAPP) via factory
3. WhatsAppDispatcher carrega credenciais do tenant (token, phoneNumberId)
4. POST https://graph.facebook.com/v20.0/{phoneNumberId}/messages
5. Em caso de erro: registra em AgentExecutionTrace, não lança exceção
```

### E-mail — Receber mensagem (SendGrid)

```
1. SendGrid Inbound Parse envia POST /api/v1/channels/email/webhook/sendgrid
2. EmailWebhookAdapter extrai: from, to, subject, text/plain
3. Resolve tenantId pelo endereço 'to' (ex: agente@tenant-dominio.com)
4. Chama ReceiveInboundEvent { provider: 'EMAIL', ... }
5. [Async] OrchestrateInboundMessage processa → agente gera resposta
6. [Async] EmailDispatcher.send({ to, subject: 'Re: ...', text, html })
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| HMAC-SHA256 inválido | HTTP 200 (não revelar erro à Meta), log `WEBHOOK_SIGNATURE_INVALID` |
| Tipo de mensagem não suportado | Ignora silenciosamente, HTTP 200 |
| `providerMessageId` duplicado | Idempotência: HTTP 200, não reprocessa |
| Tenant não encontrado para o canal | Log `CHANNEL_TENANT_NOT_FOUND`, HTTP 200 |
| WhatsApp API retorna erro | Registra em trace, não lança exceção |
| E-mail sem texto plano | Usa html-to-text para extrair conteúdo |
| Envio de e-mail falha | Registra em trace, conversa continua |
| Canal não configurado para tenant | `CHANNEL_NOT_CONFIGURED` (422) |

---

## 7. Critérios de aceite

- Dado um webhook WhatsApp com HMAC válido, quando recebido, então a mensagem é enfileirada e HTTP 200 retornado em < 5s
- Dado um webhook WhatsApp com HMAC inválido, quando recebido, então é descartado com log de segurança e HTTP 200 retornado
- Dado uma mensagem WhatsApp duplicada (mesmo providerMessageId), quando recebida novamente, então é ignorada (idempotência)
- Dado um agente com resposta gerada, quando canal é WHATSAPP, então `WhatsAppDispatcher` envia via Meta Cloud API
- Dado falha na Meta Cloud API, quando `WhatsAppDispatcher.send()` falha, então erro é registrado no trace e execução continua
- Dado um webhook SendGrid com e-mail válido, quando recebido, então mensagem é enfileirada e processada pelo agente
- Dado resposta de agente para canal EMAIL, quando enviada, então `EmailDispatcher` envia com `Re:` no assunto preservado
- Dado tenant A configurado com número WhatsApp X, quando webhook recebido de número X, então apenas tenant A processa
- Dado tenant A e tenant B com canais configurados, quando processados em paralelo, então dados nunca se misturam

---

## 8. Contratos de entrada e saída

```typescript
// ─── WhatsApp Webhook Payload (Meta Cloud API) ────────────────────────────────
type WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string                    // WABA ID
    changes: Array<{
      value: {
        messaging_product: 'whatsapp'
        metadata: { phone_number_id: string; display_phone_number: string }
        messages?: Array<{
          id: string              // providerMessageId
          from: string            // número E.164
          timestamp: string
          type: 'text' | 'interactive' | 'image' | 'audio' | 'document'
          text?: { body: string }
        }>
      }
      field: 'messages'
    }>
  }>
}

// ─── Channel Dispatcher Interface ────────────────────────────────────────────
interface IChannelDispatcher {
  send(params: DispatchParams): Promise<DispatchResult>
}

type DispatchParams = {
  tenantId: string
  conversationId: string
  to: string              // número E.164 ou endereço de e-mail
  text: string
  metadata?: Record<string, unknown>
}

type DispatchResult = {
  success: boolean
  providerId?: string     // ID da mensagem no provider (WhatsApp message_id, etc.)
  error?: string
}

// ─── Channel Config (por tenant) ─────────────────────────────────────────────
type ChannelConfig = {
  id: string
  tenantId: string
  provider: 'WHATSAPP' | 'EMAIL'
  // WhatsApp:
  phoneNumberId?: string
  accessToken?: string    // criptografado em repouso
  webhookSecret?: string  // criptografado em repouso
  // Email:
  fromAddress?: string
  fromName?: string
  sendgridApiKey?: string // criptografado em repouso
  createdAt: Date
  updatedAt: Date
}

// ─── API: Configurar canal (TENANT_ADMIN) ────────────────────────────────────
// POST /api/v1/channels
// Input:
type CreateChannelInput = {
  provider: 'WHATSAPP' | 'EMAIL'
  // WhatsApp:
  phoneNumberId?: string
  accessToken?: string
  webhookSecret?: string
  // Email:
  fromAddress?: string
  fromName?: string
  sendgridApiKey?: string
}
// Output: ChannelConfig (sem campos sensíveis decriptografados)

// GET /api/v1/channels → ChannelConfig[]
// DELETE /api/v1/channels/:id → 204

// ─── Erros ───────────────────────────────────────────────────────────────────
type ChannelError =
  | 'CHANNEL_NOT_CONFIGURED'
  | 'CHANNEL_TENANT_NOT_FOUND'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'UNSUPPORTED_MESSAGE_TYPE'
  | 'DISPATCH_FAILED'
  | 'CHANNEL_ALREADY_EXISTS'
```

---

## 9. Impacto arquitetural

### Novas entidades e tabelas
- [x] Nova tabela: `ChannelConfig` — configuração de canal por tenant (provider + credenciais criptografadas)
- [x] Nova entidade: `ChannelConfig` em `domains/channel/entities/ChannelConfig.ts`

### Novos domínios
- [x] `domains/channel/` (já existe — usado pela harness)
  - Adicionar: `repositories/IChannelConfigRepository.ts`
  - Adicionar: `use-cases/CreateChannelConfig.ts`, `ListChannelConfigs.ts`, `DeleteChannelConfig.ts`

### Nova infraestrutura
- [x] `infrastructure/channel/WhatsAppWebhookAdapter.ts` — parse + validação HMAC
- [x] `infrastructure/channel/WhatsAppDispatcher.ts` — integra Meta Cloud API
- [x] `infrastructure/channel/EmailWebhookAdapter.ts` — parse SendGrid Inbound Parse
- [x] `infrastructure/channel/EmailDispatcher.ts` — integra SendGrid Send API
- [x] `infrastructure/channel/IChannelDispatcher.ts` — interface plugável
- [x] `infrastructure/channel/ChannelDispatcherFactory.ts` — resolve dispatcher por provider
- [x] `infrastructure/db/repositories/InMemoryChannelConfigRepository.ts`
- [x] `infrastructure/db/repositories/PrismaChannelConfigRepository.ts`

### Novas API routes
- [x] `POST /api/v1/channels/whatsapp/webhook` — webhook público Meta
- [x] `GET /api/v1/channels/whatsapp/webhook` — verificação de webhook Meta (challenge)
- [x] `POST /api/v1/channels/email/webhook/sendgrid` — webhook SendGrid Inbound
- [x] `POST /api/v1/channels` — criar/atualizar configuração de canal (TENANT_ADMIN)
- [x] `GET /api/v1/channels` — listar canais configurados (TENANT_ADMIN)
- [x] `DELETE /api/v1/channels/:id` — remover configuração (TENANT_ADMIN)

### Prisma schema
- [x] Novo model: `ChannelConfig` com campos criptografados

### Integração com OrchestrateInboundMessage
- [x] Após gerar resposta, `OrchestrateInboundMessage` chama `ChannelDispatcherFactory.dispatch()`
- [x] Resultado do dispatch registrado em `AgentExecutionTrace`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Segredo WhatsApp vazado | Baixa | Crítico | Armazenar criptografado (AES-256-GCM); nunca retornar em API |
| Rate limit Meta API (1000 msg/s por WABA) | Média | Alto | Implementar retry com backoff exponencial em `WhatsAppDispatcher` |
| SendGrid IP bloqueado como spam | Baixa | Alto | Usar domínio verificado; DKIM/SPF configurado |
| Webhook Meta: replay attack | Baixa | Médio | Validar timestamp do webhook (rejeitar se > 5min antigo) |
| Número WhatsApp de outro tenant reutilizado | Baixa | Crítico | Unique constraint em (provider, phoneNumberId) no banco |
| Credenciais em logs | Alta | Alto | Mascarar `accessToken` nos logs; nunca logar payload raw com tokens |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/channel/`):**
- [ ] `WhatsAppWebhookAdapter deve validar HMAC-SHA256 corretamente`
- [ ] `WhatsAppWebhookAdapter deve rejeitar payload com HMAC inválido`
- [ ] `WhatsAppWebhookAdapter deve ignorar tipos de mensagem não suportados`
- [ ] `WhatsAppWebhookAdapter deve normalizar número para E.164`
- [ ] `WhatsAppDispatcher deve enviar mensagem para Meta API`
- [ ] `WhatsAppDispatcher deve retornar success=false sem lançar exceção em falha`
- [ ] `EmailWebhookAdapter deve extrair from/subject/body do payload SendGrid`
- [ ] `EmailDispatcher deve enviar com prefixo Re: no assunto`
- [ ] `CreateChannelConfig deve rejeitar se canal já existe para mesmo tenant+provider`
- [ ] `CreateChannelConfig deve rejeitar se tenantId ausente`

**Integração (`tests/integration/`):**
- [ ] `POST /channels/whatsapp/webhook aceita payload válido e retorna 200`
- [ ] `POST /channels/whatsapp/webhook rejeita HMAC inválido com 200 (silencioso)`
- [ ] `POST /channels deve criar ChannelConfig para TENANT_ADMIN`
- [ ] `GET /channels lista apenas canais do próprio tenant`
- [ ] `tenant A não deve acessar ChannelConfig de tenant B`
- [ ] `DELETE /channels/:id deve remover apenas canal do próprio tenant`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** número de telefone (WhatsApp), endereço de e-mail, conteúdo das mensagens
- **Finalidade:** processar mensagens para gerar resposta do agente; identificar contato (ContactIdentity)
- **Retenção:** segue política de retenção da `Conversation` — configurável por tenant
- **Exclusão:** cascade delete: excluir tenant → exclui ChannelConfig + histórico
- **Dados sensíveis:** `accessToken`, `webhookSecret`, `sendgridApiKey` — criptografados em repouso (AES-256-GCM); nunca retornados em API
- **Número de telefone:** PII — armazenado em `ContactChannelIdentity`; cobert por política de ContactMemory (Fase 2.3)
- **KDL:** conteúdo de mensagens pode ser distilado pela KDL somente após anonimização completa — segue ADR 005

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` resolvido pelo servidor via `ChannelConfig.phoneNumberId` (WhatsApp) ou `ChannelConfig.fromAddress` (email) — nunca de body/query
- RLS deve cobrir `ChannelConfig` (nova tabela)
- Unique constraint: `(provider, phoneNumberId)` e `(provider, fromAddress)` — impede número/endereço em dois tenants
- `accessToken` e credenciais só carregadas com `tenantId` correto
- Audit log registra `tenantId` em todos os eventos de dispatch
- Testes de isolamento: tenant A não vê canais de tenant B ✅
