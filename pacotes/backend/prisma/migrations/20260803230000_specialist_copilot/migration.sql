CREATE TABLE IF NOT EXISTS "convites_especialista_agenda" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "atividadeId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tentativa" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "tokenHash" TEXT,
  "solicitadoEm" TIMESTAMP(3) NOT NULL,
  "prazoEm" TIMESTAMP(3) NOT NULL,
  "respondidoEm" TIMESTAMP(3),
  "origemResposta" TEXT,
  "messageIdConvite" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "convites_especialista_agenda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "interacoes_especialista_agenda" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "atividadeId" TEXT,
  "usuarioId" TEXT NOT NULL,
  "conviteId" TEXT,
  "webhookEventoId" TEXT NOT NULL,
  "direcao" TEXT NOT NULL,
  "intencao" TEXT NOT NULL,
  "resumoSanitizado" TEXT,
  "parametros" JSONB,
  "resultado" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interacoes_especialista_agenda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "contrapropostas_agenda" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "atividadeId" TEXT NOT NULL,
  "conviteId" TEXT,
  "propostaPorTipo" TEXT NOT NULL,
  "propostaPorId" TEXT NOT NULL,
  "horarioProposto" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_LEAD',
  "respondidaEm" TIMESTAMP(3),
  "atividadeResultanteId" TEXT,
  "versaoAtividadeOrigem" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contrapropostas_agenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "convites_especialista_agenda_atividadeId_tentativa_key" ON "convites_especialista_agenda"("atividadeId", "tentativa");
CREATE UNIQUE INDEX IF NOT EXISTS "convites_especialista_agenda_tokenHash_key" ON "convites_especialista_agenda"("tokenHash");
CREATE INDEX IF NOT EXISTS "convites_especialista_contexto_idx" ON "convites_especialista_agenda"("tenantId", "usuarioId", "status", "prazoEm");
CREATE INDEX IF NOT EXISTS "convites_especialista_atividade_idx" ON "convites_especialista_agenda"("atividadeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "interacoes_especialista_agenda_webhookEventoId_key" ON "interacoes_especialista_agenda"("webhookEventoId");
CREATE INDEX IF NOT EXISTS "interacoes_especialista_contexto_idx" ON "interacoes_especialista_agenda"("tenantId", "usuarioId", "criadoEm");
CREATE INDEX IF NOT EXISTS "interacoes_especialista_atividade_idx" ON "interacoes_especialista_agenda"("atividadeId", "criadoEm");
CREATE INDEX IF NOT EXISTS "contrapropostas_agenda_atividade_idx" ON "contrapropostas_agenda"("tenantId", "atividadeId", "status");
CREATE INDEX IF NOT EXISTS "contrapropostas_agenda_autor_idx" ON "contrapropostas_agenda"("tenantId", "propostaPorId", "status");

ALTER TABLE "convites_especialista_agenda" ADD CONSTRAINT "convites_especialista_agenda_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites_especialista_agenda" ADD CONSTRAINT "convites_especialista_agenda_atividadeId_fkey"
  FOREIGN KEY ("atividadeId") REFERENCES "atividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites_especialista_agenda" ADD CONSTRAINT "convites_especialista_agenda_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "interacoes_especialista_agenda" ADD CONSTRAINT "interacoes_especialista_agenda_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interacoes_especialista_agenda" ADD CONSTRAINT "interacoes_especialista_agenda_atividadeId_fkey"
  FOREIGN KEY ("atividadeId") REFERENCES "atividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interacoes_especialista_agenda" ADD CONSTRAINT "interacoes_especialista_agenda_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interacoes_especialista_agenda" ADD CONSTRAINT "interacoes_especialista_agenda_conviteId_fkey"
  FOREIGN KEY ("conviteId") REFERENCES "convites_especialista_agenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contrapropostas_agenda" ADD CONSTRAINT "contrapropostas_agenda_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contrapropostas_agenda" ADD CONSTRAINT "contrapropostas_agenda_atividadeId_fkey"
  FOREIGN KEY ("atividadeId") REFERENCES "atividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contrapropostas_agenda" ADD CONSTRAINT "contrapropostas_agenda_conviteId_fkey"
  FOREIGN KEY ("conviteId") REFERENCES "convites_especialista_agenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contrapropostas_agenda" ADD CONSTRAINT "contrapropostas_agenda_atividadeResultanteId_fkey"
  FOREIGN KEY ("atividadeResultanteId") REFERENCES "atividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.convites_especialista_agenda TO elyon_tenant_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.interacoes_especialista_agenda TO elyon_tenant_access;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contrapropostas_agenda TO elyon_tenant_access;

ALTER TABLE public.convites_especialista_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacoes_especialista_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrapropostas_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY elyon_tenant_isolation ON public.convites_especialista_agenda
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY elyon_tenant_isolation ON public.interacoes_especialista_agenda
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY elyon_tenant_isolation ON public.contrapropostas_agenda
  FOR ALL TO elyon_tenant_access
  USING ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.tenant_id', true), ''));
