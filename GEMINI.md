# Instruções para o Gemini CLI — crewomni-ia

> Este arquivo é o equivalente do CLAUDE.md para o Gemini CLI.
> O Gemini carrega automaticamente GEMINI.md ao iniciar uma sessão no diretório do projeto.

---

## LEITURA OBRIGATÓRIA ANTES DE QUALQUER AÇÃO

Leia obrigatoriamente na ordem:
1. `CONTEXT.md` — visão completa: stack, arquitetura, o que está implementado, padrões
2. `.agent/rules/global.md` — regras invioláveis
3. `.agent/rules/architecture.md` — estrutura de pastas e dependências
4. `.agent/rules/sdd.md` — fluxo SDD obrigatório antes de implementar
5. `.agent/rules/tdd.md` — testes antes do código

---

## CHECKLIST OBRIGATÓRIO DE INICIALIZAÇÃO

Antes de executar qualquer tarefa:

1. Leia `/docs/product/product-charter.md`
2. Leia `CONTEXT.md`
3. Leia os ADRs relevantes em `docs/adr/`
4. Leia a Spec relevante em `docs/specs/`
5. Execute planejamento (brainstorming + plano antes de implementar)
6. Somente então inicie a implementação

Se qualquer etapa estiver faltando: **PARE e solicite esclarecimento.**

---

## REGRA OBRIGATÓRIA DE UI

Antes de criar QUALQUER arquivo de UI (página, componente, layout — qualquer `.tsx` que renderize conteúdo visual):

1. Defina layout, espaçamento, tipografia e hierarquia visual com o usuário antes de implementar.
2. Siga o design system **Gradient Shell** (documentado abaixo e em `src/app/globals.css`).
3. Somente implemente após o design estar definido e aprovado.

Esta regra se aplica a TODO trabalho de UI, sem exceções.
NÃO se aplica a: rotas de API, use-cases, testes, infraestrutura ou arquivos não-visuais.

---

## DESIGN SYSTEM — GRADIENT SHELL

O projeto usa o design system **Gradient Shell**, derivado do logo crewomni.ia.

### Tokens principais (definidos em `src/app/globals.css`)
```css
--gradient-primary: linear-gradient(135deg, #06C8E8 0%, #4F6EF7 50%, #7C3AED 100%)
--color-cyan:   #06C8E8
--color-blue:   #4F6EF7
--color-purple: #7C3AED
--background:   oklch(0.974 0.008 265)   /* #F5F7FF — fundo claro padrão */
--foreground:   oklch(0.09 0.03 275)     /* #0F0E2A — navy */
```

### Regras visuais
- **Modo claro por padrão** — dark mode opcional via `ThemeToggle` (localStorage `theme`)
- **Fonte:** Inter (sans-serif) — `--font-sans`
- **Sidebar:** branca 240px, border-right, drawer no mobile
- **Botões primários:** variante `gradient` — `<Button variant="gradient">`
- **Empty states:** use sempre `<EmptyState>` de `src/components/ui/empty-state.tsx`
- **Ícones:** lucide-react
- **Bordas:** `--border: oklch(0.91 0.012 265)` — `#E8ECF4`
- **Cards:** `bg-card border border-border rounded-xl shadow-sm`

### Componentes-chave
| Componente | Arquivo |
|---|---|
| `Button` (variante `gradient`) | `src/components/ui/button.tsx` |
| `EmptyState` | `src/components/ui/empty-state.tsx` |
| `ThemeToggle` | `src/components/ui/theme-toggle.tsx` |
| `OnboardingWizard` | `src/components/onboarding/OnboardingWizard.tsx` |
| `StatusBadge` | `src/components/ui/status-badge.tsx` |

---

## DIFERENÇAS GEMINI CLI vs CLAUDE CODE

O Gemini CLI usa ferramentas com nomes diferentes. Mapeamento:

| Claude Code | Gemini CLI |
|---|---|
| `Read` | `read_file` |
| `Edit` | `replace_in_file` ou `write_file` |
| `Write` | `write_file` |
| `Bash` | `run_shell_command` |
| `Glob` | `glob` |
| `Grep` | `grep` / `search_file_content` |
| `TodoWrite` | use `write_file` para criar um arquivo de tasks |
| `WebSearch` | `google_search` |
| `WebFetch` | `fetch_url` (se disponível) |

Skills (superpowers): use `activate_skill` com o nome do skill.

---

## PADRÕES DE DESENVOLVIMENTO

### SDD — Specification-Driven Development
**Toda funcionalidade começa com uma spec** em `/docs/specs/<domínio>/<feature>.md`
- Template: `docs/specs/_template.md` (13 seções)
- Status: `DRAFT → REVIEW → APPROVED → IMPLEMENTED`
- **Nunca implemente sem spec APPROVED**

### TDD — Test-Driven Development
Ordem obrigatória:
```
spec APPROVED → testes (RED) → use-cases (GREEN) → infra + rotas
```

Comandos de teste:
```bash
npm run test              # todos os testes
npm run test:unit         # apenas unitários
npm run test:integration  # apenas integração
```

### Arquitetura (Clean Architecture pragmática)
```
app/        → apenas rotas e UI
domains/    → regras de negócio (sem dependência de framework)
infrastructure/ → implementações concretas (Prisma, OpenAI, etc.)
shared/     → tipos, erros, utilitários
```

**Regra de dependência:** `domains/` NUNCA importa `infrastructure/` nem `app/`.

### Isolamento multi-tenant (inviolável)
- `tenantId` sempre extraído da sessão JWT — nunca de body/query
- Busca por ID de outro tenant retorna **404** (nunca 403)
- Testes de isolamento são obrigatórios em todo domínio

---

## ESTADO ATUAL DO PROJETO (2026-06-04)

**231 testes passando (32 arquivos)**

### Implementado
- Auth, Tenant, Agent Builder, Conversation, RAG Orchestrator
- Knowledge Ingest, Chat Widget Público
- Organization/Department, Crew Builder (Fase 1.2)
- **UI Redesign Gradient Shell (Fase 1.3)** — design system completo

### Próximas fases
- **Fase 1.4** — Crew Chat (routing para director/agente principal)
- **Fase 1.5** — Workflow e Handoff entre agentes
- **Fase 2** — KDL, Industry KB, Master Agents, Billing

---

## ERROS COMUNS A EVITAR

1. **NÃO** usar `tailwind.config.ts` — este projeto usa Tailwind v4 com CSS custom properties em `globals.css`
2. **NÃO** hardcodar cores — usar tokens CSS (`var(--color-blue)`, `--gradient-primary`, etc.)
3. **NÃO** usar a classe `dark` no HTML — o ThemeToggle gerencia isso via JS/localStorage
4. **NÃO** importar `Geist` — a fonte é `Inter` via `next/font/google`
5. **NÃO** criar UI sem verificar o design system Gradient Shell primeiro
6. **NÃO** acessar `tenantId` de `req.body` ou query params — sempre do JWT
7. **NÃO** usar `url = env("DATABASE_URL")` no `schema.prisma` — Prisma 7 usa `prisma.config.ts`
8. **NÃO** retornar `systemPrompt` em rotas de listagem — apenas em `GET /agents/:id`

---

## COMANDOS ÚTEIS

```bash
npm run dev          # inicia servidor de desenvolvimento
npm run build        # build de produção
npm test             # roda todos os testes
npx tsc --noEmit     # verifica TypeScript sem compilar
npx prisma generate  # regenera client após mudar schema
npx prisma migrate dev --name X  # cria migration (requer DB rodando)
docker compose up -d # sobe PostgreSQL + pgvector na porta 5434
```
