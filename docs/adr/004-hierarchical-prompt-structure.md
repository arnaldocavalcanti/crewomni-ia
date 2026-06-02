# ADR 004 — Estrutura do Prompt Hierárquico (5 Layers)

> **Status:** ACCEPTED
> **Data:** 2026-05-29
> **Contexto:** Fase 1 — definir como as 5 layers de conhecimento são montadas no prompt final enviado ao LLM

---

## Contexto

Cada turno de conversa precisa montar um prompt que combine: o comportamento do agente (system prompt), o conhecimento relevante de até 4 layers da KB, o histórico recente da conversa e a mensagem atual do usuário. A ordem e o formato dessas seções afetam diretamente a qualidade das respostas.

---

## Decisão: Estrutura do prompt em blocos

```
┌─────────────────────────────────────────────────────────┐
│  SYSTEM PROMPT (sempre presente)                         │
│  Comportamento, personalidade e regras do agente         │
├─────────────────────────────────────────────────────────┤
│  GLOBAL KNOWLEDGE (opcional)                             │
│  Boas práticas gerais da plataforma                      │
├─────────────────────────────────────────────────────────┤
│  INDUSTRY KNOWLEDGE (opcional — Fase 2)                  │
│  Conhecimento coletivo do nicho via KDL                  │
├─────────────────────────────────────────────────────────┤
│  TENANT KNOWLEDGE (opcional)                             │
│  Conhecimento privado da empresa                         │
├─────────────────────────────────────────────────────────┤
│  AGENT KNOWLEDGE (opcional)                              │
│  Conhecimento específico do agente                       │
├─────────────────────────────────────────────────────────┤
│  CONVERSATION HISTORY (últimas N mensagens)              │
├─────────────────────────────────────────────────────────┤
│  USER MESSAGE (mensagem atual)                           │
└─────────────────────────────────────────────────────────┘
```

### Formato concreto (system message da API)

```
{agent.systemPrompt}

---CONHECIMENTO RELEVANTE---
{se global_chunks}: [Boas Práticas]\n{chunks}\n
{se industry_chunks}: [Referência do Setor]\n{chunks}\n
{se tenant_chunks}: [Base de Conhecimento]\n{chunks}\n
{se agent_chunks}: [Instruções Específicas]\n{chunks}\n
```

As mensagens de histórico e a mensagem do usuário são enviadas como `messages[]` na API (role: user/assistant), não no system prompt.

---

## Orçamento de tokens por bloco

| Bloco | Budget padrão | Justificativa |
|---|---|---|
| System prompt | Ilimitado (definido pelo tenant) | É o núcleo do comportamento |
| Global KB | 800 tokens | Boas práticas raramente mudam |
| Industry KB | 1000 tokens | Contexto de nicho — fase 2 |
| Tenant KB | 1500 tokens | Maior valor por turno |
| Agent KB | 800 tokens | Scripts e casos de uso |
| Histórico | Últimas 10 mensagens | Memória de curto prazo |
| **Total contexto** | **~4100 tokens de KB** | Abaixo do limite do gpt-4o-mini |

Se a soma exceder o budget, chunks são truncados por score (menor score sai primeiro).

---

## Estratégia de model routing por intenção

Detectada antes do RAG para escolher o modelo certo:

| Intenção | Modelo | Critério |
|---|---|---|
| FAQ / saudação / simples | `gpt-4o-mini` | Sem KB relevante encontrada (score < 0.7) |
| Suporte / SDR / onboarding | `gpt-4o` | KB encontrada, complexidade média |
| Negociação / jurídico | `gpt-4o` | Tipo do agente = NEGOTIATION ou LEGAL |

MVP: modelo fixo por agente (configurado no AgentConfig). Model routing automático na Fase 2.

---

## Interface ILLMProvider

```typescript
interface ILLMProvider {
  complete(params: {
    systemPrompt: string
    messages: { role: 'user' | 'assistant'; content: string }[]
    model?: string
    maxTokens?: number
  }): Promise<{ content: string; model: string; tokensUsed: number }>
}
```

---

## Consequências

- System prompt + KB context sempre no `system` role da API
- Histórico de conversa como `messages[]` separados
- `ILLMProvider` abstrai o provider — OpenAI, Anthropic, Gemini sem impacto no domínio
- Prompt caching: system prompt + KB context são cacheados por sessão (TTL da sessão)
- Truncagem por score garante que tokens mais relevantes ficam dentro do budget

---

## Próximas decisões

- ADR 005 — Pipeline da Knowledge Distillation Layer
