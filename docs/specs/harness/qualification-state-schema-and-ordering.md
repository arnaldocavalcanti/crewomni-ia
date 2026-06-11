# Qualification State — Schema por Nicho e Sequenciamento de Extração

> **Status:** APPROVED
> **Domínio:** harness / qualification
> **Autor:** @arnaldocavalcanti
> **Data:** 2026-06-11

---

## 1. Objetivo

Eliminar o loop de re-pergunta, a alucinação de dados e o atraso de um turno no agente SDR, tornando o schema de qualificação configurável por agente/nicho e garantindo que o estado extraído esteja sempre disponível antes da construção do prompt RAG.

---

## 2. Contexto de negócio

O CrewOmni permite que tenants criem agentes SDR altamente especializados por nicho (vistoria imobiliária, assinatura eletrônica, etc.). Cada nicho coleta campos completamente diferentes durante a qualificação de um lead. O schema atual é um template B2B genérico hardcoded (`numero_colaboradores`, `usa_crm`, `nivel_interesse`, `objecao`) que não corresponde aos dados coletados pelos SDRs reais em produção.

Caso de referência: **SDR da Devolus** (nicho: vistoria imobiliária) — coleta `tipo_vistoria`, `volume_mensal`, `sistema_atual`, `dor_principal`, `urgencia` etc., nenhum desses campos existe no schema atual.

---

## 3. Problema que resolve

Quatro causas raízes identificadas em produção:

| # | Causa raiz | Sintoma observado |
|---|---|---|
| 1 | **Schema mismatch** — schema genérico não tem os campos do SDR de vistoria | Loop infinito de re-pergunta; estado fica cego para respostas do lead |
| 2 | **Race condition** — `ExtractAndUpdateState` e `BuildRAGContext` rodavam em paralelo via `Promise.allSettled`; RAG lia estado pré-extração | Atraso de exatamente um turno entre responder e o agente "reconhecer" o dado |
| 3 | **Few-shot contaminado** — system prompt continha literais de exemplo ("50 vistorias") que o LLM copiava como fatos | Agente afirmava dados que o lead nunca forneceu |
| 4 | **Prompt não harness-aware** — não referenciava o bloco `---ESTADO DA QUALIFICAÇÃO---` injetado pelo RAG | LLM reconstruía estado errado a partir de buffer truncado, ignorava a fonte de verdade |

As causas 2, 3 e 4 foram parcialmente mitigadas no commit `e3c991d`. Esta spec resolve a causa 1 definitivamente e formaliza as demais em arquitetura versionada.

---

## 4. Regras de negócio

1. O schema de qualificação é **por agente/nicho**: cada agente pode ter um `qualificationSchemaId` configurado.
2. Se o agente não tiver schema configurado, usa o **schema padrão do tenant**; se o tenant também não tiver, usa o schema **global genérico** (fallback).
3. O schema é **imutável por versão**: mudanças criam uma nova versão; dados históricos mantêm referência à versão original.
4. A extração de estado **deve commitar antes** da construção do prompt RAG — sem exceções.
5. Um campo só recebe valor se houver **evidência literal** do lead nos últimos 3 turnos; sem evidência → `null`.
6. **Merge não-destrutivo**: nulo→valor sempre permitido; valor→valor diferente só com evidência explícita nova.
7. O sistema injeta `proximo_campo` (determinístico via `PickNextField`) no bloco de estado do prompt — o LLM não decide qual campo perguntar a seguir.
8. Campos do tipo `enum` são validados por Zod antes do merge; valor fora do enum → rejeitado, campo mantém valor anterior.
9. Campos do tipo `integer` são validados com `min`/`max` do `FieldDef`; fora do range → rejeitado.
10. Schemas globais (`tenantId = null`) são somente leitura; só a plataforma pode criar/editar.
11. Dados de schema de um tenant nunca vazam para outro tenant (RLS + tenantId em todas as queries).
12. `telefone` e `email` — quando presentes no schema — são tratados como dados pessoais: armazenados criptografados, excluídos no direito ao esquecimento.
13. A extração falha silenciosamente (mantém estado anterior + loga) — nunca trava o pipeline de mensagem.

---

## 5. Fluxos principais

### 5.1 — Resolução e extração de estado (por mensagem)

```
1. SendMessage recebe mensagem do lead
2. Carrega ou cria QualificationState da conversa
3. GetQualificationSchema resolve schema pelo agente (agent → tenant → global)
4. [PARALELO] dispara busca vetorial nas KBs (componente lento, independente do estado)
5. [SEQUENCIAL] ExtractAndUpdateState:
   a. Gera prompt de extração dinâmico a partir do schema
   b. Inclui últimos 3 turnos como contexto
   c. LLM retorna [ { field, value, evidence } ]
   d. ValidateAndMerge valida cada campo e aplica merge não-destrutivo
   e. Persiste novo estado no banco
6. [AGUARDA] busca vetorial concluída
7. BuildRAGContext:
   a. Monta bloco ---ESTADO DA QUALIFICAÇÃO--- a partir do schema e estado atualizado
   b. Inclui proximo_campo = PickNextField(schema, state)
   c. Inclui stage e lastIntent
8. LLM gera resposta com estado correto e próximo campo determinístico
```

