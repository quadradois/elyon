-- Reasoning Bank por tenant (aprendizado incremental do agente)

CREATE TABLE IF NOT EXISTS "aprendizados_agente" (
    "id"           TEXT          NOT NULL,
    "tenantId"     TEXT          NOT NULL,
    "contexto"     TEXT          NOT NULL,
    "contextoHash" TEXT          NOT NULL,
    "acao"         TEXT          NOT NULL,
    "resultado"    TEXT          NOT NULL,
    "recompensa"   DOUBLE PRECISION NOT NULL,
    "metadados"    JSONB,
    "criadoEm"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprendizados_agente_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "aprendizados_agente"
    ADD CONSTRAINT "aprendizados_agente_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "aprendizados_agente_tenantId_idx"
    ON "aprendizados_agente" ("tenantId");

CREATE INDEX IF NOT EXISTS "aprendizados_agente_tenantId_contextoHash_idx"
    ON "aprendizados_agente" ("tenantId", "contextoHash");

CREATE INDEX IF NOT EXISTS "aprendizados_agente_tenantId_criadoEm_idx"
    ON "aprendizados_agente" ("tenantId", "criadoEm");

CREATE INDEX IF NOT EXISTS "aprendizados_agente_tenantId_contextoHash_acao_idx"
    ON "aprendizados_agente" ("tenantId", "contextoHash", "acao");

