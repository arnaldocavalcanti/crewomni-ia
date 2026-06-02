# TDD — Test-Driven Development

## Regra fundamental

> Nenhum use-case é implementado sem testes escritos antes, baseados nos critérios de aceite da spec.

## Stack de testes

- **Vitest** — runner principal (unit + integration)
- **Testing Library** — testes de componentes React
- **Playwright** — testes E2E

## Estrutura de testes

```
tests/
├── unit/
│   └── domains/
│       ├── tenant/
│       ├── agent/
│       ├── knowledge/
│       ├── conversation/
│       └── distillation/
├── integration/
│   ├── tenant-isolation.test.ts
│   ├── knowledge-layer-isolation.test.ts
│   └── api-contracts.test.ts
└── e2e/
    ├── chat-flow.test.ts
    └── distillation-approval.test.ts
```

## Fluxo TDD

```
1. Ler a spec aprovada
2. Listar os critérios de aceite da seção 7
3. Escrever um teste para cada critério (RED)
4. Implementar o mínimo para passar (GREEN)
5. Refatorar sem quebrar testes (REFACTOR)
```

## Convenções de teste

```typescript
// Nome do arquivo: <UseCase>.test.ts
// Localização: tests/unit/domains/<domínio>/

describe('CreateAgent', () => {
  // Critério de aceite da spec, copiado literalmente
  it('deve rejeitar criação de agente sem tenantId', async () => { ... })
  it('deve rejeitar nome de agente duplicado no mesmo tenant', async () => { ... })
  it('deve criar agente com status DRAFT por padrão', async () => { ... })
})
```

## Cobertura obrigatória por domínio

Todo use-case deve ter testes cobrindo:

| Categoria | Exemplos |
|---|---|
| **Regras de negócio** | Validações, invariantes, cálculos |
| **Permissões** | Usuário sem permissão recebe 403 |
| **Isolamento por tenant** | Tenant A não acessa dados de B |
| **Isolamento por nicho** | Industry KB do nicho A não vaza para B |
| **Segurança de dados** | Dados sensíveis não aparecem em respostas |
| **Casos de erro** | Input inválido, recurso não encontrado |
| **Contratos de API** | Request/response seguem o contrato da spec |
| **Anonimização** | Dados pessoais removidos antes de sair do tenant |
| **Aprovação de aprendizado** | Candidato só vai para Industry KB após aprovação |

## Testes de isolamento de tenant (obrigatórios em todo domínio)

```typescript
describe('tenant isolation', () => {
  it('não deve retornar dados de outro tenant', async () => {
    const tenantA = await createTenant()
    const tenantB = await createTenant()
    const agent = await createAgent({ tenantId: tenantA.id })

    const result = await getAgent({ id: agent.id, tenantId: tenantB.id })

    expect(result).toBeNull()
  })
})
```

## O que não testar

- Implementações de infraestrutura (Prisma, Redis) — use mocks
- Framework (Next.js roteamento, React rendering básico)
- Código de terceiros

## Comandos

```bash
npm run test              # todos os testes
npm run test:unit         # apenas unitários
npm run test:integration  # apenas integração
npm run test:e2e          # apenas E2E
npm run test:coverage     # com cobertura
```
