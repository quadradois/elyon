CREATE TABLE "sincronizacoes_mapa" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "duracaoMs" INTEGER,
    "totalBairros" INTEGER NOT NULL DEFAULT 0,
    "totalEdificios" INTEGER NOT NULL DEFAULT 0,
    "totalUnidades" INTEGER NOT NULL DEFAULT 0,
    "mensagem" TEXT,
    "detalhesErro" JSONB,

    CONSTRAINT "sincronizacoes_mapa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sincronizacoes_mapa_status_idx" ON "sincronizacoes_mapa"("status");
CREATE INDEX "sincronizacoes_mapa_iniciadoEm_idx" ON "sincronizacoes_mapa"("iniciadoEm");
