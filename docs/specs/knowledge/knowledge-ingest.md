# Knowledge Ingest — Ingestão de Documentos na Base de Conhecimento

> **Status:** APPROVED
> **Domínio:** knowledge
> **Autor:** @arnaldo
> **Data:** 2026-05-29
> **Depende de:** ADR 003 (embedding e chunking)

---

## 1. Objetivo

Permitir que operadores de um tenant insiram documentos (texto, arquivo, URL futura) na base de conhecimento privada do tenant ou de um agente específico, transformando-os em chunks vetorizados prontos para o RAG.

---

## 2. Contexto de negócio

Cada tenant tem sua própria base de conhecimento privada (`TENANT` layer) que alimenta todos os seus agentes. Um agente pode ter adicionalmente uma base específica (`AGENT` layer). A Devolus pode carregar seu manual de vistorias; a Fast4Sign pode carregar seus FAQs de assinatura eletrônica. Esse conhecimento nunca é compartilhado com outros tenants.

Layers suportadas no MVP:
- `TENANT` — conhecimento privado da empresa, compartilhado entre todos os agentes do tenant
- `AGENT` — conhecimento específico de um agente (ex: tom, casos de uso, scripts)

Layers futuras (Fase 2):
- `GLOBAL` — gerenciada pela plataforma
- `INDUSTRY` — alimentada pela KDL

---

## 3. Problema que resolve

Sem ingestão de documentos, o agente só possui o system prompt para responder. Com a base de conhecimento, o RAG enriquece cada resposta com contexto real do negócio do tenant.

---

## 4. Regras de negócio

1. Um documento pertence a exatamente um tenant — isolamento obrigatório.
2. Layer `AGENT` exige `agentId` — o agente deve pertencer ao mesmo tenant.
3. Layer `TENANT` não aceita `agentId` (é compartilhado).
4. Um documento é processado de forma assíncrona: status `PENDING → PROCESSING → READY | FAILED`.
5. O mesmo conteúdo não é re-vetorizado: hash SHA-256 do texto evita re-embedding duplicado.
6. Um tenant pode ter no máximo **500 chunks ativos** por layer (configurável por plano).
7. Chunks de um documento deletado são removidos imediatamente (cascata).
8. Somente `TENANT_ADMIN` e `TENANT_OPERATOR` podem fazer ingest.
9. O conteúdo original do documento é armazenado para auditoria e re-processamento.
10. Cada chunk armazena: `content`, `embedding` (1536 dims), `chunkIndex`, `metadata`.

---

## 5. Fluxos principais

### Ingest de texto (síncrono no MVP)
```
1. Operador envia: { title, content, layer, agentId? }
2. Sistema valida permissão e layer
3. Sistema cria KnowledgeDocument (status PROCESSING)
4. Sistema divide content em chunks (512 tokens, overlap 50)
5. Sistema gera embedding para cada chunk via IEmbeddingProvider
6. Sistema armazena cada chunk no IVectorRepository com metadados
7. Sistema cria KnowledgeChunk para cada chunk (registro relacional)
8. Sistema atualiza KnowledgeDocument para READY
9. Retorna: { documentId, chunksCreated }
```

### Deletar documento
```
1. Operador solicita deleção por documentId
2. Sistema verifica ownership (tenantId)
3. Sistema remove chunks do vector store
4. Sistema remove KnowledgeChunks do banco relacional
5. Sistema remove KnowledgeDocument
```

### Buscar conhecimento (usado internamente pelo RAG)
```
1. RAG envia: { query, tenantId, layer, agentId?, topK }
2. Sistema gera embedding da query
3. Sistema busca top-K chunks por cosine similarity
4. Filtra por tenantId + layer + agentId (quando aplicável)
5. Aplica threshold mínimo de similaridade (0.7)
6. Retorna chunks ordenados por score
```

---

## 6. Fluxos alternativos

| Situação | Comportamento esperado |
|---|---|
| Layer AGENT sem agentId | 422 `VALIDATION_ERROR` |
| agentId de outro tenant | 422 `VALIDATION_ERROR` |
| Limite de chunks atingido | 422 `CHUNK_LIMIT_REACHED` |
| Conteúdo vazio ou muito curto (<50 chars) | 422 `VALIDATION_ERROR` |
| Embedding provider falhando | Documento vai para status FAILED + audit log |
| Documento não encontrado na deleção | 404 `DOCUMENT_NOT_FOUND` |
| Documento de outro tenant | 404 (nunca 403) |

---

## 7. Critérios de aceite

- Dado texto válido e layer TENANT, quando ingerir, então documento criado com status READY e chunks vetorizados
- Dado layer AGENT sem agentId, quando ingerir, então retorna VALIDATION_ERROR
- Dado agentId de outro tenant, quando ingerir, então retorna VALIDATION_ERROR
- Dado conteúdo com menos de 50 chars, quando ingerir, então retorna VALIDATION_ERROR
- Dado mesmo conteúdo ingerido duas vezes, quando verificar, então embedding não é re-gerado (cache por hash)
- Dado limite de chunks atingido, quando ingerir, então retorna CHUNK_LIMIT_REACHED
- Dado documento existente, quando deletar, então chunks são removidos do vector store e do banco
- Dado busca por similaridade, quando consultar, então retorna apenas chunks do tenant correto
- Dado busca com threshold abaixo de 0.7, quando consultar, então chunk não é retornado
- Dado operador sem permissão, quando ingerir, então retorna FORBIDDEN

---

## 8. Contratos de entrada e saída

