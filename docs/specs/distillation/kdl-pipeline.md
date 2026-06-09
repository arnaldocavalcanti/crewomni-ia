# Knowledge Distillation Layer (KDL) Pipeline

> **Status:** APPROVED  
> **Domínio:** distillation  
> **Autor:** @arnaldo  
> **Data:** 2026-06-08  
> **Fase:** 2.4 — KDL + Industry KB + Master Agents  
> **Depende de:** ADR 005 (KDL Pipeline), conversation spec

---

## 1. Objetivo

Definir o fluxo de coleta, extração de insights, deduplicação e promoção de conhecimento prático a partir de conversas de atendimento finalizadas de tenants para a base de conhecimento do nicho (Industry KB), sem expor dados brutos ou violar o isolamento multi-tenant.

---

## 2. Contexto de negócio

O CrewOmni acumula centenas de interações diárias. Esses dados contêm respostas altamente eficientes para dúvidas comuns de mercado. A KDL destila esses padrões para enriquecer o prompt dos agentes do mesmo nicho, gerando agentes mais espertos sem que cada tenant precise configurar centenas de regras manuais. O valor é a inteligência coletiva embarcada.

---

## 3. Problema que resolve

- Configuração manual exaustiva de FAQs e bases de conhecimento para novos tenants.
- Fragmentação de conhecimento de mercado.
- Risco de vazamento de informações privadas (ao extrair e anonimizar rigorosamente com LLM + aprovação humana).

---

## 4. Regras de negócio

1. O pipeline de destilação é executado por nicho (`SUPPORT`, `REAL_ESTATE`, `ESIGN`, etc.).
2. Apenas conversas em status `CLOSED` que não foram processadas anteriormente são analisadas.
3. Conversas pertencentes a tenants com `kdlOptOut = true` em suas configurações de tenant são ignoradas.
4. O processo de extração deve obrigatoriamente anonimizar a conversa, removendo PII (nomes, e-mails, telefones, documentos, valores monetários) e referências de marcas específicas antes de propor o insight.
5. Os insights extraídos são salvos como `KDLInsight` com status `PENDING_REVIEW`.
6. Um usuário com papel `KDL_APPROVER` ou `PLATFORM_ADMIN` deve aprovar o insight para promovê-lo a `APPROVED`.
7. Insights promovidos a `APPROVED` são convertidos em `KnowledgeDocument` associados ao nicho correspondente e marcados como layer `INDUSTRY`.
8. O processo de execução do pipeline pode ser acionado de forma programática ou via rota de administração (`POST /api/v1/admin/kdl/run`).

---

## 5. Fluxos principais

### Execução do Pipeline (Job de Destilação)
```
1. Admin dispara POST /api/v1/admin/kdl/run
2. Sistema busca conversas CLOSED não destiladas das últimas 24h por nicho
3. Sistema filtra conversas removendo as de tenants com opt-out
4. Para cada conversa:
   a. Limpa PII (scrubbing básico por regex de email/telefone)
   b. Chama gpt-4o-mini com prompt de extração de padrões
   c. Se LLM retornar padrão genérico válido com confiança ≥ 0.8:
      Cria KDLInsight em status PENDING_REVIEW
5. Sistema retorna contagem de conversas analisadas e insights gerados
```

### Aprovação e Promoção de Insight
```
1. KDL_APPROVER acessa lista de insights PENDING_REVIEW
2. KDL_APPROVER chama endpoint de aprovação (status → APPROVED)
3. Sistema:
   a. Transita status para APPROVED
   b. Cria um KnowledgeDocument na layer INDUSTRY para o nicho correspondente contendo a pergunta e resposta genéricas
   c. Gera chunks e indexa no vetor (simulado no MVP)
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Tenant com opt-out ativo | Conversas são completamente excluídas no início do job |
| Conversa sem padrão útil | LLM retorna skip=true, nenhuma entidade KDLInsight é persistida |
| Chamada de LLM falha | Salva log de erro e continua processando próximas conversas |
| Usuário não-admin chama job | Retorna 403 Forbidden |

---

## 7. Critérios de aceite

- Dado conversas de um tenant com `kdlOptOut = true`, quando o job KDL roda, então nenhuma conversa desse tenant é coletada ou analisada.
- Dado uma conversa com informações de PII, quando processada pelo extrator, então o insight gerado tem as informações mascaradas.
- Dado um insight em status `PENDING_REVIEW`, quando aprovado por um `KDL_APPROVER`, então seu status muda para `APPROVED` e um `KnowledgeDocument` do nicho na layer `INDUSTRY` é criado.
- Dado um insight em status `PENDING_REVIEW`, quando rejeitado, então seu status muda para `REJECTED` e nenhum documento é criado.

---

## 8. Contratos de entrada e saída

```typescript
export enum KDLInsightStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type KDLInsight = {
  id: string
  niche: string
  questionPattern: string
  answerPattern: string
  sourceCount: number
  confidence: number
  status: KDLInsightStatus
  reviewedBy?: string
  reviewedAt?: Date
  createdAt: Date
}

export type RunKDLInput = {
  niche: string
}

export type ReviewInsightInput = {
  insightId: string
  status: 'APPROVED' | 'REJECTED'
  reviewedBy: string
}
```

---

## 9. Impacto arquitetural

- [ ] Nova tabela no banco: `kdl_insights`
- [ ] Nova entidade: `KDLInsight`
- [ ] Novo use-case: `RunKDL`
- [ ] Novo use-case: `ReviewKDLInsight`
- [ ] Nova API route: `POST /api/v1/admin/kdl/run`
- [ ] Nova API route: `POST /api/v1/admin/kdl/insights/:id/review`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Vazamento de dados em insights | Baixa | Alto | Aprovação humana obrigatória por KDL_APPROVER antes de promover o insight |
| Custo de processamento elevado | Baixa | Baixo | Job restringe a processar no máximo 50 conversas por execução no MVP |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/distillation/`):**
- [ ] `deve rodar KDL filtrando tenants com opt-out`
- [ ] `deve gerar insight com dados anonimizados`
- [ ] `deve promover insight aprovado para a base de conhecimento do nicho`

**Integração (`tests/integration/`):**
- [ ] `apenas administradores ou KDL_APPROVER podem aprovar insights`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** insights genéricos (pergunta genérica, resposta genérica), sem PII.
- **Retenção:** KDLInsight retido indefinidamente se aprovado para compor a Industry KB.
- **Exclusão:** Se um tenant solicita exclusão de dados, suas conversas brutas são apagadas. Como os insights já promovidos são genéricos e anonimizados, não contêm PII e não são afetados.

---

## 13. Critérios de isolamento multi-tenant

- KDLInsights e a base de conhecimento INDUSTRY pertencem a um **nicho**, e não a um tenant específico.
- O isolamento é garantido na origem: os dados brutos de turnos/conversas nunca são lidos por outros tenants, apenas o conhecimento genérico destilado e aprovado.
