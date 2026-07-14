-- AlterTable
ALTER TABLE "campanhas" ADD COLUMN     "briefingValidado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editadoEm" TIMESTAMP(3),
ADD COLUMN     "editadoPor" TEXT,
ADD COLUMN     "validadoEm" TIMESTAMP(3),
ADD COLUMN     "validadoPor" TEXT;
