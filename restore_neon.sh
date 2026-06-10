#!/bin/bash
# Restore limpo para o Neon — limpa dados existentes e reinsere na ordem correta

NEON="postgresql://neondb_owner:npg_6eWhiRQCxNy3@ep-cool-recipe-aq2rv3mq.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
LOCAL="postgresql://crewomni:crewomni_dev@localhost:5434/crewomni_dev"

echo "==> Limpando dados do Neon (mantendo estrutura)..."
psql "$NEON" <<'SQL'
SET session_replication_role = replica;

TRUNCATE TABLE
  conversation_lifecycle_events,
  conversation_summaries,
  contact_channel_identities,
  contact_memories,
  messages,
  qualification_states,
  agent_execution_traces,
  inbound_events,
  crew_workflows,
  crew_members,
  conversations,
  knowledge_chunks,
  knowledge_documents,
  crews,
  departments,
  agent_prompt_versions,
  agents,
  agent_roles,
  api_keys,
  audit_logs,
  channel_configs,
  contacts,
  kdl_insights,
  refresh_tokens,
  tenant_settings,
  tenant_usage_current,
  tenant_usage_limits,
  users,
  tenants
CASCADE;

SET session_replication_role = DEFAULT;
SQL

echo "==> Exportando dados locais na ordem correta..."
pg_dump "$LOCAL" --data-only --no-owner --no-acl \
  --disable-triggers \
  -t tenants \
  -t users \
  -t agent_roles \
  -t departments \
  -t agents \
  -t agent_prompt_versions \
  -t api_keys \
  -t audit_logs \
  -t channel_configs \
  -t contacts \
  -t contact_channel_identities \
  -t contact_memories \
  -t conversations \
  -t conversation_lifecycle_events \
  -t conversation_summaries \
  -t crews \
  -t crew_members \
  -t crew_workflows \
  -t knowledge_documents \
  -t knowledge_chunks \
  -t messages \
  -t qualification_states \
  -t inbound_events \
  -t agent_execution_traces \
  -t kdl_insights \
  -t refresh_tokens \
  -t tenant_settings \
  -t tenant_usage_current \
  -t tenant_usage_limits \
  > data_ordered.sql

echo "==> Restaurando no Neon..."
psql "$NEON" < data_ordered.sql

echo "==> Concluído!"