```typescript
// POST /api/v1/knowledge
type IngestDocumentInput = {
  title: string              // 3–200 chars
  content: string            // mínimo 50 chars
  layer: KnowledgeLayer      // TENANT | AGENT (MVP)
  agentId?: string           // obrigatório se layer = AGENT
}

enum KnowledgeLayer {
  GLOBAL   = 'GLOBAL',
  INDUSTRY = 'INDUSTRY',
  TENANT   = 'TENANT',
  AGENT    = 'AGENT',
}

type IngestDocumentOutput = {
  documentId: string
  title: string
  layer: KnowledgeLayer
  status: DocumentStatus     // READY | FAILED
  chunksCreated: number
  createdAt: string
}

enum DocumentStatus {
  PENDING    = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY      = 'READY',
  FAILED     = 'FAILED',
}

// DELETE /api/v1/knowledge/:id → 204

// Busca (interno — usado pelo RAG Orchestrator)
type SearchKnowledgeInput = {
  query: string
  tenantId: string
  layer: KnowledgeLayer
  agentId?: string
  topK?: number              // padrão: 3
  threshold?: number         // padrão: 0.7
}

type KnowledgeChunkResult = {
  id: string
  content: string
  score: number              // 0–1 (cosine similarity)
  chunkIndex: number
  documentId: string
  documentTitle: string
}

type SearchKnowledgeOutput = {
  chunks: KnowledgeChunkResult[]
}

// Erros
type KnowledgeError =
  | 'DOCUMENT_NOT_FOUND'
  | 'CHUNK_LIMIT_REACHED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'EMBEDDING_FAILED'
```

---

## 9. Impacto arquitetural

- [ ] Nova interface: `IEmbeddingProvider` — abstrai o modelo de embedding
- [ ] Nova interface: `IVectorRepository` — abstrai o vector store (pgvector / Qdrant)
- [ ] Nova tabela relacional: `knowledge_documents` — metadados do documento
- [ ] Nova tabela relacional: `knowledge_chunks` — referência dos chunks (sem embedding — no vector store)
- [ ] Migration SQL manual: `CREATE EXTENSION IF NOT EXISTS vector;` + coluna `embedding vector(1536)` na tabela de chunks do pgvector
- [ ] Nova entidade: `KnowledgeDocument`
- [ ] Nova entidade: `KnowledgeChunk`
- [ ] Novos use-cases: `IngestDocument`, `DeleteDocument`, `SearchKnowledge`
- [ ] Nova infra: `OpenAIEmbeddingProvider` (implementa `IEmbeddingProvider`)
- [ ] Nova infra: `PgVectorRepository` (implementa `IVectorRepository`, usa SQL raw)
- [ ] Novas API routes:
  - `POST /api/v1/knowledge`
  - `GET /api/v1/knowledge` (listar documentos do tenant)
  - `DELETE /api/v1/knowledge/:id`
- [ ] Prisma schema: adicionar `KnowledgeDocument` e `KnowledgeChunk`

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Custo de embedding escalar mal | Média | Alto | Cache por hash SHA-256 do conteúdo + modelo small |
| pgvector lento em grandes volumes | Baixa | Médio | Índice HNSW + limite de chunks por tenant |
| Chunk cruzar informação sensível entre tenants | Baixa | Crítico | `tenantId` em todo chunk + isolamento por namespace |
| Falha no embedding interromper ingest | Média | Médio | Status FAILED + retry manual |
| Chunk muito pequeno prejudicar qualidade do RAG | Baixa | Médio | Threshold mínimo de 50 chars + descarte de chunks pequenos |

---

## 11. Testes esperados

**Unitários (`tests/unit/domains/knowledge/`):**
- [ ] `deve criar documento com status READY e chunks corretos`
- [ ] `deve rejeitar layer AGENT sem agentId`
- [ ] `deve rejeitar agentId de outro tenant`
- [ ] `deve rejeitar conteúdo com menos de 50 chars`
- [ ] `deve reutilizar embedding quando hash do conteúdo já existe`
- [ ] `deve rejeitar quando limite de chunks for atingido`
- [ ] `deve deletar documento e seus chunks do vector store`
- [ ] `deve retornar FORBIDDEN para usuário sem permissão`
- [ ] `deve gerar número correto de chunks para texto longo`

**Unitários — SearchKnowledge:**
- [ ] `deve retornar apenas chunks do tenant correto`
- [ ] `deve filtrar chunks abaixo do threshold de similaridade`
- [ ] `deve respeitar o topK informado`
- [ ] `deve retornar chunks de layer AGENT apenas quando agentId correto`

**Integração (`tests/integration/`):**
- [ ] `tenant A não deve encontrar chunks de tenant B na busca`
- [ ] `contrato: POST /api/v1/knowledge retorna IngestDocumentOutput correto`

---

## 12. Critérios LGPD e privacidade

- **Dados coletados:** conteúdo do documento e chunks (dados do tenant, não dados pessoais de clientes finais)
- **Finalidade:** alimentar o RAG para melhoria das respostas do agente
- **Retenção:** enquanto o documento existir; excluído em cascata no `DeleteTenant`
- **Dados sensíveis:** conteúdo pode incluir dados de negócio confidenciais — acesso restrito ao tenant owner
- **KDL:** chunks da layer TENANT e AGENT **nunca** entram na KDL — são dados privados
- **Audit log:** toda ingestão, deleção e busca registradas com `tenantId` e `userId`

---

## 13. Critérios de isolamento multi-tenant

- `tenantId` presente em todo chunk armazenado no vector store
- Busca no vector store sempre inclui `WHERE tenant_id = $tenantId` na query SQL
- `IVectorRepository` recebe `tenantId` como parâmetro obrigatório em todos os métodos
- Layer INDUSTRY e GLOBAL: `tenantId = NULL` — separação por campo `layer`
- Testes de isolamento: busca de tenant A nunca retorna chunks de tenant B
- In-memory vector store para testes — não requer pgvector instalado
