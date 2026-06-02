# Department

> **Status:** APPROVED
> **Domínio:** organization
> **Autor:** @crewomni
> **Data:** 2026-06-01

---

## 1. Objetivo

Permitir que cada tenant organize seus agentes e crews em departamentos (áreas de negócio), criando a camada hierárquica Tenant → Department → Crew.

---

## 2. Contexto de negócio

O CrewOmni permite que empresas criem crews (equipes de agentes). Para organizar múltiplas crews por área de negócio (Comercial, Suporte, Financeiro etc.), cada tenant precisa criar Departments que agrupam crews e facilitam governança, métricas e permissões.

---

## 3. Problema que resolve

Sem Department, todas as crews de um tenant ficam numa lista plana sem contexto organizacional. Com Department, o tenant pode visualizar "Crew Comercial" dentro de "Departamento Comercial", aplicar filtros, e futuramente atribuir permissões por área.

---

## 4. Regras de negócio

1. Um Department pertence a exatamente um Tenant.
2. O name deve ser único dentro do tenant.
3. O slug é gerado automaticamente a partir do name (lowercase, hífens).
4. O slug deve ser único dentro do tenant.
5. O status padrão é ACTIVE.
6. Um Department com status INACTIVE não pode receber novas Crews (Fase 1.2).
7. Deletar um Department com Crews associadas é proibido (Fase 1.2 — guard adicionado quando Crew existir).
8. tenantId vem exclusivamente da sessão JWT — nunca do body da requisição.
9. Busca de Department de outro tenant retorna 404 (nunca 403).

---

## 5. Fluxos principais

### Criar Department
1. Tenant Admin ou Operator autentica via JWT.
2. Envia POST /api/v1/departments com { name, description? }.
3. Sistema gera slug a partir do name.
4. Sistema valida unicidade de name e slug no tenant.
5. Persiste e retorna Department criado (201).

### Listar Departments
1. GET /api/v1/departments.
2. Retorna todos os departments do tenant, ordenados por name ASC.

### Obter Department
1. GET /api/v1/departments/:id.
2. Retorna o department se existir e pertencer ao tenant. Caso contrário, 404.

### Atualizar Department
1. PATCH /api/v1/departments/:id com { name?, description?, status? }.
2. Se name for alterado, regenera slug.
3. Valida unicidade do novo name no tenant.
4. Persiste e retorna Department atualizado.

### Deletar Department
1. DELETE /api/v1/departments/:id.
2. Fase 1.1: hard-delete sem crews.
3. Fase 1.2: bloquear se houver crews associadas.

---

## 6. Fluxos alternativos

- name duplicado no mesmo tenant → 409 DEPARTMENT_NAME_TAKEN.
- id de outro tenant → 404 DEPARTMENT_NOT_FOUND.
- id inexistente → 404 DEPARTMENT_NOT_FOUND.

---

## 7. Critérios de aceite

- [ ] POST /api/v1/departments cria e retorna Department com status 201.
- [ ] GET /api/v1/departments retorna apenas departments do tenant autenticado.
- [ ] GET /api/v1/departments/:id retorna 404 para id de outro tenant.
- [ ] PATCH /api/v1/departments/:id atualiza name e regenera slug.
- [ ] DELETE /api/v1/departments/:id remove o department.
- [ ] Tenant A não consegue ver nem editar departments do Tenant B.

---

## 8. Contratos de entrada e saída

### POST /api/v1/departments

```json
{ "name": "Comercial", "description": "Área comercial da empresa" }
```

Resposta 201:
```json
{ "id": "uuid", "tenantId": "uuid", "name": "Comercial", "slug": "comercial",
  "description": "...", "status": "ACTIVE", "createdAt": "ISO", "updatedAt": "ISO" }
```

### PATCH /api/v1/departments/:id

```json
{ "name": "Comercial B2B", "description": "...", "status": "INACTIVE" }
```

Resposta 200: Department atualizado.

---

## 9. Impacto arquitetural

- Novo domínio: src/domains/organization/
- Nova tabela: departments (FK → tenants, cascade delete)
- prisma/schema.prisma: +enum DepartmentStatus +model Department +Tenant.departments[]
- src/infrastructure/di/index.ts: +departmentRepo +5 use-cases
- src/shared/utils/apiResponse.ts: +DEPARTMENT_NOT_FOUND +DEPARTMENT_NAME_TAKEN
- Fase 1.2: model Crew terá FK departmentId → departments

---

## 10. Riscos

- Conflito de slug ao renomear: mitigado com sufixo numérico automático.
- Delete com crews na Fase 1.2: guard a ser adicionado no use-case DeleteDepartment.

---

## 11. Testes esperados

Ver tests/unit/domains/organization/*.test.ts.
Cobertura: CreateDepartment, ListDepartments, GetDepartment, UpdateDepartment, DeleteDepartment.
Isolamento multi-tenant testado em todos os use-cases.

---

## 12. Critérios LGPD

Department não contém dados pessoais. AuditLog registra criação/atualização/deleção com tenantId e userId. Cascade delete remove departments ao deletar tenant.

---

## 13. Critérios de isolamento multi-tenant

- tenantId vem da sessão JWT.
- Todos os métodos de repositório filtram por (id, tenantId).
- Resposta para recurso de outro tenant: 404, nunca 403.
- RLS no PostgreSQL habilitado na Fase 2.
