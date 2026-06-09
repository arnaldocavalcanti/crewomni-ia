# Evolução do Cadastro de Agentes (Categoria, Papel Customizável e Função Operacional)

> **Status:** DRAFT
> **Domínio:** agent
> **Autor:** @antigravity
> **Data:** 2026-06-06

---

## 1. Objetivo

Evolução do cadastro e da entidade de Agentes para suportar atributos dinâmicos e papéis flexíveis, incluindo suporte a categorias amplas, papéis globais e customizados por tenant (via nova entidade `AgentRole`), funções operacionais específicas e configurações avançadas de comportamento, permissões e diretivas operacionais.

---

## 2. Contexto de negócio

Para habilitar o conceito de "profissional digital em uma crew" (em vez de um mero chatbot), os agentes precisam de papéis realistas que reflitam a sua função na equipe. Além disso, cada cliente (tenant) precisa criar novos papéis personalizados que não requeiram atualização no código-fonte.

---

## 3. Problema que resolve

O acoplamento rígido do campo `type` (enum `AgentType`) impede a criação de novas especializações de agentes pelos tenants, limitando a flexibilidade operacional e de workflow do CrewOmni.

---

## 4. Regras de negócio

1. **Estrutura de Papéis (`AgentRole`):** Os papéis de agente podem ser globais (`tenantId = null`) ou específicos de um tenant (`tenantId = string`).
2. **Unicidade de Nome de Papel:** Não é permitido criar um papel personalizado com um nome que já exista no escopo do tenant ou globalmente.
3. **Isolamento de Papéis:** Um tenant nunca pode listar, usar, modificar ou referenciar papéis pertencentes a outro tenant. Qualquer tentativa de acessar ou referenciar papéis de outros tenants deve resultar em **404 Not Found** (para não revelar a existência do recurso).
4. **Retrocompatibilidade com `type` (AgentType):** O campo `type` (enum `AgentType`) será mantido no modelo `Agent` e na tabela `agents` para compatibilidade com APIs legadas, testes existentes e o mecanismo de RAG. Ele será preenchido automaticamente com base na categoria e papel associados:
   - Categoria "Comercial" -> `AgentType.SALES` ou `AgentType.SDR` (padrão)
   - Categoria "Suporte" -> `AgentType.SUPPORT` ou `AgentType.HELPDESK` (padrão)
   - Categoria "Atendimento" -> `AgentType.SUPPORT`
   - Outras categorias -> `AgentType.SALES` (fallback padrão)
5. **Configurações Avançadas de Comportamento:** O cadastro de agentes passa a aceitar campos de tom de voz, estilo de comunicação, nível de autonomia e modos de atuação (armazenados como uma lista JSON no campo `responsibilities`).
6. **Formato de Saída e Diretivas:** Instruções específicas sobre formatos de saída (ex: Texto livre, JSON, WhatsApp, E-mail), exemplos e regras específicas podem ser configurados no agente.

---

## 5. Fluxos principais

### Fluxo 1: Criar agente com papel global existente
```
1. Usuário (TENANT_ADMIN / OPERATOR) envia payload de criação do agente contendo as novas propriedades e o ID do papel global
2. Sistema valida integridade dos parâmetros e verifica se o roleId pertence ao tenant ou é global (null)
3. Sistema valida slug e nome únicos de agente no tenant
4. Sistema insere o agente no banco de dados e calcula o campo "type" (AgentType) para compatibilidade
5. Sistema insere o prompt versão 1 (DRAFT) com o systemPrompt fornecido
6. Sistema gera log de auditoria da criação do agente
7. Sistema retorna o agente criado com seu respectivo papel
```

### Fluxo 2: Criar papel personalizado (inline na UX)
```
1. Usuário solicita criação de papel personalizado enviando { name, category, description }
2. Sistema valida que o nome do papel é único no tenant (e nos globais)
3. Sistema salva o AgentRole associando ao tenantId do usuário autenticado
4. Sistema retorna o papel criado contendo seu ID
5. Usuário pode então prosseguir criando o agente utilizando este novo ID
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Input com dados inválidos (Zod) | Retorna 422 com mensagens descritivas dos campos inválidos |
| Associar a roleId de outro tenant | Retorna 404 (ROLE_NOT_FOUND) |
| Nome de papel personalizado duplicado | Retorna 400 (ROLE_NAME_DUPLICATED) |
| Ultrapassar limite de agentes ativos | Retorna 400 (AGENT_LIMIT_REACHED) |

---

## 7. Critérios de aceite

- **Dado** um tenant autenticado, **quando** ele solicitar a listagem de papéis de agentes, **então** deve receber a junção dos papéis globais com os seus próprios papéis customizados.
- **Dado** um tenant autenticado, **quando** ele solicitar a listagem de papéis, **então** não deve receber papéis customizados de nenhum outro tenant.
- **Dado** a criação de um agente, **quando** fornecidos os campos de categoria, papel, função operacional, autonomia e formato de saída, **então** o agente deve ser salvo com sucesso com todos os parâmetros persistidos e o campo `type` compatibilizado.
- **Dado** um agente com o campo `responsibilities` configurado, **quando** retornado pela API, **então** deve conter o array JSON estruturado com os modos de atuação.
- **Dado** a exclusão de um tenant, **quando** executada, **então** todos os papéis customizados desse tenant devem ser deletados em cascata.

---

## 8. Contratos de entrada e saída

### Criação de Papel Customizado

```typescript
// POST /api/v1/agents/roles
type CreateAgentRoleInput = {
  name: string
  category: string
  description?: string
}

