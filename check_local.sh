#!/bin/bash
LOCAL="postgresql://crewomni:crewomni_dev@localhost:5434/crewomni_dev"

psql "$LOCAL" <<'SQL'
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
