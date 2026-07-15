CREATE TABLE "lotes_mensagens_inbound" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABERTO',
  "fechaEm" TIMESTAMP(3) NOT NULL,
  "leaseAte" TIMESTAMP(3),
  "leaseOwner" TEXT,
  "fencingToken" INTEGER NOT NULL DEFAULT 0,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "ultimoErro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "processadoEm" TIMESTAMP(3),
  CONSTRAINT "lotes_mensagens_inbound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fragmentos_mensagens_inbound" (
  "id" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "webhookEventoId" TEXT NOT NULL,
  "messageId" TEXT,
  "conteudo" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
  "metadata" JSONB,
  "recebidoEm" TIMESTAMP(3) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fragmentos_mensagens_inbound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "efeitos_lotes_inbound" (
  "id" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVADO',
  "fencingToken" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluidoEm" TIMESTAMP(3),
  CONSTRAINT "efeitos_lotes_inbound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lotes_mensagens_inbound_tenantId_leadId_status_fechaEm_idx"
  ON "lotes_mensagens_inbound"("tenantId", "leadId", "status", "fechaEm");
CREATE INDEX "lotes_mensagens_inbound_status_fechaEm_leaseAte_idx"
  ON "lotes_mensagens_inbound"("status", "fechaEm", "leaseAte");
CREATE UNIQUE INDEX "fragmentos_mensagens_inbound_webhookEventoId_key"
  ON "fragmentos_mensagens_inbound"("webhookEventoId");
CREATE INDEX "fragmentos_mensagens_inbound_loteId_recebidoEm_id_idx"
  ON "fragmentos_mensagens_inbound"("loteId", "recebidoEm", "id");
CREATE UNIQUE INDEX "efeitos_lotes_inbound_loteId_tipo_key"
  ON "efeitos_lotes_inbound"("loteId", "tipo");
CREATE INDEX "efeitos_lotes_inbound_status_criadoEm_idx"
  ON "efeitos_lotes_inbound"("status", "criadoEm");

ALTER TABLE "lotes_mensagens_inbound"
  ADD CONSTRAINT "lotes_mensagens_inbound_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lotes_mensagens_inbound"
  ADD CONSTRAINT "lotes_mensagens_inbound_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fragmentos_mensagens_inbound"
  ADD CONSTRAINT "fragmentos_mensagens_inbound_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "lotes_mensagens_inbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "efeitos_lotes_inbound"
  ADD CONSTRAINT "efeitos_lotes_inbound_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "lotes_mensagens_inbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
