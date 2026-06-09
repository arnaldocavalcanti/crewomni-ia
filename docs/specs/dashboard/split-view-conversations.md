# Split-View Operational Dashboard (Conversations & Handoff)

> **Status:** REVIEW
> **Domínio:** conversation
> **Autor:** Antigravity
> **Data:** 2026-06-08

---

## 1. Objetivo

Implementar a interface operacional de Split-View em tempo real para o monitoramento e gerenciamento de conversas, integrando o ciclo de vida da conversa (`Conversation Lifecycle`), o estado de qualificação (`QualificationState`), o histórico de mensagens e ações operacionais como aceitar/solicitar handoff humano e fechar atendimentos.

---

## 2. Contexto de negócio

Para os operadores e administradores dos clientes (tenants), o chat e a automação precisam ser acompanháveis. O painel Split-View oferece uma visão consolidada de cada atendimento sem a necessidade de recarregar a página, permitindo que operadores humanos assumam conversas que necessitam de intervenção (handoff) rapidamente e inspecionem o que a inteligência artificial já descobriu sobre o lead (Qualificação) e o histórico resumido.

---

## 3. Problema que resolve

Evita que operadores fiquem "às cegas" sobre a atuação dos agentes de IA. Resolve o problema de latência e fricção na transição entre IA e humano, centralizando visualmente o status da conversa, o histórico, as memórias salvas e as ações operacionais.

---

## 4. Regras de negócio

1. **Isolamento por Tenant:** Um operador só pode visualizar e gerenciar conversas pertencentes ao seu respectivo `tenantId` obtido através do token de sessão JWT.
2. **Layout Split-View Responsivo:** A tela é dividida em duas partes no desktop: lista de conversas na esquerda (largura fixa ou proporcional) e visualização de detalhes à direita. No mobile, a interface exibe a lista e abre o detalhe como um drawer ou tela cheia sobreposta.
3. **Ações de Handoff e Ciclo de Vida:**
   - O operador logado pode clicar em "Assumir Atendimento" (Accept Handoff), que executa a transição para `HANDOFF_ACCEPTED` fornecendo seu `operatorId` (obtido da sessão).
   - O operador logado pode clicar em "Solicitar Handoff" (Request Handoff) caso queira transferir a conversa para a fila de intervenção humana (status `HANDOFF_REQUESTED`).
   - O operador logado pode clicar em "Encerrar Atendimento" (Close Conversation), que encerra a conversa (status `CLOSED`).
4. **Inspeção de Estado de Qualificação (`QualificationState`):** O painel lateral direito exibe os campos estruturados de qualificação do lead (ex: `Usa CRM`, `Número de colaboradores`, `Nome do contato`, etc.) extraídos dinamicamente pelo use-case correspondente.
5. **Inspeção de Histórico e Memória:** Exibe as mensagens da conversa, resumos gerados (`ConversationSummary`) e memórias de contato (`ContactMemory`).
6. **Métricas Rápidas:** A listagem exibe o status de cada conversa utilizando badges estilizados (`StatusBadge`) e informações do canal de origem (WhatsApp, Webchat).

---

## 5. Fluxos principais

### Visualizar Conversa e Informações do Lead
1. Operador acessa `/dashboard/conversations`.
2. O sistema carrega a lista de conversas ativas/abertas e a exibe no painel esquerdo.
3. Operador clica em uma conversa.
4. O painel direito carrega dinamicamente as mensagens, o `QualificationState` e a timeline de transições.

### Assumir Atendimento (Handoff)
1. Operador clica no botão "Assumir Atendimento" no painel direito da conversa selecionada.
2. O frontend chama a API `/api/v1/conversations/:id/accept-handoff` via POST.
3. A rota da API resolve o `tenantId` e `userId` da sessão, executa o use-case `AcceptHumanHandoff`.
4. O status da conversa é atualizado para `HANDOFF_ACCEPTED`.
5. O painel de detalhes atualiza o status em tempo real.

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Acesso a conversa de outro tenant | Retorna 404 (Not Found) |
| Aceitar handoff de conversa que não está em `HANDOFF_REQUESTED` ou `ACTIVE` | Retorna erro 400/422 com código da transição inválida |
| Sessão expirada | Redireciona para `/login` |

---

## 7. Critérios de aceite

- Dado um operador autenticado do Tenant A, quando ele lista as conversas, apenas as conversas do Tenant A são retornadas.
- Dado um operador autenticado, quando ele seleciona uma conversa, o painel direito exibe o status correto da conversa e a timeline de eventos.
- Dado uma conversa ativa, quando o operador clica para assumir o atendimento, a API atualiza o status no banco para `HANDOFF_ACCEPTED` e grava o `operatorId`.
- Dado uma conversa finalizada, quando o operador tenta assumir o atendimento, a API retorna erro de transição inválida.

---

## 8. Contratos de entrada e saída

### GET /api/v1/conversations (Existente, aprimorar retorno se necessário)
**Query Params:**
- `page`: number (default 1)
- `limit`: number (default 20)
- `status`: string (opcional)

### POST /api/v1/conversations/:id/accept-handoff
**Input:** N/A (usa JWT para `operatorId` e `tenantId`)
**Output:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "status": "HANDOFF_ACCEPTED"
}
```

### POST /api/v1/conversations/:id/request-handoff
**Input:**
```json
{
  "reason": "Solicitado pelo operador"
}
```
**Output:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "status": "HANDOFF_REQUESTED"
}
```

### POST /api/v1/conversations/:id/close
**Input:** N/A
**Output:**
```json
{
  "success": true,
  "status": "CLOSED"
}
```

---

## 9. Impacto arquitetural

- [ ] Novas rotas de API:
  - `POST /api/v1/conversations/:id/accept-handoff`
  - `POST /api/v1/conversations/:id/request-handoff`
  - `POST /api/v1/conversations/:id/close`
- [ ] Refatoração das telas `/dashboard/conversations` para implementar o layout Split-View.
- [ ] Integração dos componentes de visualização de `QualificationState` e `ConversationSummary` no painel direito.

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Latência na sincronização do chat | Média | Alta | Uso de polling curto ou recarregamento sob ações explícitas (otimizar com react-query se aplicável). |
| Concorrência de múltiplos operadores assumindo o mesmo chat | Baixa | Média | O primeiro que persistir ganha; os outros recebem erro 409 ou similar dizendo que o chat já foi aceito. |

---

## 11. Testes esperados

**Unitários/Integração (API Routes):**
- `POST /api/v1/conversations/:id/accept-handoff` deve passar com sucesso e atualizar BD.
- `POST /api/v1/conversations/:id/accept-handoff` deve falhar se operador tentar acessar conversa de outro tenant (retorna 404).
- `POST /api/v1/conversations/:id/request-handoff` deve exigir uma justificativa válida.

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** Ações operacionais dos usuários (logs de auditoria).
- **Dados sensíveis:** O painel exibe o histórico de chat e dados do lead (que podem conter PII). É protegido pelo isolamento estrito de autenticação JWT e HTTPS.

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` obrigatório em todas as queries e ações de controle de ciclo de vida.
- Todas as rotas de gerenciamento de chat validam se a conversa pertence ao tenant associado ao JWT do usuário logado.
