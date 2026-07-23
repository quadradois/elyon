CREATE TABLE "geo360_buscas_fallback" (
  "id" UUID NOT NULL,
  "termo_hash" TEXT NOT NULL,
  "termo_normalizado" TEXT NOT NULL,
  "resultados_legado" JSONB NOT NULL,
  "ocorrencias" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "primeiro_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvido_em" TIMESTAMPTZ(6),
  "observacao" TEXT,

  CONSTRAINT "geo360_buscas_fallback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "geo360_buscas_fallback_termo_hash_key"
  ON "geo360_buscas_fallback"("termo_hash");

CREATE INDEX "geo360_buscas_fallback_status_ultimo_em_idx"
  ON "geo360_buscas_fallback"("status", "ultimo_em");