type CreateAgentRoleOutput = {
  id: string
  tenantId: string
  name: string
  category: string
  description: string | null
  createdAt: Date
}
```

### Criação de Agente (Payload Estendido)

```typescript
// POST /api/v1/agents
type CreateAgentInput = {
  name: string
  slug: string
  category: string
  roleId: string
  operationalFunction: string
  description?: string
  systemPrompt: string
  
  // Contexto Organizacional & Responsável
  directorId?: string
  mainChannel?: string

  // Comportamento & Autonomia
  toneOfVoice?: string
  communicationStyle?: string
  autonomyLevel?: string        // "LOW" | "MEDIUM" | "HIGH"
  responsibilities?: string[]   // JSON array in DB

  // Permissões e Ferramentas
  permissionReadKB?: boolean
  permissionSendWhatsapp?: boolean
  permissionSendEmail?: boolean
  permissionExecuteTool?: boolean
  permissionCallHuman?: boolean
  permissionCreateTask?: boolean
  permissionReadHistory?: boolean
  permissionReadCommercial?: boolean

  // Diretivas e Formatos
  outputFormat?: string
  expectedExamples?: string
  specificRules?: string
}

type CreateAgentOutput = {
  agent: {
    id: string
    tenantId: string
    name: string
    slug: string
    type: AgentType
    category: string
    roleId: string
    operationalFunction: string
    description: string | null
    status: AgentStatus
    createdAt: Date
    updatedAt: Date
    // novos campos de comportamento/permissões
    responsibilities: string[]
    // ...
  }
  promptVersion: {
    id: string
    version: number
    systemPrompt: string
  }
}
```

---

## 9. Impacto arquitetural

- [x] Nova tabela no banco: `agent_roles`
- [x] Nova entidade: `AgentRole`
- [x] Novos use-cases: `CreateAgentRole`, `ListAgentRoles`
- [x] Novas API routes: `GET/POST /api/v1/agents/roles`
- [x] Alteração em entidade existente: `Agent` — campos de categorização, comportamento, contexto organizacional e permissões adicionados
- [x] Alteração no use-case `CreateAgent` para validações e preenchimento dos novos campos

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Quebra de compatibilidade em testes legados de criação de agentes | Média | Alta | Garantir fallback ou mapeamento do campo `type` a partir do `roleId` e aceitar valores defaults se novos campos forem omitidos. |
| Ingestão e consultas ao banco mais lentas por múltiplos relacionamentos | Baixa | Média | Criação de índices específicos nas tabelas `agents` e `agent_roles` para `tenantId` e chaves estrangeiras. |
| Vazamento de informações de outros tenants através de papéis | Baixa | Altíssima | Filtro estrito por `tenantId` (ou `tenantId IS NULL` para globais) em todas as consultas da tabela `agent_roles`. |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/agent/`):**
- [ ] `deve criar agente associado a um papel global`
- [ ] `deve criar agente com todos os novos campos de comportamento e permissões estruturados`
- [ ] `deve lançar erro de validação ao criar agente com slug inválido`
- [ ] `deve lançar erro se roleId fornecido pertencer a outro tenant`
- [ ] `deve mapear corretamente o AgentType de compatibilidade a partir do papel`
- [ ] `deve criar papel personalizado com nome único`
- [ ] `deve rejeitar criação de papel com nome duplicado no mesmo tenant`
- [ ] `deve listar apenas papéis globais e customizados do próprio tenant`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve acessar nem associar papéis customizados de tenant B`
- [ ] `contrato de API: POST /api/v1/agents cria e persiste os novos campos em JSON`
- [ ] `contrato de API: GET /api/v1/agents/roles retorna shape correto com globais + locais`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** Nome, categoria, papel, funções e permissões dos agentes. Prompts de sistema e diretrizes comportamentais.
- **Finalidade:** Definir e guiar o comportamento autônomo dos agentes no processamento de mensagens.
- **Retenção:** Vinculados ao ciclo de vida do agente e do tenant.
- **Exclusão:** Quando o agente é deletado, ou o tenant é desativado, todos os registros relacionados (incluindo papéis customizados) são excluídos fisicamente (`onDelete: Cascade`).
- **Dados sensíveis:** Não há armazenamento de dados pessoais ou sensíveis dos usuários finais nos dados cadastrais dos agentes.

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todas as queries e escritas de `AgentRole` e `Agent`.
- As consultas de papéis customizados usam `where: { OR: [{ tenantId: null }, { tenantId }] }`.
- Audit logs registram todas as ações de criação de papéis e agentes vinculados ao `tenantId` da sessão.
- Isolamento multi-tenant testado especificamente em testes unitários e de integração de repositórios e rotas.
