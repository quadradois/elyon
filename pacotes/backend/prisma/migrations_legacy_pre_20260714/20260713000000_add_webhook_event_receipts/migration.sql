CREATE TABLE "webhook_eventos" (
    "id" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEBIDO',
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "webhook_eventos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_eventos_provedor_eventoId_key"
    ON "webhook_eventos"("provedor", "eventoId");

CREATE INDEX "webhook_eventos_provedor_recebidoEm_idx"
    ON "webhook_eventos"("provedor", "recebidoEm");

CREATE INDEX "webhook_eventos_status_recebidoEm_idx"
    ON "webhook_eventos"("status", "recebidoEm");
