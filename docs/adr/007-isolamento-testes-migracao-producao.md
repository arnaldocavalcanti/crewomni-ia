# ADR 007: Isolamento de Banco de Testes e Estratégia de Migração Automática

## Status
Aprovada (Approved)

## Contexto
Durante o desenvolvimento das Fases 1 e 2 do CrewOmni, ocorreram dois incidentes críticos relacionados ao banco de dados:
1. **Perda de Dados Local:** A execução da suíte de testes de integração (`vitest`) usava a mesma base de dados de desenvolvimento (`crewomni_dev`), disparando rotinas de limpeza (`.deleteMany()`) que apagavam os agentes e inquilinos cadastrados localmente.
2. **Schema Drift em Produção:** O deploy de uma nova versão do backend com novas colunas no Prisma Schema sem a execução prévia da migração no banco de dados Neon fez com que as queries quebrassem em produção. O erro SQL silencioso fez parecer que os dados em produção haviam sido completamente deletados, gerando alarmes falsos de vazamento/perda de dados.

## Decisões
Para mitigar os riscos e garantir integridade absoluta dos dados, definimos as seguintes regras de arquitetura:

### 1. Isolamento Absoluto de Testes Locais
* A suíte de testes de integração **nunca** rodará na mesma base que o ambiente de desenvolvimento local (`crewomni_dev`).
* Criamos o arquivo [`.env.test`](file:///Users/arnaldocavalcanti/Documents/Projects_AI/crewomni/crewomni-ia/.env.test) apontando para uma base de testes dedicada: `crewomni_test`.
* O container PostgreSQL no Docker (`docker-compose.yml` via `init.sql`) deve subir automaticamente com ambas as bases configuradas e com extensões habilitadas (`uuid-ossp` e `vector`).
* Todos os comandos de teste no `package.json` devem ser prefixados com `dotenv -e .env.test --` para chavear as conexões de forma segura.

### 2. Execução Sequencial dos Testes de Integração
* Devido à concorrência na escrita/limpeza de registros no mesmo banco físico compartilhado, a flag `--fileParallelism=false` é obrigatória ao rodar testes de integração via Vitest, rodando os arquivos de teste em série.

### 3. Automação de Migrações em Produção (Vercel)
* O processo de deploy na Vercel deve garantir que o banco esteja migrado antes do build da aplicação.
* Configuramos o comando de build na Vercel para rodar:
  ```bash
  npx prisma migrate deploy && next build
  ```
  Isso garante que toda nova migration seja aplicada de forma não destrutiva no banco Neon de produção imediatamente antes da compilação e ativação da nova versão do código.

## Consequências
* **Segurança:** Zero risco de apagar dados de desenvolvimento local durante a execução de testes automatizados.
* **Estabilidade:** Deploy sem downtime de esquema. Se uma migração falhar, o build da Vercel falha e a versão anterior estável do app continua no ar, evitando expor telas quebradas/vazias aos usuários.
* **Desempenho:** Testes rodam de forma determinística e isolada, sem falsos negativos por concorrência de banco.
