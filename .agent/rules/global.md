# Regras Globais — AI Agent Hub

Estas regras são obrigatórias para todos os agentes de IA que trabalharem neste projeto.
Leia este arquivo antes de qualquer intervenção no código.

## Fluxo obrigatório antes de implementar

1. Verifique se existe spec em `/docs/specs/<domínio>/<feature>.md`
2. Se não existir, crie a spec antes de qualquer código
3. Verifique se existem testes em `/tests/unit/` e `/tests/integration/`
4. Se não existirem, crie os testes antes da implementação
5. Só então implemente

> Nenhum use-case chega à produção sem spec aprovada e testes verdes.

## Regras de isolamento multi-tenant (invioláveis)

- Todo acesso a dados deve filtrar por `tenantId`
- Nunca busque dados sem `tenantId` explícito nas queries
- Nunca exponha `tenantId` de um tenant em respostas de outro
- Row Level Security é a última linha de defesa — a primeira é o código

## Regras de conhecimento e privacidade

- Dados brutos de um tenant nunca alimentam outro tenant
- A Knowledge Distillation Layer (KDL) é a única via de aprendizado coletivo
- Toda informação que sair do escopo de um tenant deve passar pela KDL
- Nenhum dado pessoal, identificável ou sensível entra na Industry KB

## O que não fazer

- Não implemente sem spec
- Não implemente sem testes
- Não misture lógica de domínio com infraestrutura
- Não adicione lógica de negócio em API routes — use use-cases
- Não acesse o banco diretamente fora dos repositories
- Não chame o LLM diretamente fora da camada de infraestrutura (`infrastructure/llm/`)
- Não crie arquivos fora da estrutura de pastas definida em `architecture.md`
- Não remova `tenantId` de queries sem aprovação explícita

## Leia também

- `.agent/rules/architecture.md` — estrutura de pastas e padrões de código
- `.agent/rules/sdd.md` — fluxo de especificação
- `.agent/rules/tdd.md` — fluxo de testes
- `.agent/rules/lgpd.md` — regras de privacidade e LGPD
- `.agent/rules/naming.md` — convenções de nomenclatura
- `.agent/rules/security.md` — regras de segurança
