-- CreateTable
CREATE TABLE "conversas_embeddings" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT,
    "leadId" TEXT,
    "tenantId" TEXT NOT NULL,
    "textoOriginal" TEXT NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "metadados" JSONB,
    "embedding" TEXT NOT NULL,
    "embeddingModelo" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "scoreQualidade" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vezesUtilizado" INTEGER NOT NULL DEFAULT 0,
    "feedbackPositivo" INTEGER NOT NULL DEFAULT 0,
    "feedbackNegativo" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversas_embeddings_tenantId_idx" ON "conversas_embeddings"("tenantId");

-- CreateIndex
CREATE INDEX "conversas_embeddings_tipoConteudo_idx" ON "conversas_embeddings"("tipoConteudo");

-- CreateIndex
CREATE INDEX "conversas_embeddings_conversaId_idx" ON "conversas_embeddings"("conversaId");

-- CreateIndex
CREATE INDEX "conversas_embeddings_leadId_idx" ON "conversas_embeddings"("leadId");
