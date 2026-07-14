/*
  Warnings:

  - You are about to drop the column `sessaoId` on the `conversas` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `conversas` table. All the data in the column will be lost.
  - You are about to drop the `mensagens_conversa` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `numeroOrigem` to the `conversas` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `canal` on the `conversas` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `contexto` on table `conversas` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "mensagens_conversa" DROP CONSTRAINT "mensagens_conversa_conversaId_fkey";

-- DropIndex
DROP INDEX "conversas_sessaoId_idx";

-- DropIndex
DROP INDEX "conversas_sessaoId_key";

-- AlterTable
ALTER TABLE "campanhas" ADD COLUMN     "empreendimentoId" TEXT;

-- AlterTable
ALTER TABLE "conversas" DROP COLUMN "sessaoId",
DROP COLUMN "status",
ADD COLUMN     "estadoConversa" TEXT NOT NULL DEFAULT 'ativa',
ADD COLUMN     "numeroOrigem" TEXT NOT NULL,
ADD COLUMN     "ultimaMensagemEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "canal",
ADD COLUMN     "canal" TEXT NOT NULL,
ALTER COLUMN "contexto" SET NOT NULL;

-- DropTable
DROP TABLE "mensagens_conversa";

-- DropEnum
DROP TYPE "CanalConversa";

-- DropEnum
DROP TYPE "PapelMensagem";

-- DropEnum
DROP TYPE "StatusConversa";

-- DropEnum
DROP TYPE "TipoMensagem";

-- CreateTable
CREATE TABLE "empreendimentos_conhecimento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "cep" TEXT,
    "tipo" TEXT NOT NULL,
    "briefingCompleto" TEXT NOT NULL,
    "briefingEstruturado" JSONB NOT NULL,
    "confiabilidade" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "embedding" TEXT,
    "embeddingModelo" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "embeddingGeradoEm" TIMESTAMP(3),
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "validadoPor" TEXT,
    "validadoEm" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vezesReutilizado" INTEGER NOT NULL DEFAULT 0,
    "ultimoUso" TIMESTAMP(3),
    "totalCampanhasVinculadas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empreendimentos_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'texto',
    "metadata" JSONB,
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_tenantId_nome_idx" ON "empreendimentos_conhecimento"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_tenantId_cep_idx" ON "empreendimentos_conhecimento"("tenantId", "cep");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_tenantId_validado_idx" ON "empreendimentos_conhecimento"("tenantId", "validado");

-- CreateIndex
CREATE UNIQUE INDEX "empreendimentos_conhecimento_nome_localizacao_tenantId_key" ON "empreendimentos_conhecimento"("nome", "localizacao", "tenantId");

-- CreateIndex
CREATE INDEX "mensagens_conversaId_idx" ON "mensagens"("conversaId");

-- CreateIndex
CREATE INDEX "mensagens_enviadaEm_idx" ON "mensagens"("enviadaEm");

-- CreateIndex
CREATE INDEX "campanhas_empreendimentoId_idx" ON "campanhas"("empreendimentoId");

-- CreateIndex
CREATE INDEX "conversas_numeroOrigem_idx" ON "conversas"("numeroOrigem");

-- CreateIndex
CREATE INDEX "conversas_estadoConversa_idx" ON "conversas"("estadoConversa");

-- AddForeignKey
ALTER TABLE "empreendimentos_conhecimento" ADD CONSTRAINT "empreendimentos_conhecimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
