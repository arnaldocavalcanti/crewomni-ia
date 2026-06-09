# Advanced Crew Dashboard UI/UX Revamp

Esta é a análise de UI/UX e o plano de desenvolvimento para integrar o design avançado das telas de Crew (conforme mockups fornecidos) no ciclo de desenvolvimento do projeto CrewOmni.

## Brainstorming & UI/UX Analysis (Visão do Especialista)

Ao analisar os mockups, identificamos uma evolução significativa da plataforma em relação ao que temos hoje. A nova interface consolida recursos complexos em um layout "Split View" altamente funcional.

### Principais Componentes Identificados:
1. **Split-View Architecture:**
   - **Listagem (Crews Ativas):** Lista rica à esquerda com gráficos sparkline de performance e um painel de detalhes (Preview) à direita.
   - **Criação (Cadastrar Crew):** Formulário em blocos lógicos à esquerda (Wizard de 6 passos visual) e um Preview interativo à direita que se atualiza em tempo real.
2. **Workflows Visuais (LangGraph):**
   - Visualização da ordem de atuação dos agentes (ex: `Lead Hunter -> Qualifier -> SDR -> Negotiator`). Isso materializa o "Workflow e Handoff".
3. **Gestão de Canais (Multicanalidade):**
   - Vinculação de Crews a canais específicos (WhatsApp, Webchat, E-mail, API).
4. **Governança e Metas:**
   - Permissões granulares (Handoff automático, Escalação Humana).
   - Definição de KPIs/Metas (SLA, Taxa de Conversão).
5. **Métricas Avançadas:**
   - Dashboard de KPIs no topo da listagem (Execuções, Taxa de Resolução).

---

## Estratégia de Inserção no Ciclo de Desenvolvimento

A implementação ideal não deve ser feita de uma vez. Ela se encaixa perfeitamente na **Fase 3**, dividida nas seguintes sub-fases:

### Fase 3.1: Nova Estrutura de Dados & UI Base (Foundation)
- **Backend:** Atualizar o Prisma Schema para adicionar suporte a `Channels` (WhatsApp, E-mail), `CrewGoals` (SLAs, Metas) e `CrewSettings` (Permissões de Handoff e Escalação).
- **Frontend:** Refatorar `src/app/(dashboard)/dashboard/crews/page.tsx` para o layout **Split-View** (Listagem à esquerda, Preview vazio ou com dados básicos à direita).
- **Frontend:** Atualizar `src/app/(dashboard)/dashboard/crews/new/page.tsx` para o layout de 2 colunas, implementando os steps 1, 2 e 5.

### Fase 3.2: Integração Multicanal (Omnichannel)
- **Backend:** Conectar APIs reais do WhatsApp e Provedores de E-mail.
- **Frontend:** Ativar os seletores de Canais (Step 2 do mockup) e as tags de canais ativos no card da Crew.

### Fase 3.3: Visual Workflows (LangGraph Engine)
- **Backend:** Implementar o motor do LangGraph para substituir o roteamento LLM simples por fluxos determinísticos/híbridos.
- **Frontend:** Desenvolver o componente `VisualWorkflowBuilder` (react-flow) exibido no Step 4 (Workflow Inicial).
- **Frontend:** Habilitar a tabela interativa "Agentes da Crew" (Step 3) com drag-and-drop para reordenar a cadeia de handoff.

### Fase 3.4: Analytics & Sparklines (Métricas em Tempo Real)
- **Backend:** Expandir a Fase 1.6 (Métricas) para agregar dados de Taxa de Resolução, Execuções (Tarefas) e SLA.
- **Frontend:** Inserir os gráficos (Sparklines) na lista de Crews e atualizar o topo da tela de listagem com os Big Numbers.

---

## Proposed Changes (Arquitetura Futura - Preview)

Para suportar essa interface na Fase 3, os seguintes componentes/entidades precisarão ser tocados:

### Prisma Schema Updates (Planejamento)
#### [MODIFY] prisma/schema.prisma
Adição de campos e tabelas:
- Tabela `CrewChannel` (Vincula Crew a provedores de WhatsApp, Email).
- Campos no modelo `Crew`: `type` (Comercial, Suporte, etc), `slaMinutes`, `leadGoal`, `conversionGoal`.
- Tabela `CrewWorkflow` (Grava a configuração do LangGraph e nós).

### Frontend Components (Shadcn + Tailwind)
#### [NEW] src/components/crews/CrewListSplitView.tsx
Gerenciador de estado entre a tabela esquerda e o painel direito.
#### [NEW] src/components/crews/VisualWorkflow.tsx
Componente usando `react-flow-renderer` para desenhar os nós (`Lead Hunter -> Qualifier`).

---

## Verification Plan

- Validação da viabilidade técnica de usar `react-flow` para desenhar o "Workflow Inicial" exatamente como no mockup.
- Avaliação de complexidade na migração dos dados atuais das Crews para o novo modelo com "Metas" e "Canais".
