# Authentication

> **Status:** REVIEW
> **Domínio:** auth
> **Autor:** @arnaldo
> **Data:** 2026-05-28

---

## 1. Objetivo

Autenticar usuários humanos na plataforma AI Agent Hub, vinculando cada sessão a um tenant específico com permissões corretas.

---

## 2. Contexto de negócio

Cada empresa cliente (tenant) tem seus próprios usuários: administradores, operadores e aprovadores da KDL. Um usuário pertence a exatamente um tenant. A sessão deve carregar o contexto do tenant para que todas as operações subsequentes sejam automaticamente isoladas.

Usuários da plataforma (super-admins) são um caso separado — não pertencem a nenhum tenant.

---

## 3. Problema que resolve

Sem autenticação vinculada ao tenant, qualquer requisição poderia acessar dados de qualquer empresa. A sessão é a âncora do isolamento multi-tenant em toda a plataforma.

---

## 4. Regras de negócio

1. Um usuário pertence a exatamente um tenant (ou é super-admin da plataforma, sem tenant).
2. A sessão deve conter: `userId`, `tenantId`, `role`, `nicheId`.
3. `tenantId` nunca é aceito de body ou query param — sempre extraído da sessão.
4. Login falho não revela se o e-mail existe (mensagem genérica).
5. Após 5 tentativas falhas consecutivas, a conta é bloqueada por 15 minutos.
6. Access token expira em 1 hora. Refresh token expira em 7 dias.
7. Refresh token é rotativo: ao usar, o anterior é invalidado imediatamente.
8. Logout invalida o refresh token atual no servidor.
9. Um usuário pode ter apenas uma sessão ativa por dispositivo (configurável por tenant).
10. Super-admin não tem `tenantId` na sessão — tem flag `isPlatformAdmin: true`.

---

## 5. Fluxos principais

### Login
```
1. Usuário envia: { email, password }
2. Sistema localiza usuário pelo e-mail
3. Sistema verifica se conta está ativa e não bloqueada
4. Sistema verifica senha (bcrypt compare)
5. Sistema gera access token (JWT, 1h) com { userId, tenantId, role }
6. Sistema gera refresh token (opaque, 7d) e salva hash no banco
7. Retorna: { accessToken, refreshToken, user: { id, name, role } }
```

### Refresh
```
1. Cliente envia refresh token no cookie httpOnly
2. Sistema valida token no banco (não expirado, não revogado)
3. Sistema revoga token atual e gera novo par (rotation)
4. Retorna: { accessToken, refreshToken }
```

### Logout
```
1. Cliente envia request autenticada
2. Sistema revoga refresh token da sessão atual
3. Retorna: 204 No Content
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| E-mail não encontrado | 401 com mensagem genérica: "Credenciais inválidas" |
| Senha incorreta | 401 com mensagem genérica + incrementa contador de falhas |
| 5ª tentativa falha | 401 + conta bloqueada por 15min + contador zerado |
| Conta bloqueada | 403 com mensagem: "Conta temporariamente bloqueada. Tente em X minutos" |
| Conta inativa | 403 com mensagem: "Conta inativa. Contate o administrador" |
| Access token expirado | 401 com código `TOKEN_EXPIRED` — cliente deve fazer refresh |
| Refresh token expirado | 401 com código `SESSION_EXPIRED` — cliente deve fazer login |
| Refresh token já usado (reuse attack) | 401 + revoga toda a família de tokens + alerta de segurança no audit log |
| Tenant inativo | 403 com mensagem: "Tenant inativo" |

---

## 7. Critérios de aceite

- Dado credenciais válidas, quando login, então retorna accessToken + refreshToken + dados do usuário sem senha
- Dado credenciais inválidas, quando login, então retorna 401 sem revelar se o e-mail existe
- Dado 5 falhas consecutivas, quando 6ª tentativa, então retorna 403 com mensagem de bloqueio
- Dado conta bloqueada, quando passa 15 minutos, então login volta a funcionar
- Dado access token expirado, quando refresh com token válido, então retorna novo par e invalida o anterior
- Dado refresh token já utilizado, quando nova tentativa de uso, então revoga toda a família e registra alerta
- Dado logout, quando chamado, então refresh token é invalidado no servidor imediatamente
- Dado sessão válida, quando qualquer operação, então `tenantId` na sessão coincide com dados acessados
- Dado super-admin, quando login, então sessão tem `isPlatformAdmin: true` e sem `tenantId`
- Dado tenant inativo, quando login de usuário desse tenant, então retorna 403

---

## 8. Contratos de entrada e saída

```typescript
// POST /api/v1/auth/login
type LoginInput = {
  email: string      // validado: formato de e-mail
  password: string   // validado: mínimo 8 caracteres
}

