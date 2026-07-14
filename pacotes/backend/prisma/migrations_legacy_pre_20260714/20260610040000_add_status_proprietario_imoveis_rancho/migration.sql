-- Colunas de classificação/enriquecimento de proprietário em imoveis_rancho (backfill Goiânia).
-- Idempotente: a tabela foi criada fora do Prisma (restore) e as colunas podem já existir.
ALTER TABLE "imoveis_rancho"
  ADD COLUMN IF NOT EXISTS "propriedad_mapa"     SMALLINT,
  ADD COLUMN IF NOT EXISTS "status_proprietario" VARCHAR,
  ADD COLUMN IF NOT EXISTS "fonte_proprietario"  VARCHAR,
  ADD COLUMN IF NOT EXISTS "enriquecido_em"      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "idx_imrancho_status_prop" ON "imoveis_rancho" ("status_proprietario");
