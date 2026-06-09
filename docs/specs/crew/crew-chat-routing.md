# Crew Chat Routing (Fase 1.4)

> **Status:** DRAFT
> **Domínio:** crew, conversation
> **Autor:** @crewomni
> **Data:** 2026-06-05

---

## 1. Objetivo

Permitir que uma conversa via Widget ou API possa ser iniciada direcionada a uma equipe inteira (`Crew`) em vez de um agente específico (`Agent`). A conversa será roteada inicialmente para o agente que possui o papel de `DIRECTOR` na equipe.

---

## 2. Contexto de negócio

No mundo real, um cliente entra em contato com um "Departamento Comercial" ou "Equipe de Suporte", e não diretamente com o agente João ou a agente Maria. Direcionar o tráfego para a `Crew` permite que o Diretor da equipe atenda a solicitação inicial e prepare o terreno para futuras transferências de atendimento (handoff - Fase 1.5).

---

## 3. Problema que resolve

Atualmente, o widget de chat e as APIs de conversação estão acopladas estritamente a um `agentSlug`. Isso inviabiliza o uso das equipes criadas na Fase 1.2 (Crew Builder) para atendimento externo. O roteamento básico resolve essa limitação inicial, mantendo o controle da conversa nas mãos do `DIRECTOR` da equipe.

---

## 4. Regras de negócio

1. O modelo `Conversation` passa a suportar um `crewId` opcional.
2. O Widget Público e a API `SendMessage` passam a aceitar `crewSlug` (ou `crewId`) como alternativa ao `agentSlug` (`agentId`).
3. Quando uma conversa é iniciada via `crewSlug`, o sistema busca a `Crew` correspondente e identifica o `CrewMember` com a regra de `DIRECTOR`.
4. O `agentId` da `Conversation` será automaticamente preenchido com o `agentId` do `DIRECTOR` da equipe. O `crewId` também será salvo na `Conversation`.
5. Se uma `Crew` for chamada mas não possuir um `DIRECTOR`, a criação da conversa deve falhar com erro `CREW_HAS_NO_DIRECTOR`.
6. Para conversas já existentes (com `conversationId` na requisição), o roteamento ignora o `crewSlug` e usa o `agentId` que já está salvo na conversa.

---

## 5. Fluxos principais

### Iniciar conversa via Crew no Widget
1. Usuário acessa widget configurado com `?tenant=t1&crew=vendas`.
2. Widget chama `GET /api/v1/widget/config?tenant=t1&crew=vendas`.
3. Sistema resolve o tenant, busca a Crew "vendas", encontra o `DIRECTOR` e retorna a configuração visual deste agente.
4. Usuário digita uma mensagem. Widget faz `POST /api/v1/widget/chat` com `{ tenantSlug: 't1', crewSlug: 'vendas', message: 'Olá' }`.
5. Sistema valida a Crew, encontra o `DIRECTOR`.
6. `SendMessage` cria a nova `Conversation` com `agentId = director.agentId` e `crewId = crew.id`.
7. O fluxo de RAG e Chat ocorre normalmente usando o `DIRECTOR`.

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Crew não encontrada | Retorna 404 `CREW_NOT_FOUND` |
| Crew não possui DIRECTOR | Retorna 422 `CREW_HAS_NO_DIRECTOR` |
| Parâmetros insuficientes | Retorna 422 `VALIDATION_ERROR` (precisa informar `agentSlug` ou `crewSlug`) |

---

## 7. Critérios de aceite

- Dado um widget configurado para uma crew, quando a API de config for chamada, então deve retornar as informações do DIRECTOR.
- Dado um payload com `crewSlug`, quando enviado ao widget chat, então a `Conversation` criada deve conter o `crewId` e o `agentId` do DIRECTOR.
- Dado um payload de mensagem sem `agentId` e com `crewId`, quando a crew não tiver DIRECTOR, então deve retornar erro.
- Dado o acesso via painel, o histórico de conversas deve retornar corretamente mesmo se a conversa tiver `crewId`.

---

## 8. Contratos de entrada e saída

**Widget Config:**
`GET /api/v1/widget/config?tenant=X&agent=Y` (mantido)
`GET /api/v1/widget/config?tenant=X&crew=Z` (novo)

**Widget Chat:**
```typescript
// Input
type ChatInput = {
  tenantSlug: string
  message: string
  agentSlug?: string  // opcional se houver crewSlug
  crewSlug?: string   // opcional se houver agentSlug
  conversationId?: string
}
```

---

## 9. Impacto arquitetural

- [x] Alteração no banco: model `Conversation` recebe `crewId` e fk para `Crew`. Migration gerada.
- [x] Alteração em entidade existente: `Conversation` type recebe `crewId: string | null`.
- [x] Modificação no use-case: `SendMessage.ts` aceita `crewId?` e repassa ao repository.
- [x] Novos Use-cases / métodos: `GetCrewBySlug` para buscar a crew e seus membros pelo slug público do widget.
- [x] Atualização de controllers: `app/api/v1/widget/config` e `app/api/v1/widget/chat`.

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Quebrar compatibilidade de integrações atuais | Baixa | Alto | Tornar o `crewSlug` opcional e manter o `agentSlug` funcionando de forma prioritária caso ambos sejam enviados. |
| Iniciar conversa em Crew sem Director | Média | Médio | Tratamento de erro 422 claro via API, orientando a adicionar um Director. |

---

## 11. Testes esperados

**Unitários:**
- [ ] `SendMessage`: deve criar conversa com `crewId` quando fornecido.
- [ ] `Widget Config`: deve retornar dados do director quando acessado via `crewSlug`.
- [ ] `Widget Config`: deve falhar se acessar via `crewSlug` que não possui director.
- [ ] `Widget Chat`: deve criar mensagem direcionada ao director de uma crew.

---

## 12. Critérios LGPD e privacidade

Não coleta novos dados pessoais. O `crewId` serve apenas para roteamento de serviço e estatísticas agregadas.

---

## 13. Critérios de isolamento multi-tenant

- O lookup de `Crew` pelo `crewSlug` obriga a validação do `tenantId`.
- O lookup do `DIRECTOR` restringe a busca à `Crew` que já foi isolada para o tenant.
