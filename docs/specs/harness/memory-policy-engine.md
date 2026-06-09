# Memory Policy Engine

> **Status:** APPROVED  
> **Domínio:** memory-policy  
> **Autor:** @arnaldo  
> **Data:** 2026-06-07  
> **Fase:** 2.5 — Agent Harness Core  
> **Depende de:** ADR 004 (prompt hierárquico), conversation-lifecycle spec

---

## 1. Objetivo

Definir uma política explícita de memória e contexto que decide o que entra no prompt atual, o que vira resumo, o que é persistido como memória durável e o que é descartado — mantendo o contexto do agente coerente em conversas longas (dias/semanas) sem estourar o token limit.

---

## 2. Contexto de negócio

O `BuildRAGContext` atual carrega as últimas N mensagens da conversa diretamente. Em WhatsApp, uma conversa pode ter centenas de mensagens ao longo de dias. Carregar tudo a cada turno:
1. Estoura o context window do LLM
2. Aumenta o custo a cada mensagem (mais tokens de entrada)
3. Inclui mensagens irrelevantes que "diluem" o foco do agente

A Memory Policy Engine decide, para cada turno, quais memórias são relevantes e como serão representadas no prompt — sem ultrapassar o budget de tokens definido em ADR 004.

---

## 3. Problema que resolve

- Conversas longas estourando context window
- Agente "esquecendo" informações importantes de turnos anteriores
- Custo crescendo linearmente com o número de mensagens
- Sem memória durável, cada nova conversa do mesmo lead começa do zero
- Sem política explícita, o que entra no contexto é arbitrário

---

## 4. Regras de negócio

1. O buffer de mensagens recentes no prompt **nunca ultrapassa** `memoryPolicy.maxBufferTokens` (padrão: 2000 tokens).
2. Se o buffer exceder o limite, as mensagens mais antigas são substituídas pelo summary.
3. O summary é atualizado quando: (a) buffer atinge 20 mensagens, (b) conversa é encerrada, (c) mudança de stage de qualificação detectada.
4. O summary **nunca contém** dados sensíveis em texto plano (PII mascarado).
5. Memória durável (`ContactMemory`) só é criada com status `CANDIDATE` — não entra automaticamente no prompt até estar `APPROVED`.
6. Memória durável `ACTIVE` entra no prompt na seção `---MEMÓRIA DO CONTATO---` do prompt hierárquico (ADR 004).
7. Dados que não podem ser salvos por LGPD são descartados — `shouldPersist: false`.
8. A política é configurável por tenant via `TenantMemoryPolicyConfig`.
9. Toda decisão de memória é registrada em trace para auditoria.
10. O use-case `ApplyMemoryPolicy` não chama LLM — é determinístico.
11. O use-case `SummarizeConversation` chama LLM (gpt-4o-mini) e é assíncrono (pós-turno).

---

## 5. Fluxos principais

### Construção do contexto para um turno

```
1. OrchestrateInboundMessage chama ApplyMemoryPolicy(conversationId, tenantId)
2. ApplyMemoryPolicy:
   a. Carrega ConversationSummary (se existir)
   b. Carrega últimas N mensagens (buffer)
   c. Calcula tokens do buffer
   d. Se buffer > maxBufferTokens: trunca buffer mais antigo
   e. Carrega ContactMemory com status ACTIVE do contato
   f. Carrega QualificationState existente
   g. Retorna MemoryContext com: summary, buffer, contactMemory, qualificationState
3. BuildRAGContext recebe MemoryContext e monta prompt hierárquico
```

### Atualização do summary (assíncrono, pós-turno)

```
1. Após OrchestrateInboundMessage concluir, verifica:
   a. Buffer atingiu 20 mensagens? → disparar SummarizeConversation
   b. Conversa fechada? → disparar SummarizeConversation final
2. SummarizeConversation:
   a. Carrega mensagens do período não-sumarizado
   b. Chama LLM com prompt de summarização (gpt-4o-mini)
   c. Atualiza ConversationSummary.summary + lastSummarizedMessageId
   d. Incrementa summaryVersion
3. Mensagens antigas (já no summary) são mantidas no banco mas não no prompt
```

### Criação de memória durável (candidato)

