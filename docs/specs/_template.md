# [Nome da Feature]

> **Status:** DRAFT | REVIEW | APPROVED | IMPLEMENTED | DEPRECATED
> **Domínio:** tenant | agent | knowledge | conversation | distillation | auth
> **Autor:** @
> **Data:** YYYY-MM-DD

---

## 1. Objetivo

_Uma frase descrevendo o que essa feature faz._

---

## 2. Contexto de negócio

_Por que isso existe no produto? Qual é o valor para o tenant e/ou para a plataforma?_

---

## 3. Problema que resolve

_Qual dor, gap ou fricção essa feature elimina?_

---

## 4. Regras de negócio

_Lista numerada. Sem ambiguidade. Cada item deve ser testável._

1. 
2. 
3. 

---

## 5. Fluxos principais

_Passo a passo do caminho feliz (happy path)._

```
1. Ator faz X
2. Sistema valida Y
3. Sistema executa Z
4. Sistema retorna W
```

---

## 6. Fluxos alternativos

_Erros, edge cases, caminhos secundários._

| Situação | Comportamento esperado |
|---|---|
| Input inválido | Retorna 422 com mensagem descritiva |
| Recurso não encontrado | Retorna 404 |
| Sem permissão | Retorna 403 |
| Tenant não encontrado | Retorna 401 |

---

## 7. Critérios de aceite

_Formato: "dado X, quando Y, então Z". Um critério por linha. Estes viram os nomes dos testes._

- Dado [contexto], quando [ação], então [resultado esperado]
- Dado [contexto], quando [ação], então [resultado esperado]

---

## 8. Contratos de entrada e saída

```typescript
// Input
type FeatureInput = {
  tenantId: string
  // ...
}

// Output
type FeatureOutput = {
  // ...
}

// Erros esperados
type FeatureError =
  | 'TENANT_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
```

---

## 9. Impacto arquitetural

_O que muda na estrutura existente? Novas tabelas? Novos serviços? Novas dependências?_

- [ ] Nova tabela no banco: `nome_da_tabela`
- [ ] Nova entidade: `NomeDaEntidade`
- [ ] Novo use-case: `NomeDoUseCase`
- [ ] Nova API route: `POST /api/v1/recurso`
- [ ] Alteração em entidade existente: `NomeDaEntidade` — campo X adicionado

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| | | | |

---

## 11. Testes esperados

_Lista dos testes que devem existir. Um por critério de aceite + testes de isolamento._

**Unitários (`tests/unit/domains/<domínio>/`):**
- [ ] `deve [critério de aceite 1]`
- [ ] `deve [critério de aceite 2]`
- [ ] `deve rejeitar quando tenantId ausente`
- [ ] `deve rejeitar quando [input inválido]`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve acessar dados de tenant B através de [feature]`
- [ ] `contrato de API: POST /api/v1/[recurso] retorna shape correto`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** _lista o que é armazenado_
- **Finalidade:** _para que cada dado é usado_
- **Retenção:** _por quanto tempo e política de expiração_
- **Exclusão:** _como são deletados (direito ao esquecimento)_
- **Dados sensíveis:** _há dados pessoais? Como são protegidos?_
- **KDL:** _essa feature gera dados que podem ser distilados? Como?_

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todas as queries desta feature?
- RLS cobre as tabelas envolvidas?
- Vector store usa namespace do tenant?
- Cache usa prefixo do tenant?
- Audit log registra o `tenantId` em todos os eventos?
- Testes de isolamento escritos?
