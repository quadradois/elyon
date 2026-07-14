-- Criação da tabela de auditoria de ações do sistema
-- Registra LOGIN, criação de campanha, mineração, etc.

CREATE TABLE IF NOT EXISTS "logs_auditoria" (
    "id"          TEXT          NOT NULL,
    "tenantId"    TEXT          NOT NULL,
    "usuarioId"   TEXT,
    "acao"        TEXT          NOT NULL,
    "entidade"    TEXT,
    "entidadeId"  TEXT,
    "detalhes"    JSONB,
    "ip"          TEXT,
    "criadoEm"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "logs_auditoria"
    ADD CONSTRAINT "logs_auditoria_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "logs_auditoria"
    ADD CONSTRAINT "logs_auditoria_usuarioId_fkey"
        FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "logs_auditoria_tenantId_idx"   ON "logs_auditoria" ("tenantId");
CREATE INDEX IF NOT EXISTS "logs_auditoria_usuarioId_idx"  ON "logs_auditoria" ("usuarioId");
CREATE INDEX IF NOT EXISTS "logs_auditoria_acao_idx"       ON "logs_auditoria" ("acao");
CREATE INDEX IF NOT EXISTS "logs_auditoria_criadoEm_idx"   ON "logs_auditoria" ("criadoEm");
