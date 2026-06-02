# ADR 005 — Pipeline da Knowledge Distillation Layer (KDL)

> **Status:** ACCEPTED
> **Data:** 2026-05-31
> **Contexto:** Fase 2 — definir como o conhecimento coletivo é extraído das conversas dos tenants e promovido à Industry KB sem violar isolamento ou privacidade

---

## Contexto

O CrewOmni acumula conversas de múltiplos tenants por nicho. Essas conversas contêm padrões de perguntas, respostas eficazes e conhecimento de domínio que, de forma anonimizada, podem beneficiar todos os tenants do mesmo nicho.

A KDL é a camada que transforma experiências individuais de tenants em conhecimento coletivo — sem jamais expor dados privados de um tenant para outro.

---

## Regras invioláveis (do Product Charter)

1. Nunca compartilhar dados brutos entre tenants
2. Nunca compartilhar documentos privados
3. Sempre anonimizar antes de promover à Industry KB
4. Sempre requerer aprovação humana (KDL_APPROVER) antes de publicar insight
5. Sempre versionar e auditar cada aprendizado
6. Tenant pode optar por não contribuir (opt-out por tenant)

---

## Decisão: Pipeline em 5 etapas

```
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 1 — COLETA                                                │
│  Job noturno lê conversas CLOSED das últimas 24h por nicho      │
│  Filtra tenants com opt-in ativo                                 │
├─────────────────────────────────────────────────────────────────┤
│  ETAPA 2 — EXTRAÇÃO DE INSIGHTS (LLM)                           │
│  Para cada conversa: extrai padrão de pergunta + resposta eficaz │
│  Remove nomes, e-mails, CPFs, CNPJs, valores, datas específicas │
│  Gera: { question_pattern, answer_pattern, niche, confidence }   │
├─────────────────────────────────────────────────────────────────┤
│  ETAPA 3 — DEDUPLICAÇÃO E AGRUPAMENTO                           │
│  Agrupa insights semanticamente similares (cosine similarity)    │
│  Mantém apenas insights com confidence ≥ 0.8 e frequência ≥ 3   │
├─────────────────────────────────────────────────────────────────┤
│  ETAPA 4 — FILA DE APROVAÇÃO (KDL_APPROVER)                     │
│  Insights ficam em status PENDING_REVIEW                         │
│  KDL_APPROVER revisa e aprova/rejeita no dashboard              │
├─────────────────────────────────────────────────────────────────┤
│  ETAPA 5 — PROMOÇÃO À INDUSTRY KB                               │
│  Insights APPROVED viram KnowledgeDocument na layer INDUSTRY     │
│  Disponíveis para todos os tenants do nicho via RAG             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entidades novas (Fase 2)

```typescript
// Insight extraído de conversas — aguarda aprovação
type KDLInsight = {
  id: string
  niche: Niche
  questionPattern: string    // anonimizado
  answerPattern: string      // anonimizado
  sourceCount: number        // quantas conversas geraram este insight
  confidence: number         // 0–1
  status: KDLInsightStatus   // PENDING_REVIEW | APPROVED | REJECTED
  reviewedBy: string | null  // userId do KDL_APPROVER
  reviewedAt: Date | null
  createdAt: Date
}

enum KDLInsightStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED       = 'APPROVED',
  REJECTED       = 'REJECTED',
}
```

---

## Prompt de extração (Etapa 2)

```
Analise a conversa abaixo e extraia o padrão genérico de pergunta e resposta.

REGRAS OBRIGATÓRIAS:
- Remova TODOS os dados pessoais: nomes, e-mails, telefones, CPF, CNPJ, endereços, valores monetários, datas específicas
- Generalize referências a empresas específicas (ex: "Devolus" → "a empresa")
- Se não houver padrão reutilizável, responda: {"skip": true}
- Responda APENAS em JSON válido

FORMATO:
{
  "questionPattern": "Como faço para [ação genérica]?",
  "answerPattern": "Para [ação genérica], os passos são: [passos genéricos].",
  "confidence": 0.0-1.0,
  "skip": false
}

CONVERSA:
{conversa_anonimizada}
```

---

## Estratégia de anonimização (Etapa 2)

Antes de enviar ao LLM para extração, aplica-se uma camada de PII scrubbing:

| Padrão | Substituição |
|---|---|
| E-mails | `[EMAIL]` |
| CPF/CNPJ | `[DOCUMENTO]` |
| Telefones | `[TELEFONE]` |
| CEP/endereços | `[ENDEREÇO]` |
| Nomes próprios (NER) | `[PESSOA]` |
| Valores monetários | `[VALOR]` |
| Datas específicas | `[DATA]` |

Implementação: regex + biblioteca `compromise` (NER leve, sem chamada externa).

---

## Frequência e orçamento de tokens

| Parâmetro | Valor padrão | Configurável? |
|---|---|---|
| Frequência do job | 1x por dia (03:00 UTC) | Sim (env var) |
| Conversas por job | últimas 500 por nicho | Sim |
| Max tokens por extração | 2000 | Não |
| Confidence mínima | 0.8 | Sim por nicho |
| Frequência mínima | 3 conversas | Sim por nicho |
| Modelo de extração | `gpt-4o-mini` | Sim |

---

## Opt-out por tenant

Campo `kdlOptOut: boolean` em `TenantSettings`. Padrão: `false` (opt-in).

Tenants com `kdlOptOut = true` têm suas conversas excluídas da coleta antes da Etapa 1.

---

## Mecanismo de execução (Fase 2)

**MVP da KDL:** job manual executado via endpoint protegido:
```
POST /api/v1/admin/kdl/run  — apenas PLATFORM_ADMIN
```

**Fase 3:** BullMQ + Redis com cron schedule.

---

## Consequências

- `KDLInsight` é uma nova entidade no schema Prisma — migration necessária na Fase 2
- O fluxo de aprovação requer nova tela no dashboard (fila de review para KDL_APPROVER)
- Industry KB (Layer 2 do prompt) só ativa após o primeiro batch aprovado por nicho
- Custo incremental de tokens por tenant: ~$0.001 por conversa processada (gpt-4o-mini)
- LGPD: os insights aprovados não contêm dados pessoais — verificado pelo KDL_APPROVER antes de publicar

---

## Próximas decisões relacionadas

- ADR 006 — Estratégia de billing e limites por plano
- ADR 007 — Arquitetura de filas (BullMQ + Redis) para jobs assíncronos
