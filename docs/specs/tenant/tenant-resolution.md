# Tenant Resolution

> **Status:** REVIEW
> **Domínio:** tenant
> **Autor:** @arnaldo
> **Data:** 2026-05-28

---

## 1. Objetivo

Identificar com precisão qual tenant está sendo servido em cada requisição, seja ela originada de um usuário logado no dashboard, de um widget embarcado em site externo, de uma chamada REST API ou de um conector de canal (WhatsApp, e-mail).

---

## 2. Contexto de negócio

A plataforma serve múltiplos tenants simultaneamente. Cada tenant tem seu próprio conjunto de agentes, base de conhecimento e configurações. A resolução correta do tenant é o ponto de partida de todo isolamento de dados, roteamento de agentes e aplicação de permissões.

Tenants iniciais: Devolus, Fast4Sign, Imobiliárias clientes.

---

## 3. Problema que resolve

Sem resolução explícita e segura do tenant, qualquer requisição pode — por erro ou ataque — acessar dados de outro tenant. A resolução deve ser determinística, auditável e impossível de ser forjada pelo cliente.

---

## 4. Regras de negócio

1. Todo request que acessa dados de tenant deve ter o `tenantId` resolvido antes de qualquer operação.
2. O `tenantId` nunca é aceito de body ou query param em rotas privadas — sempre resolvido server-side.
3. Cada tenant tem um `slug` único (ex: `devolus`, `fast4sign`) imutável após criação.
4. A resolução ocorre por três estratégias, em ordem de prioridade:
   - **Sessão JWT** (dashboard, SDK React) — `tenantId` no payload do token
   - **API Key** (REST API externa) — chave vinculada ao tenant no banco
   - **Slug público** (widget web, rota pública) — validado server-side
5. Tenant inexistente → 404. Tenant inativo → 403.
6. Toda resolução de tenant é registrada no audit log com a estratégia usada.
7. Um tenant pode ter múltiplos domínios autorizados para o widget (allowedDomains).
8. Tenant só pode ser criado por um super-admin da plataforma.
9. Tenant com status `SUSPENDED` não permite operações de nenhum canal.
10. O `slug` deve ser único globalmente, alfanumérico com hífens, entre 3 e 32 caracteres.

---

## 5. Fluxos principais

### Via Sessão JWT (dashboard / SDK React)
```
1. Request chega com Authorization: Bearer <JWT>
2. Middleware extrai e valida JWT
3. Extrai tenantId do payload do token
4. Carrega Tenant do banco (com cache Redis de 5min)
5. Valida status do tenant (ACTIVE)
6. Popula request.context = { tenantId, tenant, userId, role }
7. Request segue para a rota
```

### Via API Key (REST API externa)
```
1. Request chega com Authorization: Bearer ahub_live_xxxxx
2. Middleware detecta prefixo "ahub_" — não é JWT
3. Extrai keyPrefix dos primeiros caracteres
4. Busca ApiKey no banco pelo prefix (campo indexado)
5. Verifica hash: bcrypt.compare(keyRecebida, keyHash)
6. Extrai tenantId da ApiKey
7. Carrega e valida Tenant
8. Popula request.context = { tenantId, tenant, apiKeyId }
```

### Via Slug público (Widget Web)
```
1. Request pública: GET /api/v1/widget/config?tenant=devolus&agent=sdr
2. Middleware busca Tenant pelo slug
3. Valida se o domínio da request está em allowedDomains do tenant
4. Valida status do tenant
5. Retorna configuração pública (sem dados sensíveis)
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| JWT sem tenantId (super-admin) | Permite acesso ao painel da plataforma; bloqueia rotas de tenant |
| Slug não encontrado | 404 |
| Tenant com status INACTIVE | 403: "Tenant inativo" |
| Tenant com status SUSPENDED | 403: "Tenant suspenso. Contate o suporte" |
| API Key inválida ou revogada | 401: "API key inválida" (sem detalhar se existe) |
| API Key expirada | 401: "API key expirada" |
| Domínio não autorizado no widget | 403: silencioso — widget não carrega |
| Tenant sem plano ativo (billing) | 402: "Plano inativo. Acesse o painel para regularizar" |

---

## 7. Critérios de aceite

- Dado JWT válido com tenantId, quando request autenticada, então tenant correto é resolvido
- Dado API key válida, quando request externa, então tenant vinculado à key é resolvido
- Dado slug válido e domínio autorizado, quando requisição do widget, então configuração pública é retornada
- Dado slug inválido, quando requisição do widget, então retorna 404
- Dado tenant SUSPENDED, quando qualquer canal, então retorna 403
- Dado domínio não autorizado, quando widget tenta carregar, então request é bloqueada silenciosamente
- Dado tenant resolvido, quando qualquer operação de dados, então todas as queries filtram pelo tenantId resolvido
- Dado API key revogada, quando request externa, então retorna 401 sem revelar se a key já existiu
- Dado super-admin sem tenantId, quando acessa rota de tenant, então retorna 403
- Dado resolução bem-sucedida, quando qualquer estratégia, então evento registrado no audit log

---

## 8. Contratos de entrada e saída

```typescript
// Contexto resolvido — disponível em toda request após middleware
type TenantContext = {
  tenantId: string
  tenant: {
    id: string
    slug: string
    name: string
    niche: Niche
    status: TenantStatus
    plan: PlanType
  }
  resolutionStrategy: 'JWT' | 'API_KEY' | 'PUBLIC_SLUG'
  // presente apenas na estratégia JWT:
  userId?: string
  role?: UserRole
  // presente apenas na estratégia API_KEY:
  apiKeyId?: string
}

