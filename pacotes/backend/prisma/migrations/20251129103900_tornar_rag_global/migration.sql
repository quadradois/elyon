/*
  Warnings:

  - A unique constraint covering the columns `[nome,localizacao]` on the table `empreendimentos_conhecimento` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "empreendimentos_conhecimento" DROP CONSTRAINT "empreendimentos_conhecimento_tenantId_fkey";

-- DropIndex
DROP INDEX "empreendimentos_conhecimento_nome_localizacao_tenantId_key";

-- DropIndex
DROP INDEX "empreendimentos_conhecimento_tenantId_cep_idx";

-- DropIndex
DROP INDEX "empreendimentos_conhecimento_tenantId_nome_idx";

-- DropIndex
DROP INDEX "empreendimentos_conhecimento_tenantId_validado_idx";

-- AlterTable
ALTER TABLE "empreendimentos_conhecimento" ALTER COLUMN "tenantId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_nome_idx" ON "empreendimentos_conhecimento"("nome");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_cep_idx" ON "empreendimentos_conhecimento"("cep");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_validado_idx" ON "empreendimentos_conhecimento"("validado");

-- CreateIndex
CREATE UNIQUE INDEX "empreendimentos_conhecimento_nome_localizacao_key" ON "empreendimentos_conhecimento"("nome", "localizacao");

-- AddForeignKey
ALTER TABLE "empreendimentos_conhecimento" ADD CONSTRAINT "empreendimentos_conhecimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
