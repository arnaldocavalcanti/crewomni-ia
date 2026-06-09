# Métricas de Crew (Fase 1.6)

> **Status:** APPROVED
> **Domínio:** crew
> **Autor:** @antigravity
> **Data:** 2026-06-05

---

## 1. Objetivo

Fornecer indicadores (métricas) essenciais de performance e uso sobre uma Equipe (Crew) específica dentro da plataforma.

---

## 2. Contexto de negócio

Após o lançamento do Crew Builder (1.2) e Handoff (1.5), os gestores das empresas (tenants) precisam de visibilidade sobre o volume de atendimento e trabalho executado pela equipe de agentes. Sem métricas, o Tenant não sabe se o Diretor está sobrecarregado ou quantos atendimentos foram realizados.

---

## 3. Problema que resolve

- Falta de visibilidade gerencial sobre a atuação de múltiplos agentes trabalhando juntos na mesma Crew.
- Impossibilidade de medir o ROI ou consumo de tokens/mensagens por equipe.

---

## 4. Regras de negócio

1. As métricas devem ser calculadas isoladamente por `crewId` e `tenantId`.
2. As métricas agregadas devem incluir:
   - `totalConversations`: número de conversas (status OPEN e CLOSED) associadas a esta crew.
   - `activeConversations`: número de conversas apenas no status OPEN.
   - `totalMessages`: número total de mensagens geradas em conversas da crew.
   - `messagesByAgent`: um array indicando o número de mensagens por agente.
3. Não deve ser possível consultar métricas de uma crew de outro tenant (Isolamento).

---

## 5. Fluxos principais

```
1. Usuário admin/tenant visualiza a página da Crew no Dashboard.
2. O sistema faz um GET /api/v1/crews/:id/metrics.
3. O sistema valida se a Crew existe e pertence ao tenantId (via sessão).
4. O sistema agrega as conversas e mensagens no banco de dados.
5. O sistema retorna o payload JSON com as estatísticas.
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Crew não encontrada ou pertence a outro tenant | Retorna 404 Not Found |
| Sem conversas na crew | Retorna todas as métricas com valor `0` ou arrays vazios |
| Usuário não autenticado | Retorna 401 Unauthorized |

---

## 7. Critérios de aceite

- Dado um `crewId` válido, quando eu solicitar suas métricas, então devo receber as contagens corretas de conversas, mensagens e detalhamento por agente.
- Dado um `crewId` de outro tenant, quando eu tentar consultar suas métricas, então devo receber um erro `CREW_NOT_FOUND`.

---

## 8. Contratos de entrada e saída

```typescript
// Input (Use-Case)
type GetCrewMetricsInput = {
  tenantId: string
  crewId: string
}

// Output
type GetCrewMetricsOutput = {
  totalConversations: number
  activeConversations: number
  totalMessages: number
  messagesByAgent: {
    agentId: string
    count: number
  }[]
}
```

---

## 9. Impacto arquitetural

- [ ] Nova entidade: N/A
- [ ] Novo use-case: `GetCrewMetrics`
- [ ] Nova API route: `GET /api/v1/crews/:id/metrics`
- [ ] Alteração em `ICrewRepository` para injetar esse método de agregação ou uso do `IConversationRepository` para buscar. Como a métrica é da Crew, mas as conversas estão no `conversation`, podemos adicionar métodos `getMetricsByCrewId` no `IConversationRepository`.

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Performance em crews com milhões de mensagens | Baixa (por ora) | Médio | Usar query de agregação COUNT() diretamente no banco de dados (Prisma) em vez de carregar registros na memória. |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/crew/` ou `conversation/`):**
- [ ] `deve retornar as métricas zeradas para uma crew sem conversas`
- [ ] `deve agregar corretamente totalConversations e activeConversations`
- [ ] `deve retornar erro 404 se a crew não pertencer ao tenant`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** Apenas dados estatísticos agregados (count).
- **Dados sensíveis:** Nenhum PII exposto, apenas IDs e contagens.

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` é validado ao carregar a Crew.
- As queries de count e groupBy devem incluir o filtro `tenantId`.
