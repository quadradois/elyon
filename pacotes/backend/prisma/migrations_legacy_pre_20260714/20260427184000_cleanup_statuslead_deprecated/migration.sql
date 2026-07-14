-- T06: Migração de status deprecated de leads
-- Backup lógico / rollback manual (ajuste conforme necessidade):
-- UPDATE "leads" SET "status" = 'QUALIFICADO' WHERE "status" = 'NOVO';
-- UPDATE "leads" SET "status" = 'EM_NEGOCIACAO' WHERE "status" = 'DOCUMENTACAO';
-- UPDATE "leads" SET "status" = 'CONTATANDO' WHERE "status" = 'TENTATIVA_AGENDAMENTO';
-- UPDATE "leads" SET "status" = 'CONVERTIDO' WHERE "status" = 'CAPTADO';
-- UPDATE "leads" SET "status" = 'INATIVO' WHERE "status" = 'ARQUIVADO';

UPDATE "leads" SET "status" = 'NOVO' WHERE "status" = 'QUALIFICADO';
UPDATE "leads" SET "status" = 'DOCUMENTACAO' WHERE "status" = 'EM_NEGOCIACAO';
UPDATE "leads" SET "status" = 'TENTATIVA_AGENDAMENTO' WHERE "status" = 'CONTATANDO';
UPDATE "leads" SET "status" = 'CAPTADO' WHERE "status" = 'CONVERTIDO';
UPDATE "leads" SET "status" = 'ARQUIVADO' WHERE "status" = 'INATIVO';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusLead_new') THEN
    DROP TYPE "StatusLead_new";
  END IF;
END $$;

CREATE TYPE "StatusLead_new" AS ENUM (
  'NOVO',
  'TENTATIVA_AGENDAMENTO',
  'VISITA_AGENDADA',
  'AVALIACAO_EM_ANDAMENTO',
  'DOCUMENTACAO',
  'ONBOARDING',
  'CAPTADO',
  'PERDIDO',
  'ARQUIVADO'
);

ALTER TABLE "leads"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "StatusLead_new" USING ("status"::text::"StatusLead_new");

DROP TYPE "StatusLead";
ALTER TYPE "StatusLead_new" RENAME TO "StatusLead";

ALTER TABLE "leads"
  ALTER COLUMN "status" SET DEFAULT 'NOVO';