```
1. Após turno, agente pode retornar flag memoryCandidates: [...] em metadata
2. OrchestrateInboundMessage cria ContactMemory com status CANDIDATE
3. LGPD check: se dado contém PII sensível → shouldPersist=false → não salvar
4. KDL_APPROVER ou TENANT_ADMIN aprova → status ACTIVE
5. Na próxima conversa do mesmo contato, memória ACTIVE entra no prompt
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| ConversationSummary não existe ainda | Prompt usa apenas buffer sem bloco de summary |
| Buffer vazio (primeira mensagem) | Prompt sem buffer — apenas conhecimento base |
| ContactMemory com status CANDIDATE | NÃO entra no prompt |
| ContactMemory com status REJECTED/EXPIRED | NÃO entra no prompt |
| Dado marcado shouldPersist=false | Descartado — não criado no banco |
| SummarizeConversation falha | Erro silencioso — summary atrasado; buffer continua sendo usado |
| maxBufferTokens não configurado pelo tenant | Usa padrão global: 2000 tokens |

---

## 7. Critérios de aceite

- Dado buffer com 25 mensagens e maxBufferTokens = 2000, quando ApplyMemoryPolicy é chamado, então apenas as mensagens recentes que cabem no limite são incluídas; o resto é representado pelo summary
- Dado uma ConversationSummary existente, quando ApplyMemoryPolicy monta o contexto, então o bloco de summary é incluído antes do buffer
- Dado buffer atingindo 20 mensagens, quando turno é concluído, então SummarizeConversation é disparado assincronamente
- Dado ContactMemory com status CANDIDATE, quando ApplyMemoryPolicy é chamado, então a memória NÃO aparece no prompt
- Dado ContactMemory com status ACTIVE, quando ApplyMemoryPolicy é chamado, então a memória aparece no bloco `---MEMÓRIA DO CONTATO---` do prompt
- Dado dado sensível (PII) sem política de retenção, quando sistema tenta criar ContactMemory, então shouldPersist é false e o dado não é salvo
- Dado tenant com maxBufferTokens=1000 configurado, quando ApplyMemoryPolicy é chamado, então o budget de 1000 tokens é respeitado

---

## 8. Contratos de entrada e saída

```typescript
// Entidade: ConversationSummary
type ConversationSummary = {
  id: string
  tenantId: string
  conversationId: string
  summary: string                    // texto do resumo gerado pelo LLM
  lastSummarizedMessageId: string    // até qual mensagem foi sumarizado
  summaryVersion: number
  tokenCount: number                 // tokens do summary
  createdAt: Date
  updatedAt: Date
}

// Entidade: ContactMemory
type ContactMemoryStatus = 'CANDIDATE' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'EXPIRED'

