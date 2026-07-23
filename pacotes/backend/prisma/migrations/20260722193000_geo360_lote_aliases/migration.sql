CREATE TABLE "geo360_lote_aliases" (
    "cidade" TEXT NOT NULL,
    "id_lote" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'COMERCIAL',
    "construtora" TEXT,
    "fonte_url" TEXT,
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "validado_em" TIMESTAMPTZ(6),
    "observacao" TEXT,
    "metadados" JSONB,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo360_lote_aliases_pkey" PRIMARY KEY ("cidade", "id_lote", "nome"),
    CONSTRAINT "geo360_lote_aliases_lote_fkey"
      FOREIGN KEY ("cidade", "id_lote")
      REFERENCES "geo360_lotes"("cidade", "id_lote")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "geo360_lote_aliases_nome_idx"
  ON "geo360_lote_aliases"("nome");

CREATE INDEX "geo360_lote_aliases_cidade_id_lote_validado_idx"
  ON "geo360_lote_aliases"("cidade", "id_lote", "validado");
