-- AlterTable
ALTER TABLE "campanhas" ADD COLUMN     "briefingCompleto" TEXT,
ADD COLUMN     "briefingConfiabilidade" DECIMAL(65,30),
ADD COLUMN     "briefingEstruturado" JSONB,
ADD COLUMN     "briefingGeradoEm" TIMESTAMP(3),
ADD COLUMN     "localizacao" TEXT,
ADD COLUMN     "nomeEmpreendimento" TEXT,
ADD COLUMN     "perfilImovel" TEXT,
ADD COLUMN     "tipoImovel" TEXT;
