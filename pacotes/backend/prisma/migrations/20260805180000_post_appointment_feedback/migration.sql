CREATE TABLE "feedbacks_pos_atendimento_agenda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "atividadeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "versaoAtividade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_ENVIO',
    "elegivelEm" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "lembreteEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),
    "respondidoEm" TIMESTAMP(3),
    "desfecho" TEXT,
    "resumoSanitizado" TEXT,
    "sugestoes" JSONB,
    "providerMessageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feedbacks_pos_atendimento_agenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feedbacks_pos_atendimento_agenda_atividadeId_key"
ON "feedbacks_pos_atendimento_agenda"("atividadeId");

CREATE INDEX "feedback_pos_atendimento_elegibilidade_idx"
ON "feedbacks_pos_atendimento_agenda"("status", "elegivelEm");

CREATE INDEX "feedback_pos_atendimento_contexto_idx"
ON "feedbacks_pos_atendimento_agenda"("tenantId", "usuarioId", "status", "expiraEm");

ALTER TABLE "feedbacks_pos_atendimento_agenda"
ADD CONSTRAINT "feedbacks_pos_atendimento_agenda_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedbacks_pos_atendimento_agenda"
ADD CONSTRAINT "feedbacks_pos_atendimento_agenda_atividadeId_fkey"
FOREIGN KEY ("atividadeId") REFERENCES "atividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedbacks_pos_atendimento_agenda"
ADD CONSTRAINT "feedbacks_pos_atendimento_agenda_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
