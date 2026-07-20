CREATE TABLE "geo360_sync_runs" (
    "id" UUID NOT NULL,
    "cidade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "promover" BOOLEAN NOT NULL DEFAULT false,
    "iniciado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ,
    "prefixos_total" INTEGER NOT NULL DEFAULT 0,
    "prefixos_concluidos" INTEGER NOT NULL DEFAULT 0,
    "encontrados" INTEGER NOT NULL DEFAULT 0,
    "detalhes_ok" INTEGER NOT NULL DEFAULT 0,
    "erros" INTEGER NOT NULL DEFAULT 0,
    "mensagem" TEXT,
    CONSTRAINT "geo360_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "geo360_prefix_progress" (
    "cidade" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "run_id" UUID NOT NULL,
    "total_search" INTEGER NOT NULL DEFAULT 0,
    "detalhes_ok" INTEGER NOT NULL DEFAULT 0,
    "sem_ficha" INTEGER NOT NULL DEFAULT 0,
    "erros" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo360_prefix_progress_pkey" PRIMARY KEY ("cidade", "prefixo")
);

CREATE TABLE "geo360_imoveis_stage" (
    "cidade" TEXT NOT NULL,
    "inscricao" TEXT NOT NULL,
    "id_imobiliario" BIGINT,
    "id_lote" BIGINT,
    "numero_cadastro" BIGINT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "cpf_cnpj" TEXT,
    "nome_pessoa" TEXT,
    "tipo_pessoa" INTEGER,
    "endereco" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "complemento" TEXT,
    "logradouro" TEXT,
    "area_construida" DOUBLE PRECISION,
    "area_terreno" DOUBLE PRECISION,
    "tipo_edificacao" INTEGER,
    "nr_lote" TEXT,
    "id_bairro" INTEGER,
    "id_quadra" INTEGER,
    "id_setor" INTEGER,
    "raw" JSONB,
    "detalhe_versao" INTEGER NOT NULL DEFAULT 0,
    "detalhe_em" TIMESTAMPTZ,
    "visto_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "geo360_imoveis_stage_pkey" PRIMARY KEY ("cidade", "inscricao")
);

CREATE INDEX "geo360_sync_runs_cidade_iniciado_idx"
    ON "geo360_sync_runs"("cidade", "iniciado_em");
CREATE INDEX "geo360_stage_run_idx" ON "geo360_imoveis_stage"("run_id");
CREATE INDEX "geo360_stage_id_imobiliario_idx"
    ON "geo360_imoveis_stage"("cidade", "id_imobiliario");

CREATE TABLE "geo360_sync_failures" (
    "cidade" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "inscricao" TEXT NOT NULL,
    "id_imobiliario" BIGINT,
    "etapa" TEXT NOT NULL,
    "codigo" TEXT,
    "mensagem" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "primeira_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvido_em" TIMESTAMPTZ,
    "run_id" UUID NOT NULL,
    CONSTRAINT "geo360_sync_failures_pkey" PRIMARY KEY ("cidade", "inscricao", "etapa")
);

CREATE INDEX "geo360_failures_abertas_idx"
    ON "geo360_sync_failures"("cidade", "prefixo", "resolvido_em");
