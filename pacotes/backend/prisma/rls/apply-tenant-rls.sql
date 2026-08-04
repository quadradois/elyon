-- Reaplicacao operacional completa do isolamento tenant apos rollback.
-- Executar como o usuario proprietario do schema, depois de todas as migrations.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elyon_tenant_access') THEN
    CREATE ROLE elyon_tenant_access NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO elyon_tenant_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.leads,
  public.campanhas,
  public.convites_especialista_agenda,
  public.interacoes_especialista_agenda,
  public.contrapropostas_agenda
TO elyon_tenant_access;
GRANT elyon_tenant_access TO CURRENT_USER;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites_especialista_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacoes_especialista_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrapropostas_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.leads;
CREATE POLICY elyon_tenant_isolation ON public.leads
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.campanhas;
CREATE POLICY elyon_tenant_isolation ON public.campanhas
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.convites_especialista_agenda;
CREATE POLICY elyon_tenant_isolation ON public.convites_especialista_agenda
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.interacoes_especialista_agenda;
CREATE POLICY elyon_tenant_isolation ON public.interacoes_especialista_agenda
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));

DROP POLICY IF EXISTS elyon_tenant_isolation ON public.contrapropostas_agenda;
CREATE POLICY elyon_tenant_isolation ON public.contrapropostas_agenda
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));
