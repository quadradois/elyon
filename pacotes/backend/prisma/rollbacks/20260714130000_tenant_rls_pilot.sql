-- Rollback operacional do piloto RLS. Executar como o usuario proprietario do schema.
DROP POLICY IF EXISTS elyon_tenant_isolation ON public.leads;
DROP POLICY IF EXISTS elyon_tenant_isolation ON public.campanhas;
DROP POLICY IF EXISTS elyon_tenant_isolation ON public.convites_especialista_agenda;
DROP POLICY IF EXISTS elyon_tenant_isolation ON public.interacoes_especialista_agenda;
DROP POLICY IF EXISTS elyon_tenant_isolation ON public.contrapropostas_agenda;

ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites_especialista_agenda DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacoes_especialista_agenda DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrapropostas_agenda DISABLE ROW LEVEL SECURITY;

REVOKE elyon_tenant_access FROM CURRENT_USER;
REVOKE ALL PRIVILEGES ON TABLE public.leads FROM elyon_tenant_access;
REVOKE ALL PRIVILEGES ON TABLE public.campanhas FROM elyon_tenant_access;
REVOKE ALL PRIVILEGES ON TABLE public.convites_especialista_agenda FROM elyon_tenant_access;
REVOKE ALL PRIVILEGES ON TABLE public.interacoes_especialista_agenda FROM elyon_tenant_access;
REVOKE ALL PRIVILEGES ON TABLE public.contrapropostas_agenda FROM elyon_tenant_access;
REVOKE USAGE ON SCHEMA public FROM elyon_tenant_access;

DROP ROLE IF EXISTS elyon_tenant_access;
