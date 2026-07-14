/*
  Warnings:

  - The `rendaEstimada` column on the `contatos` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "cnpjEmpresa" TEXT,
ADD COLUMN     "empresaAtual" TEXT,
ADD COLUMN     "faixaSalarial" TEXT,
ADD COLUMN     "nomeMae" TEXT,
ADD COLUMN     "obitoProvavel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "participacoesEmpresas" JSONB,
ADD COLUMN     "ppe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redesSociais" JSONB,
ADD COLUMN     "setor" TEXT,
ADD COLUMN     "signo" TEXT,
ADD COLUMN     "situacaoCadastral" TEXT,
DROP COLUMN "rendaEstimada",
ADD COLUMN     "rendaEstimada" DECIMAL(65,30);
