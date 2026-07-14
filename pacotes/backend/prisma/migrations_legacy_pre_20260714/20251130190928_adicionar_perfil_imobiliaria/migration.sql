-- AlterTable
ALTER TABLE "configuracoes_agente" ADD COLUMN     "perfilImobiliaria" JSONB,
ADD COLUMN     "ragPerfilTexto" TEXT,
ALTER COLUMN "tipoAgente" SET DEFAULT 'SDR_CAPTACAO';
