# Advanced Analytics & Operational Metrics

> **Status:** APPROVED
> **Domínio:** analytics / dashboard
> **Autor:** Antigravity
> **Data:** 2026-06-08

---

## 1. Objetivo

Implementar a camada de Analytics Avançado (Fase 3.4), coletando, processando e exibindo métricas operacionais e de negócio por canal, agente, tenant e conversa, alimentadas pelos dados gerados pela Agent Harness Core.

---

## 2. Contexto de negócio

Para gestores e administradores do tenant, não basta ver que as conversas estão acontecendo. É necessário entender a performance da operação, os custos envolvidos (tokens/LLM), a volumetria por canal e gargalos (ex: muitos handoffs em um agente específico). Isso permite otimização de prompts e melhoria contínua.

---

## 3. Problema que resolve

- Falta de visibilidade sobre o custo de IA por conversa ou agente.
- Dificuldade em identificar gargalos na fila de processamento.
- Dificuldade em mensurar a eficácia (tempo de resposta, taxa de resolução vs handoff).

---

## 4. Regras de negócio

1. **Agregação em Tempo Real:** As métricas devem refletir o estado atual do banco de dados (com possível cache leve para evitar queries pesadas, ex: 1 a 5 minutos).
2. **Isolamento Multi-Tenant:** Todas as queries de agregação devem filtrar rigorosamente pelo `tenantId` da sessão logada.
3. **Indicadores de Custo e Uso:** Deve utilizar a base de dados do `AgentExecutionTrace` e `TenantUsageCurrent` para exibir tokens consumidos e custos acumulados.
4. **Resoluções por Agente:** Deve calcular o tempo médio de resposta, a quantidade de tokens/conversa, e a taxa de handoff (conversas que chegaram a `HANDOFF_REQUESTED` vs conversas totais) para cada agente.

---

## 5. Fluxos principais

1. O administrador acessa a página do Dashboard `/dashboard/analytics`.
2. A página faz chamadas paralelas para os endpoints de API de métricas (Agentes, Canais, Conversas, Fila).
3. O Backend calcula as agregações no banco de dados (Prisma groupBy/count/sum).
4. O Backend retorna os dados agregados para o período selecionado (ex: últimos 7 dias, último mês).
5. O Frontend renderiza os dados utilizando gráficos (sparklines, barras, pizza) e cards de summary.

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Tenant sem histórico de uso | Dashboard exibe "Empty States" apropriados nos gráficos informando que não há dados no período. |
| Período muito longo requisitado (ex: 10 anos) | A API retorna 400 Bad Request se a range for maior que o permitido (ex: max 12 meses). |

---

## 7. Critérios de aceite

- Dado um tenant com conversas registradas, quando o admin acessa o analytics, então ele deve visualizar cards com total de mensagens, conversas ativas, e custo de tokens.
- Dado um tenant com 3 agentes, quando o admin acessa o analytics, então deve ver uma tabela comparativa com tokens/conversa e taxa de handoff por agente.
- Dado um admin de um tenant A, quando acessa o analytics, então os resultados não podem sob nenhuma hipótese conter dados do tenant B.

---

## 8. Contratos de entrada e saída

### GET /api/v1/analytics/overview?timeRange=7d
**Output:**
```json
{
  "totalConversations": 1450,
  "totalMessages": 4320,
  "totalTokens": 250000,
  "handoffRate": 0.15,
  "sparklines": {
    "conversations": [120, 150, 200, 180, 220, 250, 330]
  }
}
```

### GET /api/v1/analytics/agents?timeRange=7d
**Output:**
```json
[
  {
    "agentId": "uuid",
    "name": "SDR Agent",
    "conversationsHandled": 500,
    "avgTokensPerConversation": 150,
    "handoffRate": 0.10
  }
]
```

---

## 9. Impacto arquitetural

- [ ] Novo Domínio: Criar a pasta `src/domains/analytics` contendo repositórios (ou views) e Use-cases de agregação de métricas.
- [ ] O repositório utilizará métodos nativos de agregação do Prisma (ou raw SQL) focando apenas em leitura (`Read-Only`).
- [ ] Componentes React: Instalação de biblioteca de gráficos (ex: Recharts) caso o shadcn/ui não contemple gráficos complexos, para gerar as sparklines e charts.

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Consultas de agregação pesadas (slow queries) devido ao volume de mensagens. | Alta | Alto | Adicionar índices corretos no PostgreSQL (ex: em `createdAt` e `tenantId`) e implementar um micro-cache em memória para requisições repetidas da mesma métrica no mesmo intervalo. |

---

## 11. Testes esperados

**Integração:**
- Teste verificando que `GetOverviewMetrics` e `GetAgentMetrics` retornam valores calculados corretamente (sum, avg).
- Teste garantindo que dados de um tenant diferente não são contabilizados na agregação.

---

## 12. Critérios LGPD e privacidade

- Analytics exibe dados estritamente agregados. Nenhuma informação pessoal identificável (PII) é exibida nos relatórios (sem nomes de contatos ou conteúdo das mensagens).

---

## 13. Critérios de isolamento multi-tenant

- `WHERE tenantId = X` é compulsório e intransponível em toda query de agregação no Prisma.
