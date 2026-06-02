# Chat Widget Público — Configuração e Canal de Conversa

> **Status:** APPROVED
> **Domínio:** widget (canal público)
> **Autor:** @arnaldo
> **Data:** 2026-05-31
> **Depende de:** spec conversation-audit, ADR 002 (resolução de tenant por slug)

---

## 1. Objetivo

Expor dois endpoints públicos (sem JWT) que permitem um widget de chat embutido no site do tenant: (1) buscar a configuração visual e de comportamento do agente pelo slug, e (2) enviar mensagens ao agente passando apenas o `tenantSlug` e o `agentSlug` como identificadores públicos.

---

## 2. Contexto de negócio

O tenant embute um script no seu site:
```html
<script src="https://app.aihub.com/widget.js"
  data-tenant="devolus"
  data-agent="suporte">
</script>
```

O widget faz duas chamadas:
1. `GET /api/v1/widget/config?tenant=devolus&agent=suporte` — carrega nome, cor, mensagem de boas-vindas
2. `POST /api/v1/widget/chat` — envia mensagens do visitante ao agente

Não há login. O tenant é identificado pelo slug público. A autenticação é server-side via resolução do contexto do tenant (ADR 002 — estratégia `PUBLIC_SLUG`).

---

## 3. Problema que resolve

Sem endpoints públicos, o widget precisaria de credenciais do tenant expostas no frontend — inseguro. Com o canal público por slug, o tenant não precisa expor tokens; a plataforma valida o slug server-side e injeta o `tenantId` correto.

---

## 4. Regras de negócio

1. `tenantSlug` e `agentSlug` são obrigatórios em ambos os endpoints.
2. O tenant deve estar com status `ACTIVE`; slug inválido retorna 404.
3. O agente deve pertencer ao tenant e ter status `ACTIVE`; slug inválido retorna 404.
4. O endpoint de config **não expõe** `systemPrompt`, `tenantId` interno, nem dados de billing.
5. O endpoint de chat usa `SendMessage` internamente — cria/continua conversa normalmente.
6. `externalUserId` é opcional — pode ser passado pelo widget para identificar o visitante.
7. Os endpoints públicos **não requerem** header `Authorization`.
8. Rate limiting é recomendado por IP (implementação futura — Fase 2).
9. CORS: apenas origens cadastradas no `allowedDomains` do tenant são aceitas (implementação futura).
10. `tenantId` e `agentId` reais nunca aparecem na resposta pública.

---

## 5. Fluxos principais

### GET /api/v1/widget/config
```
1. Cliente envia: ?tenant=devolus&agent=suporte
2. Sistema resolve tenant pelo slug (ResolveTenantContext estratégia PUBLIC_SLUG)
3. Sistema busca agente pelo slug dentro do tenant
4. Sistema valida: tenant ACTIVE + agente ACTIVE
5. Retorna: { agentName, welcomeMessage, primaryColor, agentType }
```

