-- 1. Correção de Duplicidade
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "expedientesemanal";

-- 2. Enums (Com proteção contra duplicidade)
DO $$ BEGIN
    CREATE TYPE "PlanoTipo" AS ENUM ('STARTER', 'GROWTH', 'PRO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TipoTransacao" AS ENUM ('ASSINATURA', 'RECARGA', 'BONUS', 'ESTORNO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TipoCredito" AS ENUM ('MENSAIS', 'PREPAGOS', 'BONUS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "StatusTransacao" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'ESTORNADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "TipoContrato" AS ENUM ('CAPTACAO', 'LOCACAO', 'VENDA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "StatusContrato" AS ENUM ('PENDENTE', 'ENVIADO', 'ACEITO', 'CANCELADO', 'EXPIRADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "StatusAgendamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'REALIZADO', 'NAO_COMPARECEU');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Atualização Billing (Tenants)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "creditosMensais" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "creditosPrepagos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "creditosBonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "agentesExtras" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "planoTipo" "PlanoTipo" NOT NULL DEFAULT 'STARTER';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "valorPlano" DECIMAL(65,30) NOT NULL DEFAULT 199.00;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dataRenovacao" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "asaasClienteId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "asaasAssinaturaId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ragPerfilTexto" TEXT;

-- 4. Novas Tabelas
CREATE TABLE IF NOT EXISTS "pacotes" (
    "id" TEXT NOT NULL, "nome" TEXT NOT NULL, "slug" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL, "valor" DECIMAL(65,30) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true, "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pacotes_slug_key" ON "pacotes"("slug");

CREATE TABLE IF NOT EXISTS "transacoes" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "tipo" "TipoTransacao" NOT NULL,
    "descricao" TEXT, "valor" DECIMAL(65,30) NOT NULL,
    "creditos" INTEGER NOT NULL, "tipoCredito" "TipoCredito" NOT NULL,
    "asaasPagamentoId" TEXT, "asaasAssinaturaId" TEXT, "metodoPagamento" "MetodoPagamento",
    "promocaoAplicada" TEXT, "creditosBonus" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusTransacao" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "confirmadoEm" TIMESTAMP(3),
    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transacoes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "renovacoes_log" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
    "planoAnterior" "PlanoTipo" NOT NULL, "planoNovo" "PlanoTipo" NOT NULL,
    "creditosExpirados" INTEGER NOT NULL, "creditosNovos" INTEGER NOT NULL,
    "renovadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "renovacoes_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "renovacoes_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "bairros_geo" (
    "id" TEXT NOT NULL, "codigo" INTEGER NOT NULL, "nome" TEXT NOT NULL,
    "ehCondominio" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bairros_geo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "bairros_geo_codigo_key" ON "bairros_geo"("codigo");

CREATE TABLE IF NOT EXISTS "edificios_geo" (
    "id" TEXT NOT NULL, "codigo" INTEGER NOT NULL, "nome" TEXT NOT NULL,
    "logradouro" TEXT, "codigoBairro" INTEGER, "totalUnidades" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "edificios_geo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "edificios_geo_codigoBairro_fkey" FOREIGN KEY ("codigoBairro") REFERENCES "bairros_geo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "edificios_geo_codigo_key" ON "edificios_geo"("codigo");

CREATE TABLE IF NOT EXISTS "clientes" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "nome" TEXT NOT NULL,
    "cpf" TEXT, "email" TEXT, "telefone" TEXT, "endereco" TEXT,
    "origemLeadId" TEXT, "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "clientes_origemLeadId_fkey" FOREIGN KEY ("origemLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_origemLeadId_key" ON "clientes"("origemLeadId");

CREATE TABLE IF NOT EXISTS "contratos" (
    "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
    "tipo" "TipoContrato" NOT NULL DEFAULT 'CAPTACAO', "status" "StatusContrato" NOT NULL DEFAULT 'PENDENTE',
    "tokenAceite" TEXT NOT NULL, "hashDocumento" TEXT NOT NULL, "htmlConteudo" TEXT NOT NULL,
    "dadosSnapshot" TEXT, "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3), "aceiteEm" TIMESTAMP(3), "canceladoEm" TIMESTAMP(3),
    "vigenciaInicio" TIMESTAMP(3), "vigenciaFim" TIMESTAMP(3),
    "aceiteIp" TEXT, "aceiteUserAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contratos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contratos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "contratos_tokenAceite_key" ON "contratos"("tokenAceite");

CREATE TABLE IF NOT EXISTS "conhecimento_curado" (
    "id" TEXT NOT NULL, "categoria" TEXT NOT NULL, "subcategoria" TEXT,
    "titulo" TEXT NOT NULL, "texto" TEXT NOT NULL, "contextoUso" TEXT NOT NULL, "exemplo" TEXT,
    "tipoImovel" TEXT[], "faixaPreco" TEXT, "tipoNegocio" TEXT[],
    "scoreEficacia" DECIMAL(65,30) NOT NULL DEFAULT 80, "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true, "embedding" TEXT, "embeddingModelo" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "criadoPor" TEXT, "fonte" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conhecimento_curado_pkey" PRIMARY KEY ("id")
);

-- 5. Atualização Imóveis (FKs)

-- codigoEdificio: Existe como TEXT, converter para INTEGER
ALTER TABLE "imoveis" ALTER COLUMN "codigoEdificio" TYPE INTEGER USING "codigoEdificio"::INTEGER;

-- codigoBairro: Não existe, adicionar
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "codigoBairro" INTEGER;

-- nomeEdificio: Verificar se existe (dump diz que sim, mas para segurança)
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "nomeEdificio" TEXT;

DO $$ BEGIN
    ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_codigoEdificio_fkey" FOREIGN KEY ("codigoEdificio") REFERENCES "edificios_geo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_codigoBairro_fkey" FOREIGN KEY ("codigoBairro") REFERENCES "bairros_geo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

