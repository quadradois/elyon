-- CreateEnum
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'AUDIO', 'IMAGEM', 'DOCUMENTO');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "campanhaOrigemId" TEXT,
ADD COLUMN     "ultimaInteracao" TIMESTAMP(3),
ALTER COLUMN "cpf" DROP NOT NULL;

-- AlterTable
ALTER TABLE "mensagens_conversa" ADD COLUMN     "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO',
ADD COLUMN     "urlMidia" TEXT;

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'MINERACAO',
    "parametrosBusca" JSONB,
    "totalContatos" INTEGER NOT NULL DEFAULT 0,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "cpf" TEXT,
    "inscricaoIptu" TEXT,
    "endereco" TEXT,
    "statusProspeccao" TEXT NOT NULL DEFAULT 'AGUARDANDO',
    "tentativasContato" INTEGER NOT NULL DEFAULT 0,
    "respondeu" BOOLEAN NOT NULL DEFAULT false,
    "primeiraResposta" TIMESTAMP(3),
    "manifestouInteresse" BOOLEAN NOT NULL DEFAULT false,
    "virouLead" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "virouLeadEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campanhas_tenantId_status_idx" ON "campanhas"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_leadId_key" ON "contatos"("leadId");

-- CreateIndex
CREATE INDEX "contatos_campanhaId_idx" ON "contatos"("campanhaId");

-- CreateIndex
CREATE INDEX "contatos_virouLead_idx" ON "contatos"("virouLead");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_campanhaId_telefone_key" ON "contatos"("campanhaId", "telefone");

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campanhaOrigemId_fkey" FOREIGN KEY ("campanhaOrigemId") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
