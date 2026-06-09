# Workflow e Handoff entre Agentes (Fase 1.5)

> **Status:** APPROVED
> **Domínio:** conversation / crew
> **Autor:** @antigravity
> **Data:** 2026-06-05

---

## 1. Objetivo

Permitir que agentes de IA repassem (handoff) uma conversa em andamento para outro agente da mesma equipe (Crew) de forma fluida, mantendo o histórico, e disparando o workflow adequado de continuação.

---

## 2. Contexto de negócio

No Crew Builder (Fase 1.2 e 1.4), introduzimos as equipes que possuem múltiplos agentes, liderados por um Diretor. No entanto, atualmente a conversa fica fixada no agente que a iniciou (o Diretor). Para um sistema multiagente real, o Diretor (ex: SDR) precisa ser capaz de passar o bastão para um Especialista (ex: Closer) assim que seu papel for cumprido (ex: qualificação finalizada).

---

## 3. Problema que resolve

- Agentes únicos não conseguem resolver todos os problemas de forma especialista.
- A falta de transição inviabiliza fluxos de "triagem -> especialista" ou "qualificação -> venda".

---

## 4. Regras de negócio

1. O Handoff só pode ocorrer entre agentes que pertencem à mesma `Crew`.
2. A identificação de que um Handoff deve ocorrer se dá através de uma **Tool Call** (function calling) feita pelo LLM (ex: `transferToAgent(agentSlug)` ou `transferToRole(role)`).
3. Quando a Tool de Handoff for acionada, a conversa tem seu `agentId` atualizado para o novo agente alvo.
4. O histórico de mensagens (`ConversationHistory`) é mantido, mas o contexto de sistema (`BuildRAGContext`) da próxima mensagem passará a usar as configurações (Prompt, KBs) do *novo* agente.
5. Um log/mensagem de sistema ("A conversa foi transferida para [Nome do Agente]") pode opcionalmente ser gerada e enviada para o usuário no chat.

---

## 5. Fluxos principais

```
1. Usuário envia mensagem para o chat da Crew.
2. Conversa é roteada para o Agente 1 (Diretor).
3. Agente 1 decide que o atendimento deve ir para o Agente 2 (Especialista) e chama a Tool `transfer_conversation({ targetRole: 'MEMBER', order: 2 })`.
4. Sistema intercepta a chamada da Tool.
5. Sistema atualiza o `agentId` da `Conversation` no banco de dados para o ID do Agente 2.
6. Sistema retorna o status do Handoff (se sucesso ou falha).
7. Agente 1 finaliza sua resposta avisando o usuário (ex: "Vou passar para o meu colega agora").
8. A próxima mensagem do usuário será roteada e processada pelo Agente 2.
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Agente tenta transferir para Role que não existe na Crew | Tool retorna erro informando que o alvo não existe e instrui o agente a continuar o atendimento ou tentar outro alvo. |
| Crew não está definida na Conversa | Tool de handoff fica desabilitada/indisponível para esse agente ou retorna erro. |
| Agente tenta transferir para si mesmo | Tool retorna "already handling" ou ignora com sucesso. |

---

## 7. Critérios de aceite

- Dado que uma conversa tem uma Crew associada, quando o agente atual decide transferir, então a conversa passa a pertencer ao novo agente da Crew.
- Dado um Handoff realizado, quando a próxima mensagem chegar, então o `BuildRAGContext` deve gerar o prompt do novo agente.
- Dado um Handoff, o histórico completo da conversa precisa continuar visível para o novo agente.
- Dado que uma conversa NÃO tem Crew (é apenas um agente solto), a funcionalidade de Handoff não deve permitir transferir para agentes arbitrários fora do escopo.

---

## 8. Contratos de entrada e saída

**Tool de LLM (exposta para OpenAI):**
```typescript
{
  name: 'transfer_conversation',
  description: 'Transfere a conversa atual para outro membro da equipe.',
  parameters: {
    type: 'object',
    properties: {
      targetRole: { type: 'string', enum: ['DIRECTOR', 'MEMBER', 'OBSERVER'] },
      targetAgentSlug: { type: 'string', description: 'O slug do agente alvo (opcional se enviar targetRole)' }
    }
  }
}
```

**Novo Use-Case (TransferConversation):**
```typescript
type TransferConversationInput = {
  tenantId: string
  conversationId: string
  targetAgentId: string
}
```

---

## 9. Impacto arquitetural

- [ ] Nova entidade: `TransferLog` ou apenas manter via `AuditLog` e histórico de messages.
- [ ] Novo use-case: `TransferConversation` (no domínio de `conversation`).
- [ ] Alteração no Use-Case `BuildRAGContext` ou no `OpenAILLMProvider` para injetar a ferramenta `transfer_conversation` nas funções disponíveis do LLM se a conversa pertencer a uma Crew.
- [ ] Alteração no Use-Case `SendMessage` para processar chamadas de ferramenta e executar o Handoff.

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| LLM entrar em loop transferindo de volta um para o outro | Baixa | Alto | Adicionar regra no system prompt ou limite de handoffs por conversa no backend. |
| Alucinação no nome/slug da role | Média | Baixa | Retornar os roles válidos disponíveis na crew injetados no system prompt, e tratar erros graciosamente se a ferramenta falhar. |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/conversation/`):**
- [ ] `deve transferir a conversa para um novo agente válido da crew`
- [ ] `deve rejeitar handoff se o target não pertencer à crew`
- [ ] `SendMessage deve expor a tool de handoff apenas se conversation tem crewId`

**Integração (`tests/integration/`):**
- [ ] `fluxo completo de handoff via LLM tools call`

---

## 12. Critérios LGPD e privacidade
- O Handoff repassa o histórico de mensagens para o outro agente. Como ambos os agentes pertencem à mesma empresa (Tenant), não há vazamento inter-tenant nem vazamento PII entre entidades não autorizadas.

---

## 13. Critérios de isolamento multi-tenant
- O `TransferConversation` precisa validar que a `Conversation` pertence ao `tenantId` e que o `targetAgentId` também pertence ao `tenantId`.