### POST /api/v1/widget/chat
```
1. Cliente envia: { tenantSlug, agentSlug, message, conversationId?, externalUserId? }
2. Sistema resolve tenant pelo slug
3. Sistema busca agente pelo slug dentro do tenant
4. Sistema valida: tenant ACTIVE + agente ACTIVE
5. Sistema chama SendMessage com { tenantId, agentId, message, conversationId?, externalUserId? }
6. Retorna: { conversationId, reply, isNewConversation }
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| tenantSlug inválido | 404 `TENANT_NOT_FOUND` |
| agentSlug não encontrado no tenant | 404 `AGENT_NOT_FOUND` |
| Agente com status DRAFT ou ARCHIVED | 404 `AGENT_NOT_FOUND` (não revela status) |
| Tenant INACTIVE ou SUSPENDED | 404 `TENANT_NOT_FOUND` |
| message vazia | 422 `VALIDATION_ERROR` |
| conversationId de outro tenant | 404 `CONVERSATION_NOT_FOUND` |

---

## 7. Critérios de aceite

- Dado slug válido de tenant ACTIVE e agente ACTIVE, quando GET /widget/config, então retorna config sem dados internos
- Dado agentSlug inválido, quando GET /widget/config, então retorna 404
- Dado tenant INACTIVE, quando GET /widget/config, então retorna 404
- Dado slugs válidos e message válida, quando POST /widget/chat, então retorna reply e conversationId
- Dado conversationId existente, quando POST /widget/chat, então conversa continua (isNewConversation: false)
- Dado primeira mensagem, quando POST /widget/chat sem conversationId, então isNewConversation: true
- Dado systemPrompt no agente, quando GET /widget/config, então systemPrompt não aparece na resposta

---

## 8. Contratos de entrada e saída

```typescript
// GET /api/v1/widget/config?tenant=X&agent=Y
type WidgetConfigOutput = {
  agentName: string
  agentType: string           // SDR | HELPDESK | etc.
  welcomeMessage: string      // "Olá! Como posso ajudar?" (padrão)
  primaryColor: string        // "#6366f1" (padrão)
}

// POST /api/v1/widget/chat
type WidgetChatInput = {
  tenantSlug: string
  agentSlug: string
  message: string
  conversationId?: string
  externalUserId?: string
}

type WidgetChatOutput = {
  conversationId: string
  reply: string
  isNewConversation: boolean
}

// Erros
type WidgetError =
  | 'TENANT_NOT_FOUND'
  | 'AGENT_NOT_FOUND'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_CLOSED'
  | 'VALIDATION_ERROR'
```

---

## 9. Impacto arquitetural

- [ ] Nova API route: `GET /api/v1/widget/config`
- [ ] Nova API route: `POST /api/v1/widget/chat`
- [ ] Reuso de `ResolveTenantContext` (estratégia `PUBLIC_SLUG`) — já implementado
- [ ] Reuso de `GetAgent` (busca por slug) — já implementado via `IAgentRepository.findBySlug`
- [ ] Reuso de `SendMessage` — já implementado
- [ ] Sem novas entidades, repositórios ou use-cases

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Abuso por bots (spam de mensagens) | Alta | Médio | Rate limiting por IP (Fase 2) |
| CORS permitir origem não autorizada | Média | Alto | Validar `allowedDomains` do tenant (Fase 2) |
| Exposição de systemPrompt via config | Baixa | Alto | Nunca incluir systemPrompt no WidgetConfigOutput |
| tenantId real vazando na resposta | Baixa | Médio | Mapear output manualmente — nunca retornar campos internos |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/widget/` ou reutiliza testes existentes):**
- Não há use-cases novos — lógica de negócio coberta pelos testes de `SendMessage`, `GetAgent` e `ResolveTenantContext`.

**Integração (`tests/integration/`):**
- [ ] `contrato: GET /api/v1/widget/config retorna WidgetConfigOutput sem campos internos`
- [ ] `contrato: POST /api/v1/widget/chat retorna WidgetChatOutput correto`
- [ ] `agentSlug inválido retorna 404`
- [ ] `systemPrompt nunca aparece no WidgetConfigOutput`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** mensagens do visitante, `externalUserId` opcional
- **Finalidade:** atendimento automatizado no site do tenant
- **Retenção:** herdada da conversa (domínio conversation)
- **Dados sensíveis:** visitante pode informar dados pessoais nas mensagens — tratamento herdado da conversa
- **KDL:** não alimenta KDL diretamente — passa por `SendMessage` normalmente

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` resolvido server-side pelo slug — nunca aceito do cliente?  ✅
- Resposta pública não expõe `tenantId` interno?  ✅
- `conversationId` de outro tenant retorna 404?  ✅ (herdado de `SendMessage`)
- Agente de outro tenant inacessível pelo slug?  ✅ (busca sempre filtra por `tenantId`)
