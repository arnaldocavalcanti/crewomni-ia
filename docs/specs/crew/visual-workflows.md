# Visual Workflows com LangGraph (Fase 3.3)

> **Status:** IMPLEMENTED
> **Priority:** HIGH
> **Owner:** Core Teamcrew
> **Domínio:** crew
> **Autor:** @Agent
> **Data:** 2026-06-08

---

## 1. Objetivo

Permitir a criação, visualização e execução de fluxos de trabalho visuais (Workflows) para Crews, utilizando um motor de execução determinístico e com memória (LangGraph) perfeitamente integrado à *Agent Harness Core*.

---

## 2. Contexto de negócio

Hoje, a execução de uma Crew delega a responsabilidade de roteamento para um *Director* que decide (via LLM) qual agente atua a seguir. Isso é flexível, mas muitas empresas precisam de processos **estritos e determinísticos** (ex: o Agente de Triagem *sempre* atua antes do Agente de Negociação). Workflows visuais fornecem esse controle absoluto, transparência e reprodutibilidade, reduzindo erros (alucinações de roteamento) e o custo de execução.

---

## 3. Problema que resolve

- Falta de controle determinístico na ordem de atuação dos agentes.
- Roteamento LLM-baseado ("Orchestrator Agent") pode falhar, entrar em loop ou repassar para o agente errado.
- Falta de uma representação visual clara para o usuário sobre como o atendimento é processado internamente (Handoff e fluxo de aprovação).

---

## 4. Regras de negócio

1. Uma `Crew` pode ter zero ou um `CrewWorkflow` ativo associado.
2. O workflow é composto por nós (Nodes) e arestas (Edges).
3. Cada nó pode ser: um **Agent** (chamar um agente da crew), uma **Condition** (ramificação condicional LLM/Regex), ou **Wait** (aguardar input humano).
4. O `OrchestrateInboundMessage` deve verificar se a Crew da conversa possui um workflow ativo. Se sim, deve executar a etapa atual do workflow usando a interface `IWorkflowExecutor`.
5. O estado do workflow (checkpoint) deve ser persistido em `WorkflowState` para que chamadas subsequentes (como respostas do usuário no WhatsApp) continuem do nó onde pararam.

---

## 5. Fluxos principais

### Fluxo de Criação do Workflow (Frontend)
1. Tenant acessa a aba "Workflows" no painel da Crew.
2. Tenant arrasta nós (Agent, Condition) no canvas do `VisualWorkflowBuilder` (react-flow).
3. Tenant conecta os nós definindo o caminho.
4. Tenant clica em "Salvar".
5. Sistema salva os nodes/edges em formato JSON na tabela `CrewWorkflow`.

### Fluxo de Execução do Workflow (Backend)
1. Cliente envia mensagem (Canal -> Harness -> `OrchestrateInboundMessage`).
2. Harness verifica se a Crew atual tem um `CrewWorkflow`.
3. Harness inicializa o `IWorkflowExecutor` (LangGraph) passando o JSON do workflow e o `WorkflowState` da conversa.
4. LangGraph retoma a execução, chama o nó atual (ex: Agente Triagem).
5. Se o nó gera uma resposta ao usuário, o workflow pausa.
6. Harness persiste o novo estado no banco de dados e envia a resposta.

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Workflow contém um nó de Agente que foi deletado | LangGraph deve pausar o fluxo, disparar evento de fallback e rotear para atendimento humano. |
| Crew não possui workflow definido | Sistema usa fallback (o comportamento atual, onde o Crew Director decide o fluxo). |
| Estado do workflow corrompido | Reinicia o workflow a partir do nó `START` e loga um alerta (Trace). |

---

## 7. Critérios de aceite

- Dado um tenant criando um workflow, quando ele acessa o construtor visual, então ele deve poder arrastar e soltar agentes em um canvas do React Flow.
- Dado um workflow salvo, quando o backend recebe uma mensagem para aquela Crew, então o motor LangGraph deve ser capaz de carregar a definição em tempo de execução e acionar o primeiro agente da cadeia.
- Dado um workflow pausado (aguardando usuário), quando a mensagem do usuário chega, então o LangGraph deve retomar do nó exato em que parou (State persistence).

---

## 8. Contratos de entrada e saída

```typescript
// Interface do Motor de Execução
export interface IWorkflowExecutor {
  execute(params: {
    workflowId: string;
    conversationId: string;
    tenantId: string;
    inputMessage: string;
    currentState: any | null; // LangGraph State
  }): Promise<{
    response: string | null;
    newState: any;
    isFinished: boolean;
  }>;
}

// Representação de nós e arestas no BD
export type WorkflowDefinition = {
  nodes: { id: string; type: 'agent' | 'condition'; agentId?: string }[];
  edges: { id: string; source: string; target: string; condition?: string }[];
}
```

---

## 9. Impacto arquitetural

- [x] Nova tabela no banco: `CrewWorkflow` e `WorkflowState` (para os checkpoints das conversas).
- [x] Novos pacotes npm: `@langchain/langgraph`, `@langchain/core`, e `@xyflow/react` (react-flow).
- [x] Adaptação no use-case: `OrchestrateInboundMessage` precisará suportar a execução guiada por Workflow em vez de depender apenas do `RouteToAgent`.
