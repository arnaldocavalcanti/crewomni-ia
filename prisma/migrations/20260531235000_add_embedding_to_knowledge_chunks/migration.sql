-- Adiciona coluna de embedding vetorial aos chunks de conhecimento
-- Requer extensão pgvector (já instalada via docker/init.sql)
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Índice HNSW para busca por similaridade coseno (performático para RAG)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
