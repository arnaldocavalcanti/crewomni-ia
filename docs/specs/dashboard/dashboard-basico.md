# Dashboard Básico — Gestão de Agentes e Conversas

> **Status:** APPROVED
> **Domínio:** dashboard (UI)
> **Autor:** @arnaldo
> **Data:** 2026-05-31
> **Depende de:** spec agent-builder, spec conversation-audit, spec chat-widget

---

## 1. Objetivo

Prover uma interface web mínima e funcional para que operadores do tenant possam: fazer login, visualizar e gerenciar seus agentes, monitorar conversas e testar o chat diretamente no dashboard.

---

## 2. Contexto de negócio

Sem dashboard, toda interação com a plataforma é via API. O dashboard básico desbloqueio o primeiro fluxo end-to-end testável por usuários reais: login → criar agente → publicar prompt → enviar mensagem → ver resposta.

---

## 3. Escopo do MVP (o que entra)

| Tela | Descrição |
|---|---|
| Login | Formulário email/senha, redireciona para `/dashboard` |
| Dashboard home | Contagem de agentes ativos e conversas recentes |
| Lista de agentes | Tabela com nome, tipo, status, data de criação |
| Detalhe do agente | Info + prompt ativo + botão publicar nova versão |
| Criar agente | Formulário: nome, tipo, description, system prompt |
| Lista de conversas | Tabela com agente, status, nº mensagens, data |
| Detalhe da conversa | Histórico de mensagens formatado |
| Chat de teste | Input de mensagem para testar o agente em tempo real |

**Fora do escopo (Fase 2):** billing, configurações de tenant, Knowledge Ingest UI, KDL.

---

## 4. Regras de negócio

1. Acesso ao dashboard requer JWT válido — redireciona para `/login` se ausente ou expirado.
2. `tenantId` vem do JWT — nunca de parâmetros de URL.
3. `PLATFORM_ADMIN` vê todos os tenants (futuro) — no MVP, vê apenas a visão de tenant.
4. Operações destrutivas (arquivar agente) requerem confirmação.
5. O chat de teste usa `POST /api/v1/conversations/message` — cria uma conversa real.
6. Refresh token silencioso: se access token expirar, tenta refresh antes de redirecionar ao login.

---

## 5. Rotas do Next.js App Router

```
src/app/
├── (auth)/
│   └── login/
│       └── page.tsx          # Formulário de login
├── (dashboard)/
│   ├── layout.tsx             # Sidebar + header + auth guard
│   ├── page.tsx               # Home: métricas rápidas
│   ├── agents/
│   │   ├── page.tsx           # Lista de agentes
│   │   ├── new/page.tsx       # Criar agente
│   │   └── [id]/
│   │       └── page.tsx       # Detalhe + chat de teste
│   └── conversations/
│       ├── page.tsx           # Lista de conversas
│       └── [id]/
│           └── page.tsx       # Histórico de mensagens
└── page.tsx                   # Redireciona para /login ou /dashboard
```

---

## 6. Componentes principais

```
src/components/
├── ui/                        # Primitivos: Button, Input, Badge, Card, Table
├── layout/
│   ├── Sidebar.tsx
│   └── Header.tsx
├── agents/
│   ├── AgentCard.tsx
│   ├── AgentForm.tsx
│   └── AgentStatusBadge.tsx
├── conversations/
│   ├── ConversationRow.tsx
│   └── MessageBubble.tsx
└── chat/
    └── ChatTestPanel.tsx      # Painel de teste do agente
```

---

## 7. Stack de UI

| Decisão | Escolha | Motivo |
|---|---|---|
| Componentes | shadcn/ui (instalado via CLI) | Acessibilidade, Tailwind 4 nativo, sem lock-in |
| Ícones | lucide-react | Leve, consistente com shadcn |
| Estado global | Não necessário (MVP) | React state + fetch nativo suficiente |
| Fetch | `fetch` nativo com helpers | Sem dependências extras no MVP |
| Fontes | Geist (já configurado) | Padrão do projeto |

---

## 8. Contratos de entrada e saída (cliente → API)

Todas as chamadas do dashboard usam as APIs já implementadas:

```
POST /api/v1/auth/login          → { accessToken, user }
POST /api/v1/auth/refresh        → { accessToken }
POST /api/v1/agents              → Agent
GET  /api/v1/agents              → Agent[]
GET  /api/v1/agents/:id          → AgentWithPrompt
PATCH /api/v1/agents/:id/prompt  → AgentPromptVersion
PATCH /api/v1/agents/:id/status  → void
GET  /api/v1/conversations       → ListConversationsOutput
GET  /api/v1/conversations/:id/messages → GetConversationMessagesOutput
POST /api/v1/conversations/message → SendMessageOutput
```

---

## 9. Impacto arquitetural

- [ ] Instalar shadcn/ui e lucide-react
- [ ] Criar estrutura de pastas `src/app/(auth)/` e `src/app/(dashboard)/`
- [ ] Criar `src/components/ui/` com primitivos do shadcn
- [ ] Criar `src/lib/api.ts` — helpers de fetch com refresh token automático
- [ ] Criar `src/lib/auth.ts` — helpers de sessão client-side (ler accessToken do localStorage)
- [ ] Atualizar `src/app/layout.tsx` — metadata e lang="pt-BR"
- [ ] Atualizar `src/app/page.tsx` — redirect para /login ou /dashboard

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| shadcn/ui incompatível com Next.js 16 / Tailwind 4 | Média | Alto | Testar instalação isolada antes; usar versão canary se necessário |
| accessToken em localStorage (XSS) | Média | Alto | Migrar para httpOnly cookie em Fase 2; no MVP o risco é aceitável para velocidade |
| Chat de teste gerando conversas "lixo" no banco | Baixa | Baixo | Tag `externalUserId: 'dashboard-test'` para filtrar depois |

---

## 11. Testes esperados

O dashboard é UI — testes e2e ficam para Fase 2 (Playwright). No MVP:

- [ ] Verificar que rotas protegidas redirecionam para /login sem token
- [ ] Verificar que `src/lib/api.ts` tenta refresh antes de retornar 401
- [ ] Snapshot/render tests dos componentes críticos (AgentForm, ChatTestPanel) — opcionais no MVP

---

## 12. Critérios LGPD e privacidade

- Não exibir `systemPrompt` em listagens — apenas no detalhe do agente (acesso restrito ao operador)
- Não cachear dados sensíveis no localStorage além do accessToken
- Logout limpa localStorage e revoga refreshToken via API

---

## 13. Critérios de isolamento multi-tenant

- Todas as chamadas de API incluem `Authorization: Bearer <accessToken>` — tenantId extraído server-side
- Nenhum tenantId hardcoded no frontend
- Rotas do dashboard não aceitam tenantId via URL param
