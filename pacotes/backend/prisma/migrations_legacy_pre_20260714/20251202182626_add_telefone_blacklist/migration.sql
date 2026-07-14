-- CreateTable
CREATE TABLE "telefones_blacklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "telefone" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "nomeContato" TEXT,
    "campanhaOrigem" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telefones_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telefones_blacklist_telefone_idx" ON "telefones_blacklist"("telefone");

-- CreateIndex
CREATE INDEX "telefones_blacklist_tenantId_idx" ON "telefones_blacklist"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "telefones_blacklist_tenantId_telefone_key" ON "telefones_blacklist"("tenantId", "telefone");

-- AddForeignKey
ALTER TABLE "telefones_blacklist" ADD CONSTRAINT "telefones_blacklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
