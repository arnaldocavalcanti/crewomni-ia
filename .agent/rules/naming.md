# Convenções de Nomenclatura — AI Agent Hub

## TypeScript

| O que é | Convenção | Exemplo |
|---|---|---|
| Entidade | PascalCase | `Agent`, `Tenant`, `KnowledgeChunk` |
| Interface de repository | `I` + PascalCase | `IAgentRepository` |
| Use-case | PascalCase (verbo + substantivo) | `CreateAgent`, `BuildRAGContext` |
| Enum | PascalCase | `KnowledgeLayer`, `AgentType` |
| Valor de enum | UPPER_SNAKE_CASE | `GLOBAL`, `REAL_ESTATE` |
| Tipo utilitário | PascalCase + sufixo | `CreateAgentInput`, `AgentResponse` |
| Função | camelCase | `resolveContext`, `buildPrompt` |
| Variável | camelCase | `tenantId`, `ragContext` |
| Constante global | UPPER_SNAKE_CASE | `MAX_CHUNKS_PER_LAYER` |
| Componente React | PascalCase | `AgentCard`, `ChatWidget` |
| Hook React | `use` + PascalCase | `useAgent`, `useTenantContext` |

## Arquivos

| O que é | Convenção | Exemplo |
|---|---|---|
| Entidade | PascalCase.ts | `Agent.ts` |
| Interface | `I` + PascalCase.ts | `IAgentRepository.ts` |
| Use-case | PascalCase.ts | `CreateAgent.ts` |
| Implementação de infra | Prefixo + PascalCase.ts | `PrismaAgentRepository.ts` |
| Componente React | PascalCase.tsx | `AgentCard.tsx` |
| API route | `route.ts` | `route.ts` |
| Teste | `<NomeDoArquivo>.test.ts` | `CreateAgent.test.ts` |
| Spec SDD | kebab-case.md | `create-agent.md` |

## Banco de dados (Prisma)

| O que é | Convenção | Exemplo |
|---|---|---|
| Model | PascalCase singular | `Agent`, `Tenant` |
| Campo | camelCase | `tenantId`, `createdAt` |
| Enum Prisma | PascalCase | `AgentStatus` |
| Valor de enum Prisma | UPPER_SNAKE_CASE | `ACTIVE`, `DRAFT` |
| Tabela (gerada) | snake_case plural | `agents`, `tenants` |

## Domínios

| Domínio | Pasta |
|---|---|
| tenant | `domains/tenant/` |
| agent | `domains/agent/` |
| knowledge | `domains/knowledge/` |
| conversation | `domains/conversation/` |
| distillation | `domains/distillation/` |
| niche | `domains/niche/` |
| auth | `domains/auth/` |

## Nichos (Niche enum)

```typescript
enum Niche {
  REAL_ESTATE  = 'REAL_ESTATE',
  ESIGN        = 'ESIGN',
  LEGAL        = 'LEGAL',
  HR           = 'HR',
  SUPPORT      = 'SUPPORT',
}
```

## Tipos de agente (AgentType enum)

```typescript
enum AgentType {
  SDR          = 'SDR',
  HELPDESK     = 'HELPDESK',
  NEGOTIATION  = 'NEGOTIATION',
  ONBOARDING   = 'ONBOARDING',
  SUPPORT      = 'SUPPORT',
  SALES        = 'SALES',
}
```

## Prefixos de chave Redis

```
tenant:{tenantId}:session:{sessionId}
tenant:{tenantId}:agent:{agentId}:response:{hash}
tenant:{tenantId}:kb:version
platform:niche:{niche}:master-agent
```