type ContactMemory = {
  id: string
  tenantId: string
  contactId: string
  memoryType: 'FACT' | 'PREFERENCE' | 'QUALIFICATION' | 'CONTEXT'
  content: string
  sourceConversationId: string
  confidence: number               // 0-1
  status: ContactMemoryStatus
  shouldPersist: boolean           // false = descartado por LGPD
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Configuração de política por tenant
type TenantMemoryPolicyConfig = {
  tenantId: string
  maxBufferTokens: number        // padrão: 2000
  maxBufferMessages: number      // padrão: 20
  summaryTriggerMessages: number // padrão: 20
  summaryTriggerTokens: number   // padrão: 4000
  enableContactMemory: boolean   // padrão: true
  enableAutoSummary: boolean     // padrão: true
  contactMemoryAutoApprove: boolean // padrão: false (requer aprovação)
}

// Output do ApplyMemoryPolicy
type MemoryContext = {
  summary?: string               // null se não existe ainda
  summaryTokenCount: number
  buffer: ConversationMessage[]  // mensagens recentes (dentro do budget)
  bufferTokenCount: number
  contactMemories: ContactMemory[] // apenas status ACTIVE
  qualificationState?: QualificationState
  totalTokensUsed: number
  truncatedMessages: number      // quantas mensagens foram truncadas do buffer
}

// Input do ApplyMemoryPolicy
type ApplyMemoryPolicyInput = {
  tenantId: string
  conversationId: string
  contactId?: string
}

// Input do SummarizeConversation
type SummarizeConversationInput = {
  tenantId: string
  conversationId: string
  fromMessageId?: string   // a partir de qual mensagem sumarizar
}

// Interface
interface IMemoryPolicyEngine {
  apply(input: ApplyMemoryPolicyInput): Promise<MemoryContext>
}

interface IConversationSummaryRepository {
  findByConversationId(conversationId: string, tenantId: string): Promise<ConversationSummary | null>
  upsert(summary: ConversationSummary): Promise<void>
}

interface IContactMemoryRepository {
  findActiveByContactId(contactId: string, tenantId: string): Promise<ContactMemory[]>
  save(memory: ContactMemory): Promise<void>
  updateStatus(id: string, status: ContactMemoryStatus, tenantId: string): Promise<void>
  findCandidatesByTenant(tenantId: string, limit: number): Promise<ContactMemory[]>
}
```

---

## 9. Impacto arquitetural

- [x] Nova entidade: `ConversationSummary` — `src/domains/memory-policy/entities/ConversationSummary.ts`
- [x] Nova entidade: `ContactMemory` — `src/domains/memory-policy/entities/ContactMemory.ts`
- [x] Nova entidade: `TenantMemoryPolicyConfig` — `src/domains/memory-policy/entities/TenantMemoryPolicyConfig.ts`
- [x] Nova interface: `IMemoryPolicyEngine` — `src/domains/memory-policy/IMemoryPolicyEngine.ts`
- [x] Novo use-case: `ApplyMemoryPolicy` — `src/domains/memory-policy/use-cases/ApplyMemoryPolicy.ts`
- [x] Novo use-case: `SummarizeConversation` — `src/domains/memory-policy/use-cases/SummarizeConversation.ts`
- [x] Nova interface: `IConversationSummaryRepository`
- [x] Nova interface: `IContactMemoryRepository`
- [x] Nova infra: `InMemoryConversationSummaryRepository`
- [x] Nova infra: `PrismaConversationSummaryRepository`
- [x] Nova infra: `InMemoryContactMemoryRepository`
- [x] Nova infra: `PrismaContactMemoryRepository`
- [x] Modificação: `BuildRAGContext` recebe `MemoryContext` e monta prompt com summary + buffer + contactMemories
- [x] Novas tabelas Prisma: `conversation_summaries`, `contact_memories`, `tenant_memory_policy_configs`
- [x] DI: registrar `ApplyMemoryPolicy`, `SummarizeConversation`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Summary gerado pelo LLM incluir PII | Média | Alto | Prompt de summary instrui explicitamente a mascarar nomes, telefones, e-mails |
| SummarizeConversation falhar silenciosamente e nunca sumariizar | Média | Médio | Monitor: se buffer > 40 msgs sem summary, alerta de observabilidade |
| ContactMemory com informação incorreta contaminar conversas futuras | Baixa | Médio | Aprovação humana obrigatória (contactMemoryAutoApprove: false por padrão) |
| Custo de gpt-4o-mini para summary ser significativo | Baixa | Baixo | Summary só é gerado após 20 msgs (não a cada turno); modelo mini é barato |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/memory-policy/`):**
- [x] `ApplyMemoryPolicy deve retornar buffer truncado quando excede maxBufferTokens`
- [x] `ApplyMemoryPolicy deve incluir summary quando ConversationSummary existe`
- [x] `ApplyMemoryPolicy deve excluir ContactMemory com status CANDIDATE`
- [x] `ApplyMemoryPolicy deve incluir ContactMemory com status ACTIVE`
- [x] `ApplyMemoryPolicy deve incluir QualificationState quando disponível`
- [x] `SummarizeConversation deve atualizar lastSummarizedMessageId corretamente`
- [x] `SummarizeConversation deve incrementar summaryVersion`
- [x] `ContactMemory com shouldPersist=false não deve ser salvo`

**Integração (`tests/integration/memory-policy/`):**
- [x] `tenant A não deve acessar ContactMemory de tenant B`
- [x] `BuildRAGContext com MemoryContext deve incluir bloco de summary no prompt`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** resumo de conversa (sem PII), memória de fatos sobre o contato
- **Finalidade:** melhorar coerência do agente em conversas longas; contexto persistente entre sessões
- **Retenção:** ConversationSummary: life da conversa + 30 dias. ContactMemory: configurável (padrão 365 dias), com expiresAt
- **Exclusão:** direito ao esquecimento — DELETE cascade de ContactMemory via Contact
- **Dados sensíveis:** summary nunca inclui CPF, cartão, senhas — prompt de sumarização instrui explicitamente
- **KDL:** summary pode alimentar KDL se tenant tem opt-in, após anonimização obrigatória

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` em todos os queries de ContactMemory e ConversationSummary ✅
- `TenantMemoryPolicyConfig` isolada por tenantId ✅
- ContactMemory.contactId pertence ao mesmo tenant ✅
- RLS nas tabelas `conversation_summaries` e `contact_memories` ✅
- Cache futuro com prefixo `tenant:{tenantId}:memory:` ✅
- Audit log registra operações de memória com tenantId ✅
