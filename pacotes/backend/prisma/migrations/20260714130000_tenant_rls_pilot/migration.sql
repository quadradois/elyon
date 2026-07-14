-- Piloto expand/contract de isolamento por tenant.
-- A role dedicada ativa RLS apenas dentro de transacoes que fazem SET LOCAL ROLE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elyon_tenant_access') THEN
    CREATE ROLE elyon_tenant_access NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO elyon_tenant_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO elyon_tenant_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campanhas TO elyon_tenant_access;
GRANT elyon_tenant_access TO CURRENT_USER;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.leads;
CREATE POLICY elyon_tenant_isolation
  ON public.leads
  FOR ALL
  TO elyon_tenant_access
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
  );

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.campanhas;
CREATE POLICY elyon_tenant_isolation
  ON public.campanhas
  FOR ALL
  TO elyon_tenant_access
  USING (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.tenant_id', true), '')
  );

COMMENT ON POLICY elyon_tenant_isolation ON public.leads IS
  'ELYON GAP-11 pilot: tenant context from transaction-local app.tenant_id';
COMMENT ON POLICY elyon_tenant_isolation ON public.campanhas IS
  'ELYON GAP-11 pilot: tenant context from transaction-local app.tenant_id';
