# ADR 003 — Estratégia de Embedding e Chunking

> **Status:** ACCEPTED
> **Data:** 2026-05-29
> **Contexto:** Fase 1 — definir como documentos são convertidos em vetores para o RAG

---

## Contexto

A plataforma precisa transformar documentos em chunks vetorizados para alimentar o RAG de cada agente. As decisões aqui afetam custo, qualidade das respostas e latência de busca.

---

## Decisões

### Modelo de embedding

**Escolha: `text-embedding-3-small` (OpenAI)**

| Modelo | Dims | Custo/1M tokens | Qualidade |
|---|---|---|---|
| text-embedding-3-small | 1536 | ~$0.02 | Boa para RAG |
| text-embedding-3-large | 3072 | ~$0.13 | Melhor, mas 6× mais caro |
| text-embedding-ada-002 | 1536 | ~$0.10 | Legado, evitar |

**Motivo:** custo-benefício adequado para MVP. Dimensão de 1536 é suficiente para chunks curtos de conhecimento de negócio. Troca de modelo não afeta o domínio — `IEmbeddingProvider` é uma interface.

### Estratégia de chunking

**Escolha: tamanho fixo com overlap + preservação de parágrafos**

```
Chunk size:    512 tokens
Overlap:       50 tokens
Min chunk:     50 tokens (descartado se menor)
Separadores:   \n\n (parágrafo) → \n (linha) → espaço
```

**Motivo:** chunking semântico requer LLM para segmentação — custo extra no ingest. Tamanho fixo com overlap é suficiente para documentos de knowledge base de negócio (FAQs, manuais, políticas).

### Vector store

**MVP: pgvector** (PostgreSQL extension)

**Motivo:** elimina dependência de serviço externo. Prisma não suporta nativamente o tipo `vector` — usaremos **SQL raw** para operações de vetor (insert e similarity search). CRUD de metadados via Prisma normal.

Migração para **Qdrant** na Fase 4, sem impacto no domínio graças à interface `IVectorRepository`.

### Estratégia de busca

**Escolha: cosine similarity com limite por layer**

```
SELECT id, content, metadata, 1 - (embedding <=> $query_vector) AS score
FROM knowledge_chunks
WHERE tenant_id = $tenant_id
  AND layer = $layer
ORDER BY embedding <=> $query_vector
LIMIT 3
```

- Top-3 chunks por layer (configurável)
- Threshold mínimo de similaridade: 0.7
- Layers consultadas em cascata: GLOBAL → INDUSTRY → TENANT → AGENT

### Metadados obrigatórios por chunk

```typescript
{
  tenantId: string | null    // null = GLOBAL ou INDUSTRY
  layer: KnowledgeLayer      // GLOBAL | INDUSTRY | TENANT | AGENT
  agentId: string | null     // só para layer AGENT
  niche: Niche | null        // só para layer INDUSTRY
  sourceType: 'TEXT' | 'FILE' | 'URL'
  sourceId: string           // ID do documento original
  chunkIndex: number         // posição no documento
}
```

---

## Consequências

- SQL raw para insert e search de vetores — encapsulado em `IVectorRepository`
- Prisma schema não declara o campo `embedding` (usa SQL raw) — migration manual para `CREATE EXTENSION vector` e `ALTER TABLE ... ADD COLUMN embedding vector(1536)`
- `IEmbeddingProvider` abstrai o modelo — troca sem impacto no domínio
- Cada layer tem sua própria collection/namespace para isolamento
- Cache de embeddings: se o mesmo texto já foi vetorizado, reutiliza (hash SHA-256 do conteúdo)

---

## Próximas decisões

- ADR 004 — Estrutura do prompt hierárquico (5 layers)
- ADR 005 — Pipeline da Knowledge Distillation Layer
