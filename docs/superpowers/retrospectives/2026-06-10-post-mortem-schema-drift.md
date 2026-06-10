# Post-Mortem: Incidente de Schema Drift e Indisponibilidade de Agentes em Produção

**Data do Incidente:** 10 de Junho de 2026  
**Severidade:** Alta (indisponibilidade temporária de listagem visual de agentes em produção)  
**Relatores:** Backend Sênior, Arquiteto e DBA (IA Agent Co-pilots)

---

## 1. Sumário Executivo

Após o deploy da nova feature de integração de departamentos nos agentes (commit `88c8c17`), o dashboard de produção no Vercel passou a exibir a listagem de agentes completamente vazia, simulando uma perda total de dados de clientes. 

*   **Impacto:** Usuários de produção não conseguiam visualizar nem interagir com os agentes criados.
*   **Causa Raiz:** O código em produção esperava a nova coluna `departmentId` na tabela `agents`, mas a migration correspondente (`20260610224659_add_department_to_agent`) não havia sido executada no banco de dados Neon de produção, gerando erro de coluna inexistente (`column "departmentId" does not exist`) que interrompeu a API de listagem.
*   **Resolução:** A migration pendente foi aplicada manualmente em produção, restabelecendo o fluxo normal e a visibilidade dos agentes.

---

## 2. Cronologia dos Eventos

*   **19:52 (Local):** Realizado o commit `88c8c17` que adicionou a coluna `departmentId` ao modelo de agentes local e gerou a migration no Git.
*   **19:55 (Local):** Deploy automático executado pelo Vercel. O dashboard passou a carregar a tela de agentes em branco (sem listar os agentes existentes).
*   **19:58 (Local):** Abertura do chamado pelo usuário informando que os agentes haviam sumido em produção.
*   **23:05 (UTC / 20:05 Local):** Análise do banco de dados Neon de produção confirmou que as linhas dos agentes continuavam intactas no banco, porém a tabela `_prisma_migrations` não continha o registro da migration de `departmentId`.
*   **23:06 (UTC / 20:06 Local):** Executado comando `npx prisma migrate deploy` contra o banco Neon de produção.
*   **23:07 (UTC / 20:07 Local):** Normalização do serviço. Acesso reestabelecido e agentes listados corretamente no dashboard de produção.

---

## 3. Causa Raiz e Análise Técnica

O erro ocorreu porque o ciclo de deploy clássico do Vercel não possui um hook nativo de execução automática de DDL (Prisma Migrations). O script de build padrão do projeto era:
```bash
prisma generate && next build
```
Esse script apenas gera os tipos do Prisma Client com base no arquivo `schema.prisma` (que já continha a nova coluna) e compila as rotas do Next.js. O banco Neon de produção permaneceu no estado físico anterior. 

Quando a rota `GET /api/v1/agents` foi acionada:
```typescript
const agents = await di.listAgents.execute({ tenantId: session.tenantId! })
```
O Prisma Client gerou a query SQL buscando `departmentId` na tabela `agents`, fazendo com que a query falhasse no banco físico e a API retornasse `500 Internal Server Error`, mascarando os dados.

---

## 4. Plano de Ação & Mitigação Definitiva

Para garantir que este tipo de incidente nunca mais ocorra em produção, implementamos as seguintes medidas protetivas imediatas:

### A. Automação de Migração no Build de Deploy (Vercel)
O script de build da Vercel foi configurado para rodar obrigatoriamente a migração antes do build do código:
```bash
npx prisma migrate deploy && next build
```
Se a migração falhar (por exemplo, bloqueio de tabela, lock de transação ou erro de sintaxe), a Vercel cancelará o build de forma segura e a versão estável anterior continuará servindo os usuários de produção (Zero Downtime).

### B. Isolamento de Testes de Integração (Local)
Para evitar que os testes locais limpem o banco de desenvolvimento do desenvolvedor:
1.  Criamos o arquivo `.env.test` direcionando conexões de teste para `crewomni_test`.
2.  Atualizamos o script `docker/init.sql` para garantir a inicialização determinística do banco de testes em novos containers.
3.  Prefixamos os comandos de teste no `package.json` com `dotenv -e .env.test --`.
4.  Garantimos a execução sequencial com a flag `--fileParallelism=false` no Vitest.

---

## 5. Checklist de Prevenção para Futuros Commits

Antes de aprovar e mesclar PRs com alterações de banco:
- [ ] Validar que todas as alterações de esquema (`schema.prisma`) possuem uma migration gerada localmente.
- [ ] Executar localmente `npm run test` e verificar que todas as migrações passam no banco de testes isolado.
- [ ] Assegurar que as credenciais do banco Neon no Vercel (Produção) possuem direitos de DDL para executar o `prisma migrate deploy` com sucesso.
