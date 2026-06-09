-- Habilitar RLS em todas as tabelas com tenantId
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_prompt_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crew_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qualification_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_usage_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_usage_current" ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para bypassar o RLS se a setting for vazia (ex: conexões do superadmin)
-- O Prisma permite fazer SET LOCAL "app.current_tenant_id" = 'uuid';
-- As políticas abaixo forçam a igualdade ao current_tenant_id, a menos que ele não esteja setado ou o tenantId seja nulo.

CREATE OR REPLACE FUNCTION is_tenant_authorized(table_tenant_id text)
RETURNS boolean AS $$
DECLARE
  current_tenant text := current_setting('app.current_tenant_id', true);
BEGIN
  IF current_tenant IS NULL OR current_tenant = '' THEN
    RETURN true;
  END IF;
  
  IF table_tenant_id IS NULL THEN
    RETURN true;
  END IF;

  RETURN table_tenant_id = current_tenant;
END;
$$ LANGUAGE plpgsql STABLE;

-- Criar políticas
CREATE POLICY tenant_isolation_policy ON "users" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "refresh_tokens" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "api_keys" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "agents" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "agent_roles" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "agent_prompt_versions" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "knowledge_documents" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "knowledge_chunks" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "conversations" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "messages" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "departments" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "crews" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "crew_members" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "qualification_states" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "audit_logs" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "tenant_usage_limits" FOR ALL USING (is_tenant_authorized("tenantId"));
CREATE POLICY tenant_isolation_policy ON "tenant_usage_current" FOR ALL USING (is_tenant_authorized("tenantId"));

-- Para a tabela Tenants, o bypass é feito se a setting for vazia ou forçando o id = current_tenant
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "tenants" FOR ALL USING (
  current_setting('app.current_tenant_id', true) IS NULL 
  OR current_setting('app.current_tenant_id', true) = '' 
  OR id = current_setting('app.current_tenant_id', true)
);