### 5.2 — Resolução de schema (GetQualificationSchema)

```
1. Busca Agent por agentId + tenantId
2. Se agent.qualificationSchemaId → retorna esse schema
3. Senão busca schema padrão do tenant (nicheKey do tenant)
4. Senão retorna schema global genérico (tenantId = null, nicheKey = 'generic')
5. Se nenhum encontrado → lança QUALIFICATION_SCHEMA_NOT_FOUND
```

### 5.3 — ValidateAndMerge

```
1. Para cada { field, value, evidence } no delta:
   a. Localiza FieldDef no schema
   b. Gera schema Zod dinamicamente (enum, integer com range, string, boolean)
   c. Valida value com Zod
   d. Se inválido → adiciona a rejectedKeys, mantém valor anterior
   e. Se válido e campo atual é null → aplica (nulo→valor)
   f. Se válido e campo atual tem valor:
      - evidence presente → aplica (correção do lead)
      - evidence ausente → mantém valor anterior, adiciona a rejectedKeys
2. Persiste estado merged
3. Retorna { newState, changedKeys, rejectedKeys }
4. Audit log registra { action: 'qualification.state.merged', changedKeys, rejectedKeys }
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| LLM de extração falha (timeout, parse error) | Mantém estado anterior; loga WARN; pipeline continua normalmente |
| Schema não encontrado para o agente | Usa schema global genérico; nunca lança erro para o lead |
| Campo extraído não existe no schema | Ignorado silenciosamente (não é rejectedKey, apenas descartado) |
| Evidência ausente para campo já preenchido | Mantém valor anterior; registra em rejectedKeys no audit |
| Valor fora do enum | Rejeitado; registra em rejectedKeys no audit |
| Integer fora do range min/max | Rejeitado; registra em rejectedKeys no audit |
| PickNextField retorna null (tudo preenchido) | Bloco de estado não inclui `proximo_campo`; stage avança para CONTACT_COLLECTED |
| Tenant tenta editar schema global | Retorna 403 FORBIDDEN |

---

## 7. Critérios de aceite

- Dado um agente SDR com schema `vistoria-imobiliaria`, quando o lead responde "internamente" após "vocês fazem vistorias internamente ou terceirizam?", então o campo `tipo_vistoria` recebe `propria` e o agente avança para o próximo campo sem repetir.
- Dado um lead que nunca mencionou volume, quando o LLM processa a resposta, então o campo `volume_mensal` permanece `null` e o agente não afirma nenhum valor de volume.
- Dado campo `tipo_empresa` já preenchido com `imobiliaria`, quando o lead não fornece nova evidência, então o campo não é sobrescrito mesmo que a extração retorne outro valor.
- Dado campo `volume_mensal` com `FieldDef { type: 'integer', min: 0, max: 10000 }`, quando a extração retorna `-5` ou `99999`, então o campo é rejeitado e mantém valor anterior.
- Dado que `ExtractAndUpdateState` falha com timeout, quando o pipeline continua, então a resposta ao lead é gerada normalmente com o estado anterior.
- Dado schema `vistoria-imobiliaria` com 15 campos e `order` definido, quando `PickNextField` é chamado e os 3 primeiros campos estão preenchidos, então retorna o 4º campo da ordem.
- Dado agente sem `qualificationSchemaId`, quando `GetQualificationSchema` é chamado, então retorna o schema global genérico sem erro.
- Dado tenant A e tenant B com schemas distintos, quando `GetQualificationSchema` é chamado para agente do tenant A, então nunca retorna schema do tenant B.
- Dado o bloco `---ESTADO DA QUALIFICAÇÃO---` no system prompt, quando `proximo_campo` é `tipo_vistoria`, então o LLM usa essa dica e pergunta sobre vistorias em vez de reinventar o fluxo.

---

## 8. Contratos de entrada e saída

```typescript
// GetQualificationSchema
type GetQualificationSchemaInput = {
  agentId: string
  tenantId: string
}
type GetQualificationSchemaOutput = QualificationSchema

// ValidateAndMerge
type ValidateAndMergeInput = {
  state: QualificationState
  delta: { field: string; value: unknown; evidence: string | null }[]
  schema: QualificationSchema
}
type ValidateAndMergeOutput = {
  newState: QualificationState
  changedKeys: string[]
  rejectedKeys: string[]
}

// PickNextField
type PickNextFieldInput = {
  schema: QualificationSchema
  state: QualificationState
}
type PickNextFieldOutput = string | null  // key do próximo campo, ou null se completo

// ExtractAndUpdateState (atualizado)
type ExtractAndUpdateStateInput = {
  state: QualificationState
  schema: QualificationSchema
  message: string
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
}
type ExtractAndUpdateStateOutput = {
  newState: QualificationState
  changedKeys: string[]
  rejectedKeys: string[]
}

// Erros de domínio
type QualificationErrors =
  | 'QUALIFICATION_SCHEMA_NOT_FOUND'
  | 'QUALIFICATION_STATE_NOT_FOUND'
  | 'SCHEMA_TENANT_MISMATCH'
  | 'FORBIDDEN_SCHEMA_EDIT'
