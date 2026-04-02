-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "anoConstituicao" INTEGER,
ADD COLUMN     "areaConstruida" DECIMAL(65,30),
ADD COLUMN     "areaTerreno" DECIMAL(65,30),
ADD COLUMN     "bairroImovel" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "dataNascimento" TIMESTAMP(3),
ADD COLUMN     "email2" TEXT,
ADD COLUMN     "emailsJson" JSONB,
ADD COLUMN     "enderecoImovel" TEXT,
ADD COLUMN     "enriquecidoEm" TIMESTAMP(3),
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "estadoCivil" TEXT,
ADD COLUMN     "fonteEnriquecimento" TEXT,
ADD COLUMN     "idade" INTEGER,
ADD COLUMN     "motivoDesinteresse" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "perfilInvestidor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profissao" TEXT,
ADD COLUMN     "rendaEstimada" TEXT,
ADD COLUMN     "scoreAssertiva" INTEGER,
ADD COLUMN     "scoreQualificacao" INTEGER,
ADD COLUMN     "sexo" TEXT,
ADD COLUMN     "telefone2" TEXT,
ADD COLUMN     "telefone3" TEXT,
ADD COLUMN     "telefonesJson" JSONB,
ADD COLUMN     "temWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipoImovel" TEXT,
ADD COLUMN     "ultimaTentativa" TIMESTAMP(3),
ADD COLUMN     "valorVenal" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "contatos_campanhaId_cpf_idx" ON "contatos"("campanhaId", "cpf");

-- CreateIndex
CREATE INDEX "contatos_statusProspeccao_idx" ON "contatos"("statusProspeccao");
