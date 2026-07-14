-- CreateTable
CREATE TABLE "auditorias_replay_aprendizado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUCESSO',
    "erro" TEXT,
    "periodoRecenteHoras" INTEGER NOT NULL DEFAULT 24,
    "janelaHistoricaDias" INTEGER NOT NULL DEFAULT 90,
    "amostraRecente" INTEGER NOT NULL DEFAULT 0,
    "amostraHistorica" INTEGER NOT NULL DEFAULT 0,
    "totalAmostras" INTEGER NOT NULL DEFAULT 0,
    "padroesAvaliados" INTEGER NOT NULL DEFAULT 0,
    "padroesAjustados" INTEGER NOT NULL DEFAULT 0,
    "taxaRecente" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxaHistorica" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ajusteTotalAbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ajusteMaxPorPadrao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteDerivaExecucaoAbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resumoOutcomes" JSONB,
    "ajustesAplicados" JSONB,
    "duracaoMs" INTEGER,

    CONSTRAINT "auditorias_replay_aprendizado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditorias_replay_aprendizado_tenantId_idx" ON "auditorias_replay_aprendizado"("tenantId");

-- CreateIndex
CREATE INDEX "auditorias_replay_aprendizado_tenantId_executadoEm_idx" ON "auditorias_replay_aprendizado"("tenantId", "executadoEm");

-- CreateIndex
CREATE INDEX "auditorias_replay_aprendizado_status_executadoEm_idx" ON "auditorias_replay_aprendizado"("status", "executadoEm");

-- AddForeignKey
ALTER TABLE "auditorias_replay_aprendizado" ADD CONSTRAINT "auditorias_replay_aprendizado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
