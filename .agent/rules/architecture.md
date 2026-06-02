# Arquitetura — AI Agent Hub

## Princípios

- **Clean Architecture pragmática**: domínio no centro, infraestrutura nas bordas
- **Separação por domínio**: cada domínio é autocontido (entidades + repositórios + use-cases + testes)
- **Ports & Adapters**: domínio define interfaces; infraestrutura implementa
- **Sem dependências cruzadas**: domínios não importam uns dos outros diretamente — usam interfaces compartilhadas em `shared/`

## Estrutura de pastas

```
src/
├── app/                      # Next.js App Router (apenas roteamento e UI)
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── (public)/
│   └── api/v1/               # API routes — chamam use-cases, nunca lógica direta
│
├── domains/                  # Núcleo de negócio — sem dependência de framework
│   ├── tenant/
│   ├── agent/
│   ├── knowledge/
│   ├── conversation/
│   ├── distillation/
│   ├── niche/
│   └── auth/
│
├── infrastructure/           # Implementações concretas (banco, LLM, cache, fila)
│   ├── db/prisma/
│   ├── vector/
│   ├── llm/
│   ├── cache/
│   ├── queue/
│   └── audit/
│
├── shared/                   # Tipos, erros e utilitários sem lógica de domínio
│   ├── types/
│   ├── errors/
│   ├── guards/
│   ├── utils/
│   └── constants/
│
└── components/               # UI components (shadcn/ui base + domínio-específicos)
    ├── ui/
    ├── chat/
    ├── dashboard/
    └── distillation/
```

## Estrutura interna de cada domínio

```
domains/<domínio>/
├── entities/           # Entidades e value objects — pura lógica de negócio
├── repositories/       # Interfaces (portas) — nunca implementações
├── use-cases/          # Um arquivo por caso de uso
└── __tests__/          # Testes unitários do domínio
```

## Regras de dependência

```
app/ → domains/ (use-cases) → shared/
app/ → infrastructure/ (via injeção de dependência)
infrastructure/ → domains/ (implementa interfaces dos repositories)
domains/ → shared/ (tipos e erros apenas)
domains/ NÃO importam infrastructure/
domains/ NÃO importam app/
```

## Camadas de conhecimento (Knowledge Layers)

```typescript
enum KnowledgeLayer {
  GLOBAL     = 'GLOBAL',      // Plataforma — boas práticas gerais
  INDUSTRY   = 'INDUSTRY',    // Nicho — conhecimento coletivo anonimizado
  TENANT     = 'TENANT',      // Empresa — conhecimento privado
  AGENT      = 'AGENT',       // Agente específico — configuração e tom
}
```

Acesso sempre em ordem: GLOBAL → INDUSTRY → TENANT → AGENT → Conversation Memory.
Nunca pule camadas. Nunca misture tenants na mesma query de vector store.

## Convenção de arquivos

| O que é | Onde fica | Exemplo |
|---|---|---|
| Entidade | `domains/<d>/entities/` | `Agent.ts` |
| Interface de repository | `domains/<d>/repositories/` | `IAgentRepository.ts` |
| Use-case | `domains/<d>/use-cases/` | `CreateAgent.ts` |
| Implementação de repository | `infrastructure/db/repositories/` | `PrismaAgentRepository.ts` |
| API route | `app/api/v1/<recurso>/route.ts` | `route.ts` |
| Componente UI | `components/<domínio>/` | `AgentCard.tsx` |
| Teste unitário | `tests/unit/domains/<d>/` | `CreateAgent.test.ts` |
| Teste de integração | `tests/integration/` | `tenant-isolation.test.ts` |
