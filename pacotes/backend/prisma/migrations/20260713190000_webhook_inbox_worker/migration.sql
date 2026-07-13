ALTER TABLE "webhook_eventos"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxTentativas" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "leaseAte" TIMESTAMP(3),
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "ultimoErro" TEXT,
  ADD COLUMN "replayCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ultimoReplayEm" TIMESTAMP(3),
  ADD COLUMN "ultimoReplayPor" TEXT,
  ADD COLUMN "ultimoReplayMotivo" TEXT,
  ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "webhook_eventos"
SET
  "status" = CASE
    WHEN "status" = 'PROCESSADO' THEN 'CONCLUIDO'
    ELSE 'MORTO'
  END,
  "ultimoErro" = CASE
    WHEN "status" = 'PROCESSADO' THEN NULL
    ELSE 'Evento legado sem payload persistido; replay automatico bloqueado.'
  END;

ALTER TABLE "webhook_eventos" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';

DROP INDEX IF EXISTS "webhook_eventos_status_recebidoEm_idx";
CREATE INDEX "webhook_eventos_status_proximaTentativaEm_idx"
  ON "webhook_eventos"("status", "proximaTentativaEm");
CREATE INDEX "webhook_eventos_status_leaseAte_idx"
  ON "webhook_eventos"("status", "leaseAte");
