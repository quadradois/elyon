-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('PENDENTE', 'PROCESSANDO', 'SUCESSO', 'ERRO');

-- CreateTable
CREATE TABLE "documentos_agente" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "nomeStorage" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "textoExtraido" TEXT,
    "totalCaracteres" INTEGER,
    "status" "StatusDocumento" NOT NULL DEFAULT 'PENDENTE',
    "erroProcessamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "documentos_agente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_agente_agenteId_idx" ON "documentos_agente"("agenteId");

-- AddForeignKey
ALTER TABLE "documentos_agente" ADD CONSTRAINT "documentos_agente_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "configuracoes_agente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
