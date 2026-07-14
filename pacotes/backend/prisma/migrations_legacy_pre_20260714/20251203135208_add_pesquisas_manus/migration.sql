-- CreateTable
CREATE TABLE "pesquisas_manus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomeEmpreendimento" TEXT NOT NULL,
    "construtora" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT,
    "taskId" TEXT NOT NULL,
    "taskUrl" TEXT,
    "shareUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "resultado" TEXT,
    "resultadoJson" JSONB,
    "creditosUsados" INTEGER,
    "campanhaId" TEXT,
    "empreendimentoId" TEXT,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "pesquisas_manus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pesquisas_manus_taskId_key" ON "pesquisas_manus"("taskId");

-- CreateIndex
CREATE INDEX "pesquisas_manus_tenantId_status_idx" ON "pesquisas_manus"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pesquisas_manus_taskId_idx" ON "pesquisas_manus"("taskId");

-- CreateIndex
CREATE INDEX "pesquisas_manus_campanhaId_idx" ON "pesquisas_manus"("campanhaId");

-- AddForeignKey
ALTER TABLE "pesquisas_manus" ADD CONSTRAINT "pesquisas_manus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisas_manus" ADD CONSTRAINT "pesquisas_manus_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisas_manus" ADD CONSTRAINT "pesquisas_manus_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
