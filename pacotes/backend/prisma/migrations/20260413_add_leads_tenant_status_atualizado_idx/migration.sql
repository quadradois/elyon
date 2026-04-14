-- Índice composto para consultas de governança e funil por tenant/status/período
CREATE INDEX IF NOT EXISTS "leads_tenantId_status_atualizadoEm_idx"
ON "leads"("tenantId", "status", "atualizadoEm");
