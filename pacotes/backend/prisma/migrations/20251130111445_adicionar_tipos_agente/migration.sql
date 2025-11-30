-- CreateEnum
CREATE TYPE "TipoAgente" AS ENUM ('SDR_VENDAS', 'SDR_LOCACAO', 'SDR_CAPTACAO', 'DOCUMENTOS', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "ModoCriacao" AS ENUM ('PRE_TREINADO', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "StatusAgente" AS ENUM ('RASCUNHO', 'ATIVO', 'PAUSADO');

-- AlterTable
ALTER TABLE "configuracoes_agente" ADD COLUMN     "genero" TEXT NOT NULL DEFAULT 'feminino',
ADD COLUMN     "modoCreacao" "ModoCriacao" NOT NULL DEFAULT 'PRE_TREINADO',
ADD COLUMN     "promptCustomizado" TEXT,
ADD COLUMN     "status" "StatusAgente" NOT NULL DEFAULT 'RASCUNHO',
ADD COLUMN     "templateBase" TEXT,
ADD COLUMN     "termosAceitos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termosAceitosEm" TIMESTAMP(3),
ADD COLUMN     "termosVersao" TEXT,
ADD COLUMN     "tipoAgente" "TipoAgente" NOT NULL DEFAULT 'SDR_VENDAS',
ADD COLUMN     "toolsCustomizadas" JSONB,
ALTER COLUMN "estaAtivo" SET DEFAULT false;
