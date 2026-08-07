CREATE TABLE "geo360_lotes" (
    "cidade" TEXT NOT NULL,
    "id_lote" INTEGER NOT NULL,
    "nome_condominio" TEXT,
    "endereco_oficial" TEXT,
    "bairro" TEXT,
    "ocupacao" TEXT,
    "total_unidades" INTEGER NOT NULL DEFAULT 0,
    "area_terreno" DOUBLE PRECISION,
    "area_total_construida" DOUBLE PRECISION,
    "geometria_wkt" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "fonte_caracterizacao" TEXT NOT NULL DEFAULT 'PORTAL_INFO_LOTE',
    "raw_caracterizacao" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimo_erro" TEXT,
    "caracterizado_em" TIMESTAMPTZ,
    "unidades_sincronizadas_em" TIMESTAMPTZ,
    "midias_sincronizadas_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "geo360_lotes_pkey" PRIMARY KEY ("cidade", "id_lote")
);

ALTER TABLE "imoveis_rancho"
  ADD COLUMN "endereco_oficial_geo360" TEXT,
  ADD COLUMN "ocupacao_geo360" TEXT,
  ADD COLUMN "tipo_edificacao_geo360" TEXT,
  ADD COLUMN "area_construida_geo360" DOUBLE PRECISION;

CREATE TABLE "geo360_midias_lote" (
    "cidade" TEXT NOT NULL,
    "id_midia" BIGINT NOT NULL,
    "id_lote" INTEGER NOT NULL,
    "link" TEXT NOT NULL,
    "nome" TEXT,
    "principal" INTEGER NOT NULL DEFAULT 0,
    "situacao_foto" INTEGER,
    "data_panorama" DATE,
    "nome_camada" TEXT,
    "raw" JSONB,
    "sincronizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "geo360_midias_lote_pkey" PRIMARY KEY ("cidade", "id_midia"),
    CONSTRAINT "geo360_midias_lote_cidade_id_lote_fkey" FOREIGN KEY ("cidade", "id_lote")
      REFERENCES "geo360_lotes"("cidade", "id_lote") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "geo360_lotes_cidade_status_idx" ON "geo360_lotes"("cidade", "status");
CREATE INDEX "geo360_lotes_nome_condominio_idx" ON "geo360_lotes"("nome_condominio");
CREATE INDEX "geo360_lotes_bairro_idx" ON "geo360_lotes"("bairro");
CREATE INDEX "geo360_midias_lote_cidade_id_lote_principal_idx"
  ON "geo360_midias_lote"("cidade", "id_lote", "principal");
CREATE INDEX "imoveis_rancho_cidade_id_lote_idx" ON "imoveis_rancho"("cidade", "id_lote");
