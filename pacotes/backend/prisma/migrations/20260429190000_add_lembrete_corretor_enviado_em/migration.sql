ALTER TABLE "atividades"
  ADD COLUMN IF NOT EXISTS "lembreteCorretorEnviadoEm" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "atividades_lembreteCorretorEnviadoEm_idx"
  ON "atividades"("lembreteCorretorEnviadoEm");
