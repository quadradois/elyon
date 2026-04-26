-- CreateTable
CREATE TABLE "paol_politicas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contextoHash" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "emaRecompensa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emaSucesso" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amostra" INTEGER NOT NULL DEFAULT 0,
    "ultimaRecompensa" DOUBLE PRECISION,
    "ultimoOutcome" TEXT,
    "ultimaOrigem" TEXT,
    "ultimoFallback" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paol_politicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paol_politicas_tenantId_contextoHash_acao_key" ON "paol_politicas"("tenantId", "contextoHash", "acao");

-- CreateIndex
CREATE INDEX "paol_politicas_tenantId_contextoHash_idx" ON "paol_politicas"("tenantId", "contextoHash");

-- CreateIndex
CREATE INDEX "paol_politicas_tenantId_atualizadoEm_idx" ON "paol_politicas"("tenantId", "atualizadoEm");

-- AddForeignKey
ALTER TABLE "paol_politicas" ADD CONSTRAINT "paol_politicas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
