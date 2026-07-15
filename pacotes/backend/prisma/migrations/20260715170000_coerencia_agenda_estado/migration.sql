ALTER TABLE "atividades"
  ADD COLUMN IF NOT EXISTS "versao" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "substituidaPorId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "atividades_substituidaPorId_key"
  ON "atividades"("substituidaPorId");
CREATE INDEX IF NOT EXISTS "atividades_leadId_versao_idx"
  ON "atividades"("leadId", "versao");

CREATE TABLE IF NOT EXISTS "milestones_agenda" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "atividadeId" TEXT NOT NULL,
  "atividadeSubstitutaId" TEXT,
  "tipo" TEXT NOT NULL,
  "ator" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "parteAusente" TEXT,
  "ocorridoEm" TIMESTAMP(3) NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "milestones_agenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "milestones_agenda_chaveIdempotencia_key"
  ON "milestones_agenda"("chaveIdempotencia");
CREATE INDEX IF NOT EXISTS "milestones_agenda_tenantId_leadId_ocorridoEm_idx"
  ON "milestones_agenda"("tenantId", "leadId", "ocorridoEm");
CREATE INDEX IF NOT EXISTS "milestones_agenda_atividadeId_ocorridoEm_idx"
  ON "milestones_agenda"("atividadeId", "ocorridoEm");

CREATE TABLE IF NOT EXISTS "comandos_agenda_ledger" (
  "id" TEXT NOT NULL,
  "chaveRequisicao" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "operacao" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "atividadeId" TEXT NOT NULL,
  "atividadeResultanteId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "ultimoReplayEm" TIMESTAMP(3),
  CONSTRAINT "comandos_agenda_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "comandos_agenda_ledger_chaveRequisicao_key"
  ON "comandos_agenda_ledger"("chaveRequisicao");
CREATE INDEX IF NOT EXISTS "comandos_agenda_ledger_tenantId_leadId_criadoEm_idx"
  ON "comandos_agenda_ledger"("tenantId", "leadId", "criadoEm");
CREATE INDEX IF NOT EXISTS "comandos_agenda_ledger_atividadeResultanteId_criadoEm_idx"
  ON "comandos_agenda_ledger"("atividadeResultanteId", "criadoEm");
