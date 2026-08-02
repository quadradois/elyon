ALTER TYPE "StatusAgendamento" ADD VALUE IF NOT EXISTS 'PROPOSTO';
ALTER TYPE "StatusAgendamento" ADD VALUE IF NOT EXISTS 'SOLICITADO';
ALTER TYPE "StatusAgendamento" ADD VALUE IF NOT EXISTS 'SUBSTITUIDO';

ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "timezoneIana" TEXT;
ALTER TABLE "comandos_agenda_ledger" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;
ALTER TABLE "efeitos_agenda_outbox" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;
ALTER TABLE "efeitos_agenda_outbox" ADD COLUMN IF NOT EXISTS "destinatarioTipo" TEXT NOT NULL DEFAULT 'LEAD';
ALTER TABLE "efeitos_agenda_outbox" ADD COLUMN IF NOT EXISTS "usuarioDestinoId" TEXT;
ALTER TABLE "efeitos_agenda_outbox" DROP CONSTRAINT IF EXISTS "efeitos_agenda_outbox_chaveComando_key";
DROP INDEX IF EXISTS "efeitos_agenda_outbox_chaveComando_key";

CREATE INDEX IF NOT EXISTS "atividades_lead_status_agendado_idx"
  ON "atividades"("leadId", "statusAgendamento", "agendadoPara");
CREATE INDEX IF NOT EXISTS "comandos_agenda_correlation_idx"
  ON "comandos_agenda_ledger"("correlationId", "criadoEm");
CREATE INDEX IF NOT EXISTS "efeitos_agenda_correlation_idx"
  ON "efeitos_agenda_outbox"("correlationId", "criadoEm");
CREATE INDEX IF NOT EXISTS "efeitos_agenda_command_idx"
  ON "efeitos_agenda_outbox"("chaveComando", "criadoEm");
CREATE INDEX IF NOT EXISTS "efeitos_agenda_user_destination_idx"
  ON "efeitos_agenda_outbox"("usuarioDestinoId", "criadoEm");
