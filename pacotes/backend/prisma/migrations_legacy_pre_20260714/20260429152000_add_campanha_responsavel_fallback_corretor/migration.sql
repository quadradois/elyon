-- Fase 1.1: responsável/fallback por campanha
ALTER TABLE "campanhas"
  ADD COLUMN "responsavelCorretorId" TEXT,
  ADD COLUMN "fallbackCorretorId" TEXT;

CREATE INDEX "campanhas_responsavelCorretorId_idx" ON "campanhas"("responsavelCorretorId");
CREATE INDEX "campanhas_fallbackCorretorId_idx" ON "campanhas"("fallbackCorretorId");

ALTER TABLE "campanhas"
  ADD CONSTRAINT "campanhas_responsavelCorretorId_fkey"
  FOREIGN KEY ("responsavelCorretorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "campanhas"
  ADD CONSTRAINT "campanhas_fallbackCorretorId_fkey"
  FOREIGN KEY ("fallbackCorretorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