enum TenantStatus {
  ACTIVE    = 'ACTIVE'
  INACTIVE  = 'INACTIVE'
  SUSPENDED = 'SUSPENDED'
}

enum Niche {
  REAL_ESTATE = 'REAL_ESTATE'
  ESIGN       = 'ESIGN'
  LEGAL       = 'LEGAL'
  HR          = 'HR'
  SUPPORT     = 'SUPPORT'
}

// POST /api/v1/tenants  (apenas super-admin)
type CreateTenantInput = {
  name: string         // 3–100 caracteres
  slug: string         // 3–32 caracteres, alfanumérico + hífens, único
  niche: Niche
  ownerEmail: string   // e-mail do primeiro admin do tenant
  ownerName: string
}

type CreateTenantOutput = {
  tenant: {
    id: string
    name: string
    slug: string
    niche: Niche
    status: TenantStatus
    createdAt: string
  }
  owner: {
    id: string
    email: string
    temporaryPassword: string  // exibido uma única vez — usuário deve trocar
  }
}

type TenantError =
  | 'TENANT_NOT_FOUND'
  | 'TENANT_INACTIVE'
  | 'TENANT_SUSPENDED'
  | 'TENANT_PLAN_INACTIVE'
  | 'SLUG_ALREADY_TAKEN'
  | 'DOMAIN_NOT_AUTHORIZED'
  | 'INVALID_API_KEY'
  | 'FORBIDDEN'
```

---

## 9. Impacto arquitetural

- [ ] Nova tabela: `tenants` — id, slug, name, niche, status, plan, allowedDomains[], createdAt
- [ ] Nova tabela: `tenant_settings` — tenantId, dpoName, dpoEmail, privacyPolicyUrl, dataRetentionDays
- [ ] Nova entidade: `Tenant`
- [ ] Nova entidade: `TenantSettings`
- [ ] Novo use-case: `CreateTenant` (super-admin)
- [ ] Novo use-case: `ResolveTenantContext` (chamado pelo middleware)
- [ ] Novo use-case: `SuspendTenant` / `ActivateTenant`
- [ ] Middleware Next.js: `withTenantContext` — executado antes de toda rota privada e pública
- [ ] Cache Redis: `platform:tenant:{slug}` com TTL de 5 minutos
- [ ] RLS PostgreSQL: todas as tabelas com `tenantId` habilitam RLS
- [ ] Nova API route: `POST /api/v1/tenants` (super-admin only)
- [ ] Nova API route: `GET /api/v1/tenants/:slug` (super-admin only)
- [ ] Nova API route: `PATCH /api/v1/tenants/:id/status` (super-admin only)

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cache desatualizado após suspend do tenant | Média | Alto | Invalidação ativa do cache Redis ao suspender |
| Slug collision em criação concorrente | Baixa | Médio | Unique constraint no banco + tentativa com retry |
| Widget carregado em domínio não autorizado | Média | Alto | Verificação server-side de allowedDomains (não client-side) |
| API Key exposta em logs | Média | Crítico | Nunca logar a key completa — apenas o prefix |
| Tenant resolvido de forma errada por bug de cache | Baixa | Crítico | Testes de isolamento obrigatórios + TTL curto (5min) |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/tenant/`):**
- [ ] `deve resolver tenant corretamente a partir de JWT`
- [ ] `deve resolver tenant corretamente a partir de API key`
- [ ] `deve resolver tenant corretamente a partir de slug público`
- [ ] `deve retornar 404 para slug inexistente`
- [ ] `deve retornar 403 para tenant SUSPENDED em qualquer estratégia`
- [ ] `deve retornar 403 para tenant INACTIVE`
- [ ] `deve bloquear widget de domínio não autorizado`
- [ ] `deve rejeitar API key revogada`
- [ ] `deve rejeitar super-admin em rota de tenant`
- [ ] `deve invalidar cache ao suspender tenant`
- [ ] `deve rejeitar slug com formato inválido na criação`
- [ ] `deve rejeitar slug duplicado na criação`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve ser resolvido usando credenciais de tenant B`
- [ ] `API key de tenant A não deve dar acesso a dados de tenant B`
- [ ] `widget com tenantId de A não deve retornar dados de B`
- [ ] `contrato: POST /api/v1/tenants retorna shape correto`
- [ ] `contrato: temporary password exibido apenas na criação`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** nome da empresa, slug, niche, e-mail do owner, allowedDomains
- **Finalidade:** identificação e roteamento do tenant na plataforma
- **Retenção:** dados do tenant até exclusão formal solicitada pelo próprio tenant
- **Exclusão:** `DeleteTenant` remove tenant + todos os dados vinculados (cascata) + vetores + cache
- **Dados sensíveis:** e-mail do owner é dado pessoal — sujeito ao direito ao esquecimento
- **KDL:** dados de configuração do tenant não entram na KDL
- **Audit log:** toda criação, suspensão, ativação e exclusão de tenant registrada com super-admin responsável

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` resolvido exclusivamente server-side — nunca aceito do cliente em rotas privadas
- Middleware `withTenantContext` aplicado antes de qualquer handler de rota
- Cache Redis prefixado: `platform:tenant:{slug}` — nunca compartilhado entre tenants
- RLS habilitado em todas as tabelas com `tenantId` desde a primeira migration
- Suspensão invalida cache imediatamente — não aguarda TTL expirar
- Testes de isolamento: nenhuma estratégia de resolução retorna dados de outro tenant
