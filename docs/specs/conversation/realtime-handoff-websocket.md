# Real-time Handoff & WebSocket Integration

> **Status:** REVIEW
> **Domínio:** conversation / dashboard
> **Autor:** Antigravity
> **Data:** 2026-06-08

---

## 1. Objetivo

Implementar a comunicação em tempo real (via WebSocket ou Server-Sent Events) para o painel Split-View Operacional, permitindo que operadores recebam mensagens e notificações de handoff instantaneamente, e possam enviar mensagens diretamente ao contato humano durante o atendimento (Handoff Flow).

---

## 2. Contexto de negócio

Quando um atendimento é transferido para um humano (Handoff), o operador não pode depender de recarregar a página (F5) para ver as respostas do cliente ou novas solicitações de transbordo. A sincronização em tempo real reduz o tempo de resposta e aumenta a eficiência da operação de suporte/vendas.

---

## 3. Problema que resolve

- Elimina a latência (polling ou F5) na comunicação humano-humano.
- Garante que a interface do dashboard esteja sempre sincronizada com o status atual da conversa.
- Permite que operadores enviem mensagens que passam pela *Harness Core* para chegar ao canal correto (WhatsApp/Email/Widget).

---

## 4. Regras de negócio

1. **Assinatura de Eventos:** O cliente (Dashboard) deve se conectar ao servidor e assinar eventos restritos ao seu `tenantId`.
2. **Eventos Transmitidos:**
   - `MESSAGE_RECEIVED`: Nova mensagem recebida do usuário final.
   - `MESSAGE_SENT`: Confirmação de mensagem enviada (pelo IA ou operador).
   - `LIFECYCLE_CHANGED`: Conversa mudou de status (ex: para `HANDOFF_REQUESTED`).
3. **Envio de Mensagem:** O operador deve poder enviar mensagens chamando uma rota de API (ex: `POST /api/v1/conversations/:id/reply`), que gravará a mensagem no banco com `role: OPERATOR` e despachará via provedor (WhatsApp, Widget, etc.).
4. **Isolamento Multi-Tenant:** A conexão em tempo real só pode emitir mensagens referentes a conversas do `tenantId` da sessão autenticada.

---

## 5. Fluxos principais

### Conexão em Tempo Real
1. O painel Split-View Operacional inicializa.
2. O frontend estabelece conexão com o backend (WebSocket / SSE) enviando o token JWT ou relying em cookies de sessão.
3. O backend valida o `tenantId` e inscreve o socket no canal daquele tenant.
4. Quando uma nova mensagem entra via Webhook (`OrchestrateInboundMessage`), o backend emite um evento.
5. O frontend recebe o evento e atualiza o estado do React/UI (exibindo nova mensagem ou mudando contador de handoff).

### Operador Enviando Mensagem (Handoff Ativo)
1. Com a conversa em `HANDOFF_ACCEPTED`, o operador digita e clica em enviar.
2. O frontend chama `POST /api/v1/conversations/:id/reply`.
3. O use-case `OperatorReply` (novo ou adaptado) grava a mensagem no banco (`role: OPERATOR`).
4. O dispatcher do canal correspondente (WhatsApp/Widget) envia a mensagem real ao lead.
5. A nova mensagem é propagada via realtime para todos os clientes conectados do mesmo tenant (mantendo a tela do operador sincronizada).

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Token expirado ao tentar conectar | A conexão WebSocket/SSE falha com 401 e o cliente tenta reconectar. |
| Envio de mensagem em conversa `CLOSED` | A API retorna erro 400 (Invalid Lifecycle Status). |
| Conexão cai durante o atendimento | Cliente tenta reconexão automática; ao reconectar, faz fetch das últimas mensagens para evitar perda de dados. |

---

## 7. Critérios de aceite

- Dado um painel aberto, quando uma nova mensagem entra no webhook do canal, então a UI deve atualizar a listagem e o histórico imediatamente.
- Dado um operador que assumiu a conversa, quando ele envia uma mensagem, a mensagem deve ser persistida com `role: OPERATOR` e transmitida ao provedor.
- Dado um tenant A conectado, quando ocorre um evento no tenant B, o tenant A não deve receber nenhum payload.

---

## 8. Contratos de entrada e saída

### Nova API Route: POST /api/v1/conversations/:id/reply
**Input:**
```json
{
  "content": "Olá, sou o operador humano e vou te ajudar."
}
```
**Output:**
```json
{
  "success": true,
  "messageId": "uuid",
  "content": "Olá...",
  "role": "OPERATOR",
  "createdAt": "2026-06-08T12:00:00Z"
}
```

### Eventos Real-Time (Payload Exemplo)
```json
{
  "type": "MESSAGE_RECEIVED",
  "data": {
    "conversationId": "uuid",
    "message": {
       "id": "uuid",
       "content": "Sim, tenho interesse",
       "role": "USER"
    }
  }
}
```

---

## 9. Impacto arquitetural

- [ ] Nova infraestrutura: Implementação de WebSocket Server (Socket.IO + custom server em Next.js) **OU** Server-Sent Events (SSE via Route Handler padrão do Next.js).
- [ ] Novo adapter/use-case de `RealtimeDispatcher` para o backend disparar eventos para os sockets.
- [ ] Nova rota de API: `POST /api/v1/conversations/:id/reply` para o envio da mensagem do humano.
- [ ] Adição da Role `OPERATOR` no banco? (O Prisma schema atual pode já suportar `ASSISTANT`, `USER`, `SYSTEM`, precisa verificar se tem `OPERATOR` ou se usa `ASSISTANT` + metadados).

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dificuldade técnica de WebSockets no Next.js (App Router) em plataformas serverless (ex: Vercel). | Alta | Médio | Como a spec diz Node.js (darwin), o server customizado é viável. Alternativa de fallback: **Server-Sent Events (SSE)** que não exige socket.io nem server customizado e funciona nativamente. |

---

## 11. Testes esperados

**Integração:**
- `POST /api/v1/conversations/:id/reply` insere mensagem corretamente e falha para outro tenant.
- Se SSE/WS for implementado, criar testes da emissão do evento.

---

## 12. Critérios LGPD e privacidade

- **Dados protegidos:** Os sockets enviam conteúdo de mensagens em tempo real. Eles DEVEM exigir autenticação por token JWT antes de estabelecer conexão / assinar o tenant.

---

## 13. Critérios de isolamento multi-tenant

- A sala/canal do socket é indexada por `tenantId`. Eventos nunca sofrem broadcast global, sempre utilizam namespace `tenant:${tenantId}`.
