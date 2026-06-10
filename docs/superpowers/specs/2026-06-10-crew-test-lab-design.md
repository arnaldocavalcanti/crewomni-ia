# Crew Test Lab — Design Spec
**Data:** 2026-06-10  
**Status:** APPROVED  
**Autor:** Arnaldo Cavalcanti (via brainstorming)

---

## 1. Objetivo

Permitir que operadores e administradores testem e visualizem o fluxo completo de uma Crew antes de colocá-la em produção, entendendo qual agente atendeu, o que respondeu, para qual agente foi transferido e o detalhe técnico de cada etapa do pipeline.

---

## 2. Contexto de negócio

Após cadastrar canais de WhatsApp e e-mail (Fase 3.2), o usuário precisa validar se o fluxo dos agentes dentro de uma Crew está correto antes de expor o canal ao público. Isso inclui:
- Testar se o agente director roteou corretamente
- Validar se handoffs acontecem no momento certo
- Verificar a qualidade das respostas do LLM
- Diagnosticar problemas operacionais (admin)

O feature também suporta o número provisório que a Meta disponibiliza no App de WhatsApp, permitindo testes completos antes de usar o número real da empresa.

---

## 3. Usuários

| Perfil | Uso principal |
|---|---|
| `TENANT_OPERATOR` | Cria um novo fluxo e valida antes de subir — usa o Flow Visual e o chat simulado |
| `TENANT_ADMIN` | Investiga bugs operacionais — usa o Trace Detalhado com todas as etapas do pipeline |

---

## 4. Localização na UI

**Aba "Test Lab"** dentro de `/dashboard/crews/:id`, ao lado das abas Visão Geral, Membros e Métricas.

A URL com `?tab=test` é compartilhável — facilita que um admin envie o link para investigação de um bug específico.

---

## 5. Modos de teste

### 5.1 Modo Simular (padrão)
- Execução **síncrona e direta** — sem passar pela fila (InMemoryQueue / BullMQ)
- Não cria conversas reais no banco — pipeline executa em memória e descarta
- Funciona mesmo sem canal WhatsApp configurado
- Resultado imediato na UI

### 5.2 Modo WhatsApp Real
- Usa o canal WhatsApp configurado do tenant
- Envia mensagem real via Meta Cloud API para o número informado pelo usuário
- Cria conversa real no banco (aparece no dashboard de conversas com `source: TEST`)
- Útil para testar com o número provisório da Meta durante setup do App

---

## 6. Contrato de API

### `POST /api/v1/crews/:id/simulate`

**Autenticação:** JWT obrigatório. `tenantId` extraído da sessão — nunca do body.  
**Autorização:** `TENANT_ADMIN` ou `TENANT_OPERATOR`.

**Request body:**
```typescript
{
  message: string
  mode: "SIMULATE" | "WHATSAPP_REAL"
  toPhone?: string   // obrigatório se mode === "WHATSAPP_REAL"
}
```

**Response 200:**
```typescript
{
  conversationId: string
  reply: string

  flowPath: Array<{
    agentId: string
    agentName: string
    agentType: string
    role: "DIRECTOR" | "MEMBER"
    action: "RESPONDED" | "TRANSFERRED" | "WAITING"
    responseSnippet?: string
    durationMs: number
  }>

  handoffs: Array<{
    fromAgentId: string
    fromAgentName: string
    toAgentId: string
    toAgentName: string
    reason?: string
  }>

  trace: {
    model: string
    inputTokens: number
    outputTokens: number
    estimatedCostUsd: number
    durationMs: number
    memoryBlocksUsed: string[]
    chunksUsed: string[]
    steps?: Array<{        // apenas para TENANT_ADMIN
      step: string         // ex: "QUOTA_CHECK", "CONTACT_RESOLVE", "LLM_CALL"
      durationMs: number
      detail?: string
    }>
  }
}
```

**Erros esperados:**
- `400 CREW_HAS_NO_MEMBERS` — crew sem agentes
- `400 WHATSAPP_CHANNEL_NOT_CONFIGURED` — modo real sem canal configurado
- `400 QUOTA_EXCEEDED` — limite de uso atingido
- `404 CREW_NOT_FOUND` — crew de outro tenant (isolamento multi-tenant)
- `422 VALIDATION_ERROR` — body inválido

---

## 7. Novo use-case: `SimulateCrewMessage`

**Localização:** `src/domains/crew/use-cases/SimulateCrewMessage.ts`

**Responsabilidades:**
1. Carregar membros da Crew e validar que existe ao menos 1
2. Construir um `InboundEvent` sintético (sem persistir na fila)
3. Chamar `OrchestrateInboundMessage` diretamente (modo SIMULATE) ou via harness completa (modo WHATSAPP_REAL)
4. Capturar `flowPath` instrumentando cada chamada a `SendMessage` e `TransferConversation`
5. Retornar `TestSessionResult` com reply, flowPath, handoffs e trace
6. No modo SIMULATE: descartar dados de conversa ao final (não persiste no banco)

