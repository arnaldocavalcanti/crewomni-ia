# ADR 002 — Estratégia de Resolução de Tenant

> **Status:** ACCEPTED
> **Data:** 2026-05-29
> **Contexto:** Fase 1 — definir como o sistema identifica o tenant em cada ponto de entrada

---

## Contexto

A plataforma serve múltiplos tenants simultaneamente. Cada request precisa identificar qual tenant está sendo servido antes de qualquer operação. Há três estratégias comuns: subdomínio, slug no path e resolução via credencial.

---

## Opções avaliadas

### Opção A — Subdomínio por tenant
`devolus.agenthub.com`, `fast4sign.agenthub.com`

**Prós:** UX limpa, isolamento visual claro, padrão de mercado (Vercel, Heroku)
**Contras:** Requer wildcard DNS, certificado TLS wildcard, complexidade de infra no MVP, impossibilita deploy simples no Vercel free tier

### Opção B — Slug no path
`agenthub.com/t/devolus/dashboard`

**Prós:** Zero infra extra, funciona em qualquer CDN, simples para MVP
**Contras:** URL menos limpa, slug exposto e imutável

### Opção C — Resolução via credencial apenas (sem URL)
Tenant extraído 100% do JWT, API key ou slug público no data attribute

**Prós:** Máxima flexibilidade de URL, seguro por design
**Contras:** Sem contexto visual de tenant na URL do dashboard

---

## Decisão

**Híbrido: resolução via credencial + slug no data attribute para widget**

| Canal | Estratégia | Onde o tenant é resolvido |
|---|---|---|
| Dashboard (área logada) | JWT na sessão | Middleware extrai `tenantId` do token — URL é `/dashboard` sem slug |
| REST API externa | API key no `Authorization` header | `keyPrefix` → `tenantId` |
| Web Widget | `data-tenant-id` no script tag | Verificado server-side em `allowedDomains` |
| Widget de chat público | Slug na query param | `GET /api/v1/widget/config?tenant=devolus` |
| WhatsApp (futuro) | Número de telefone mapeado ao tenant | Lookup no banco pelo número |

**Subdomínio fica reservado para Fase 3** (white-label para tenants enterprise) quando a infra de wildcard DNS estiver justificada pelo volume.

---

## Consequências

- Dashboard não tem o slug do tenant na URL — simplifica roteamento Next.js
- `tenantId` nunca é aceito de parâmetros de URL em rotas privadas
- Widget usa `data-tenant-id` que é verificado server-side — não é segurança por obscuridade
- Slug é imutável após criação (usado em URLs públicas do widget)
- Quando subdomínio for implementado: resolver via `request.headers.get('host')` no middleware

---

## Impacto nas rotas Next.js

```
src/app/
├── (auth)/          # login, register — sem tenant no contexto
├── (dashboard)/     # área logada — tenantId vem do JWT
│   └── layout.tsx   # middleware já resolveu e injetou tenantId
├── (public)/
│   └── chat/[agentSlug]/  # widget público — resolve por slug
└── api/v1/          # tenant por JWT ou API key
```

---

## Próximas decisões relacionadas

- ADR 003 — Estratégia de embedding e chunking para RAG
- ADR 004 — Estrutura do prompt hierárquico (5 layers)
- ADR 005 — Pipeline da Knowledge Distillation Layer
