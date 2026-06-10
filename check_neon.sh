#!/bin/bash
NEON="postgresql://neondb_owner:npg_6eWhiRQCxNy3@ep-cool-recipe-aq2rv3mq.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"

psql "$NEON" <<'SQL'
SELECT 'tenants' as tabela, count(*) FROM tenants
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'agents', count(*) FROM agents
UNION ALL SELECT 'departments', count(*) FROM departments
UNION ALL SELECT 'crews', count(*) FROM crews
UNION ALL SELECT 'crew_members', count(*) FROM crew_members
UNION ALL SELECT 'knowledge_documents', count(*) FROM knowledge_documents
UNION ALL SELECT 'knowledge_chunks', count(*) FROM knowledge_chunks
UNION ALL SELECT 'channel_configs', count(*) FROM channel_configs
ORDER BY tabela;
SQL