**Dependências injetadas:** `ICrewMemberRepository`, `OrchestrateInboundMessage`, `SendMessage`, `IAgentExecutionTraceRepository`, `IChannelConfigRepository`

---

## 8. Componentes de UI

### `CrewTestLab` (componente pai)
- Gerencia estado: `messages[]`, `flowPath[]`, `trace`, `mode`, `isLoading`
- Renderiza os dois painéis
- Chama `POST /api/v1/crews/:id/simulate` a cada envio

### `TestChatSimulator` (painel esquerdo)
- Toggle "Simular / WhatsApp Real" no topo
- Campo "Seu número WhatsApp" visível apenas no modo real
- Histórico de mensagens estilo WhatsApp:
  - Mensagem do usuário: bolha verde-clara, alinhada à direita
  - Resposta do agente: bolha branca com **etiqueta colorida** acima (`🤖 Nome do Agente`)
  - Badge de handoff entre agentes: `⇄ Transferido para [Agente]` centralizado
- Estado de loading: bolha com `...` animado enquanto aguarda resposta
- Input + botão "Enviar"

### `CrewFlowDiagram` (painel direito — topo)
- SVG puro (sem React Flow) — fluxos de Crew são sequenciais, não arbitrários
- Renderiza todos os membros da Crew como nós verticais conectados por linhas
- Após cada resposta, atualiza visualmente:
  - **Agentes visitados:** nó destacado (azul para DIRECTOR, roxo para MEMBER) com badge de tempo
  - **Agentes não visitados:** nó acinzentado (opacidade 35%)
  - **Aresta de handoff:** linha colorida com label `⇄ TransferConversation`
- Nó de entrada: `📥 WhatsApp · [modo]`
- Nó de harness: caixa tracejada `Harness · idempotência OK`

### `AgentTraceAccordion` (painel direito — base, colapsável)
- Visível para todos os usuários
- Sempre exibe: modelo, tokens usados, custo estimado, duração total
- `steps[]` detalhados: **apenas para `TENANT_ADMIN`**
- Colapsado por padrão; expande com clique

---

## 9. Edge cases e tratamento de erros

| Situação | Comportamento |
|---|---|
| Crew sem membros | Botão "Testar" desabilitado + tooltip explicativo |
| Modo real sem canal WhatsApp | Aviso inline com link para `/dashboard/channels` |
| Quota excedida | Mensagem de erro amigável na bolha do chat |
| LLM timeout / falha | Erro exibido na bolha — não trava o chat, permite nova tentativa |
| Handoff para agente fora da Crew | Nó "Agente desconhecido" em vermelho no diagrama (não deve ocorrer — `TransferConversation` valida) |
| Crew em status DRAFT ou ARCHIVED | Banner de aviso no topo da aba |
| Crew de outro tenant | 404 (nunca 403 — não revela existência) |

---

## 10. Testes esperados

### Unitários (`SimulateCrewMessage`)
- Modo SIMULATE: retorna reply + flowPath com 1 agente para crew com 1 membro
- Modo SIMULATE com handoff: flowPath contém 2 agentes + handoffs[] preenchido
- Crew sem membros: lança `CREW_HAS_NO_MEMBERS`
- Modo WHATSAPP_REAL sem canal: lança `WHATSAPP_CHANNEL_NOT_CONFIGURED`
- Isolamento multi-tenant: crew de outro tenant retorna 404

### Integração (`POST /api/v1/crews/:id/simulate`)
- 200 com flowPath correto para crew ativa com membros
- 400 para crew sem membros
- 404 para crew de outro tenant
- 422 para body inválido (message vazia, mode inválido)

---

## 11. Critérios LGPD

- Modo SIMULATE não persiste dados no banco — sem risco de retenção indevida
- Modo WHATSAPP_REAL cria conversa marcada com `source: TEST` — pode ser excluída via purge futuro
- `steps[]` do trace (dados de debug) só expostos para `TENANT_ADMIN` — não vaza para operadores

---

## 12. Critérios de isolamento multi-tenant

- `tenantId` sempre extraído da sessão JWT
- `SimulateCrewMessage` valida que a Crew pertence ao `tenantId` antes de qualquer operação
- Busca por Crew de outro tenant retorna 404 (nunca 403)
- Canal WhatsApp buscado sempre pelo `tenantId` da sessão

---

## 13. Fora de escopo (fase futura)

- Histórico persistente de sessões de teste (auditoria)
- Testes agendados / automáticos (regression testing de Crews)
- Widget embed (script copy-paste para instalar em site de cliente)
- Modo "replay" de conversa real como caso de teste
