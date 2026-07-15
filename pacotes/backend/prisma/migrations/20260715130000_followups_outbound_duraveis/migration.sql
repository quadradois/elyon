CREATE TABLE "followups_outbound" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
  "agendadoParaUtc" TIMESTAMP(3) NOT NULL, "timezoneIana" TEXT NOT NULL,
  "expressaoOriginal" TEXT NOT NULL, "motivo" TEXT NOT NULL, "motivoNormalizado" TEXT NOT NULL,
  "mensagemEnvio" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0, "proximoRetryEm" TIMESTAMP(3),
  "leaseOwner" TEXT, "leaseAte" TIMESTAMP(3), "fencingToken" INTEGER NOT NULL DEFAULT 0,
  "chaveEquivalencia" TEXT NOT NULL, "origemPedido" TEXT NOT NULL, "evidenciaPedido" TEXT NOT NULL,
  "reasonCode" TEXT, "ultimoErro" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL, "executadoEm" TIMESTAMP(3), "canceladoEm" TIMESTAMP(3),
  CONSTRAINT "followups_outbound_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "followups_outbound_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "followups_outbound_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "followups_outbound_chaveEquivalencia_idx" ON "followups_outbound"("chaveEquivalencia");
CREATE UNIQUE INDEX "followups_outbound_equivalencia_ativa_key" ON "followups_outbound"("chaveEquivalencia")
  WHERE "status" IN ('PENDENTE', 'REIVINDICADO')
     OR ("status" = 'FALHO' AND ("proximoRetryEm" IS NOT NULL OR "reasonCode" IN ('DELIVERY_UNKNOWN', 'DELIVERY_RECONCILIATION_REQUIRED')));
CREATE INDEX "followups_outbound_tenantId_leadId_status_agendadoParaUtc_idx" ON "followups_outbound"("tenantId", "leadId", "status", "agendadoParaUtc");
CREATE INDEX "followups_outbound_claim_idx" ON "followups_outbound"("status", "agendadoParaUtc", "proximoRetryEm", "leaseAte");

CREATE TABLE "requisicoes_followups_outbound" (
  "id" TEXT NOT NULL, "chaveRequisicao" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "operacao" TEXT NOT NULL, "followupId" TEXT NOT NULL, "outcome" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "ultimoReplayEm" TIMESTAMP(3),
  CONSTRAINT "requisicoes_followups_outbound_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "requisicoes_followups_outbound_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "followups_outbound"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "requisicoes_followups_outbound_chaveRequisicao_key" ON "requisicoes_followups_outbound"("chaveRequisicao");
CREATE INDEX "requisicoes_followups_outbound_followupId_criadoEm_idx" ON "requisicoes_followups_outbound"("followupId", "criadoEm");

CREATE TABLE "efeitos_followups_outbound" (
  "id" TEXT NOT NULL, "followupId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RESERVADO',
  "fencingToken" INTEGER NOT NULL, "chaveIdempotencia" TEXT NOT NULL, "resultado" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "concluidoEm" TIMESTAMP(3), CONSTRAINT "efeitos_followups_outbound_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "efeitos_followups_outbound_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "followups_outbound"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "efeitos_followups_outbound_followupId_key" ON "efeitos_followups_outbound"("followupId");
CREATE UNIQUE INDEX "efeitos_followups_outbound_chaveIdempotencia_key" ON "efeitos_followups_outbound"("chaveIdempotencia");
CREATE INDEX "efeitos_followups_outbound_status_criadoEm_idx" ON "efeitos_followups_outbound"("status", "criadoEm");