```

---

## 9. Impacto arquitetural

- [x] Nova tabela: `qualification_schemas` (id, tenantId nullable, nicheKey, version, fields JSONB, order JSONB, createdAt)
- [x] Alteração em tabela: `qualification_states` — adicionar coluna `schemaId` (nullable inicialmente; NOT NULL após backfill)
- [x] Alteração em tabela: `agents` — adicionar coluna `qualificationSchemaId` (nullable)
- [x] Nova entidade: `QualificationSchema`
- [x] Nova entidade: `FieldDef`
- [x] Entidade `QualificationState` — campo `fields` muda de `QualificationFields` (tipado fixo) para `Record<string, unknown>` (dinâmico)
- [x] Nova interface: `IQualificationSchemaRepository`
- [x] Novo use-case: `GetQualificationSchema`
- [x] Novo use-case: `ValidateAndMerge` (puro, sem LLM)
- [x] Novo use-case: `PickNextField` (puro, síncrono)
- [x] Use-case alterado: `ExtractAndUpdateState` — prompt dinâmico por schema + evidência + ValidateAndMerge
- [x] Use-case alterado: `BuildRAGContext.buildSystemPrompt` — bloco de estado dinâmico + `proximo_campo`
- [x] Use-case alterado: `SendMessage` — passa schema para extração; sequenciamento explícito
- [x] Novo seed: `src/infrastructure/seeds/qualification-schemas/vistoria-imobiliaria.ts`
- [x] Migration Prisma: `add_qualification_schema_per_agent`
- [x] InMemory repositories: `InMemoryQualificationSchemaRepository`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Backfill de QualificationState existentes com schemaId | Média | Alto | Script de backfill; coluna nullable durante transição |
| Regressão em tenants com schema genérico atual | Baixa | Médio | Fallback para schema global genérico; testes de regressão existentes |
| Latência extra (~100ms) por extração sequencial | Alta | Baixo | Busca vetorial em paralelo com extração; custo absorvido na correção |
| LLM retorna evidence falsa | Média | Médio | Regra no prompt: "evidência deve ser trecho literal da mensagem do lead" |
| Schema versionado exige migração ao editar | Baixa | Baixo | Tenants criam nova versão; dados antigos mantêm referência original |

---

## 11. Testes esperados

**Unitários (`tests/unit/qualification/`):**
- [ ] `PickNextField: deve retornar primeiro campo nulo na order`
- [ ] `PickNextField: deve pular campos já preenchidos`
- [ ] `PickNextField: deve retornar null quando todos preenchidos`
- [ ] `PickNextField: deve ignorar chaves fora do schema`
- [ ] `ValidateAndMerge: deve rejeitar enum inválido`
- [ ] `ValidateAndMerge: deve rejeitar integer fora do range`
- [ ] `ValidateAndMerge: deve aceitar enum válido com evidência`
- [ ] `ValidateAndMerge: deve manter valor sem evidência (não sobrescrever)`
- [ ] `ValidateAndMerge: deve sobrescrever com evidência explícita`
- [ ] `ValidateAndMerge: deve retornar changedKeys e rejectedKeys corretos`
- [ ] `GetQualificationSchema: deve retornar schema do agente quando configurado`
- [ ] `GetQualificationSchema: deve fallback para schema global quando agente sem schema`
- [ ] `GetQualificationSchema: deve isolamento — nunca retornar schema de outro tenant`

**Integração (`tests/integration/qualification/`):**
- [ ] `SDR vistoria flow: conversa completa avança exatamente um campo por turno sem repetir`
- [ ] `SDR vistoria flow: lead nunca tem dado inventado que não foi mencionado`
- [ ] `SDR vistoria flow: resposta curta "internamente" classifica tipo_vistoria=propria`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** campos configurados no schema (ex: whatsapp, email, nome_contato)
- **Finalidade:** qualificação e priorização de leads para conversão comercial
- **Retenção:** mesma política da Conversa associada (padrão: 90 dias após encerramento)
- **Exclusão:** ao deletar a Conversa, o QualificationState é deletado em cascata
- **Dados sensíveis:** `whatsapp`, `email`, `nome_contato` — criptografados em repouso (AES-256-GCM via `decryptIfPresent`); tratamento atual mantido
- **KDL:** campos de `dor_principal`, `urgencia`, `sistema_atual` podem ser distilados anonimizados por nicho após aprovação humana — sem dados de identificação pessoal

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todas as queries de `QualificationSchema` e `QualificationState`? **Sim**
- Schema com `tenantId = null` é somente leitura (global)? **Sim**
- `GetQualificationSchema` valida que o schema retornado pertence ao tenant do agente ou é global? **Sim**
- RLS cobre `qualification_schemas` e `qualification_states`? **A implementar na migration**
- Cache (futuro) usa prefixo do tenant? **A implementar quando Redis for adicionado**
- Audit log registra `tenantId` em `qualification.state.merged`? **Sim**
- Testes de isolamento escritos? **Sim (ver seção 11)**
