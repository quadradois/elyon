-- Fase 1.2: trilha de confirmação operacional do corretor
CREATE TYPE "StatusConfirmacaoCorretor" AS ENUM ('PENDENTE', 'CONFIRMADO', 'EXPIRADO', 'REMANEJADO', 'RECUSADO');

ALTER TABLE "atividades"
  ADD COLUMN "statusConfirmacaoCorretor" "StatusConfirmacaoCorretor" DEFAULT 'PENDENTE',
  ADD COLUMN "tokenConfirmacaoCorretor" TEXT,
  ADD COLUMN "confirmacaoCorretorSolicitadaEm" TIMESTAMP(3),
  ADD COLUMN "confirmadoCorretorEm" TIMESTAMP(3),
  ADD COLUMN "expiradoCorretorEm" TIMESTAMP(3),
  ADD COLUMN "remanejadoCorretorEm" TIMESTAMP(3),
  ADD COLUMN "corretorOriginalId" TEXT,
  ADD COLUMN "corretorAtualId" TEXT;

CREATE UNIQUE INDEX "atividades_tokenConfirmacaoCorretor_key" ON "atividades"("tokenConfirmacaoCorretor");
CREATE INDEX "atividades_statusConfirmacaoCorretor_idx" ON "atividades"("statusConfirmacaoCorretor");
CREATE INDEX "atividades_tokenConfirmacaoCorretor_idx" ON "atividades"("tokenConfirmacaoCorretor");
CREATE INDEX "atividades_corretorOriginalId_idx" ON "atividades"("corretorOriginalId");
CREATE INDEX "atividades_corretorAtualId_idx" ON "atividades"("corretorAtualId");