type LoginOutput = {
  accessToken: string
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    tenantId: string | null   // null para super-admin
    isPlatformAdmin: boolean
  }
  // refreshToken enviado via cookie httpOnly — nunca no body
}

// POST /api/v1/auth/refresh
// Cookie: refreshToken=xxxxx
type RefreshOutput = {
  accessToken: string
  // novo refreshToken no cookie
}

// POST /api/v1/auth/logout
// Header: Authorization: Bearer <accessToken>
// 204 No Content

// Erros
type AuthError =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'TOKEN_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'TENANT_INACTIVE'
  | 'VALIDATION_ERROR'

// Enum de roles
enum UserRole {
  TENANT_ADMIN    = 'TENANT_ADMIN'     // administrador do tenant
  TENANT_OPERATOR = 'TENANT_OPERATOR'  // operador (configura agentes)
  KDL_APPROVER    = 'KDL_APPROVER'     // aprova insights da distillation
  PLATFORM_ADMIN  = 'PLATFORM_ADMIN'   // super-admin da plataforma
}
```

---

## 9. Impacto arquitetural

- [ ] Nova tabela: `users` — id, tenantId (nullable), email, passwordHash, role, status, failedAttempts, lockedUntil
- [ ] Nova tabela: `refresh_tokens` — id, userId, tokenHash, expiresAt, revokedAt, family (para rotation)
- [ ] Nova entidade: `User`
- [ ] Nova entidade: `RefreshToken`
- [ ] Novo use-case: `AuthenticateUser`
- [ ] Novo use-case: `RefreshSession`
- [ ] Novo use-case: `LogoutUser`
- [ ] Nova API route: `POST /api/v1/auth/login`
- [ ] Nova API route: `POST /api/v1/auth/refresh`
- [ ] Nova API route: `POST /api/v1/auth/logout`
- [ ] Middleware Next.js: extrai e valida JWT, popula `request.session`
- [ ] RLS no PostgreSQL: `users` e `refresh_tokens` filtradas por `tenantId`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Refresh token reuse attack | Baixa | Alto | Token family rotation — revoga família inteira |
| Brute force no login | Média | Alto | Rate limiting por IP + bloqueio por conta |
| JWT secret comprometido | Baixa | Crítico | Secret em variável de ambiente + rotação planejada |
| Sessão de tenant inativo ainda ativa | Baixa | Médio | Middleware valida status do tenant a cada request |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/auth/`):**
- [ ] `deve retornar tokens válidos com credenciais corretas`
- [ ] `deve retornar 401 genérico com credenciais inválidas`
- [ ] `deve incrementar failedAttempts a cada falha`
- [ ] `deve bloquear conta após 5 falhas consecutivas`
- [ ] `deve desbloquear conta após 15 minutos`
- [ ] `deve revogar token anterior ao fazer refresh`
- [ ] `deve revogar família inteira ao detectar reuse de refresh token`
- [ ] `deve invalidar refresh token no logout`
- [ ] `não deve incluir tenantId na sessão de super-admin`
- [ ] `deve retornar 403 se tenant estiver inativo`

**Integração (`tests/integration/`):**
- [ ] `sessão de tenant A não deve acessar dados de tenant B`
- [ ] `middleware deve rejeitar request sem Authorization header`
- [ ] `middleware deve rejeitar access token expirado`
- [ ] `contrato: POST /api/v1/auth/login retorna shape correto`
- [ ] `contrato: refresh token não aparece no body da resposta`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** e-mail, hash de senha (bcrypt, nunca plaintext), timestamps de acesso
- **Finalidade:** autenticação e segurança da conta
- **Retenção:** dados da conta até exclusão pelo usuário ou pelo tenant admin
- **Exclusão:** `DeleteUser` remove registro e revoga todos os tokens ativos
- **Dados sensíveis:** senha nunca armazenada — apenas hash bcrypt (cost factor ≥ 12)
- **Audit log:** todo login, logout, refresh e falha de autenticação registrados com IP e timestamp
- **LGPD:** e-mail é dado pessoal — incluído no export de dados e sujeito ao direito ao esquecimento

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` extraído exclusivamente do JWT da sessão — nunca do cliente
- Middleware valida `tenantId` da sessão contra o recurso acessado em toda request
- Tabela `users` tem RLS: `WHERE tenant_id = current_setting('app.tenant_id')`
- Super-admin não tem `tenantId` — acessa painel separado da plataforma
- Tenant inativo bloqueia login e invalida sessões ativas dos seus usuários
- Testes de isolamento: usuário do tenant A jamais acessa dados do tenant B
