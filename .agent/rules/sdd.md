# SDD — Specification-Driven Development

## Regra fundamental

> Nenhuma funcionalidade é implementada sem uma spec completa e aprovada em `/docs/specs/`.

## Quando criar uma spec

- Antes de qualquer novo use-case
- Antes de qualquer nova API route
- Antes de qualquer alteração em entidade de domínio
- Antes de qualquer mudança no schema do banco que afete regras de negócio

## Localização

```
docs/specs/
├── _template.md          # Template obrigatório
├── auth/
├── tenant/
├── agent/
├── knowledge/
├── distillation/
└── billing/
```

## Fluxo SDD

```
1. Criar spec usando o template em /docs/specs/_template.md
2. Preencher todas as 13 seções
3. Aguardar aprovação (humana ou explícita no chat)
4. Criar testes baseados nos critérios de aceite da spec
5. Implementar
6. Todos os testes passando = spec concluída
```

## As 13 seções obrigatórias

1. **Objetivo** — o que essa feature faz em uma frase
2. **Contexto de negócio** — por que isso existe no produto
3. **Problema que resolve** — dor ou gap que endereça
4. **Regras de negócio** — lista numerada, sem ambiguidade
5. **Fluxos principais** — passo a passo do caminho feliz
6. **Fluxos alternativos** — erros, edge cases, caminhos secundários
7. **Critérios de aceite** — lista de "dado X, quando Y, então Z"
8. **Contratos de entrada e saída** — tipos TypeScript dos inputs/outputs
9. **Impacto arquitetural** — o que muda na estrutura existente
10. **Riscos** — o que pode dar errado
11. **Testes esperados** — lista de testes que devem existir
12. **Critérios LGPD e privacidade** — quais dados são coletados e como
13. **Critérios de isolamento multi-tenant** — como o isolamento é garantido

## O que uma spec NÃO é

- Não é documentação de código (isso fica nos testes e no código)
- Não é um PRD completo (é uma spec técnica de uma feature específica)
- Não é opcional

## Status de uma spec

| Status | Significado |
|---|---|
| `DRAFT` | Em elaboração |
| `REVIEW` | Aguardando aprovação |
| `APPROVED` | Aprovada — pode implementar |
| `IMPLEMENTED` | Implementada e testada |
| `DEPRECATED` | Substituída por outra spec |
