-- CreateEnum
CREATE TYPE "StatusTenant" AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CORRETOR', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "StatusLead" AS ENUM ('NOVO', 'CONTATANDO', 'QUALIFICADO', 'EM_NEGOCIACAO', 'CONVERTIDO', 'PERDIDO', 'INATIVO');

-- CreateEnum
CREATE TYPE "Temperatura" AS ENUM ('FRIO', 'MORNO', 'QUENTE');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('LIGACAO', 'WHATSAPP', 'EMAIL', 'NOTA', 'REUNIAO', 'TAREFA');

-- CreateEnum
CREATE TYPE "CanalConversa" AS ENUM ('WHATSAPP', 'VOZ', 'CHAT');

-- CreateEnum
CREATE TYPE "StatusConversa" AS ENUM ('ATIVA', 'CONCLUIDA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "PapelMensagem" AS ENUM ('USUARIO', 'ASSISTENTE', 'SISTEMA');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "StatusTenant" NOT NULL DEFAULT 'ATIVO',
    "plano" TEXT NOT NULL DEFAULT 'SMALL_BUSINESS',
    "precoConsultaCpf" DECIMAL(65,30) NOT NULL DEFAULT 2.00,
    "quotaMensal" INTEGER NOT NULL DEFAULT 100,
    "totalConsultas" INTEGER NOT NULL DEFAULT 0,
    "taxaCacheHit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_agente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "avatar" TEXT,
    "personalidade" JSONB NOT NULL,
    "expertise" JSONB NOT NULL,
    "scripts" JSONB NOT NULL,
    "regrasNegocio" JSONB NOT NULL,
    "estaAtivo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'CORRETOR',
    "avatar" TEXT,
    "telefone" TEXT,
    "estaAtivo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimoLoginEm" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_cpf" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT 'assertiva',
    "buscadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "contagemConsultas" INTEGER NOT NULL DEFAULT 1,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primeiraConsultaPor" TEXT,

    CONSTRAINT "cache_cpf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas_cpf" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "veioDoCache" BOOLEAN NOT NULL DEFAULT false,
    "custoParaNos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cobradoDe" DECIMAL(65,30) NOT NULL,
    "lucro" DECIMAL(65,30) NOT NULL,
    "consultadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consultadoPor" TEXT,
    "cacheId" TEXT,

    CONSTRAINT "consultas_cpf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "telefoneVerificado" BOOLEAN NOT NULL DEFAULT false,
    "dataNascimento" TIMESTAMP(3),
    "enderecoPrincipal" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "primeiroContato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusLead" NOT NULL DEFAULT 'NOVO',
    "estagio" TEXT NOT NULL DEFAULT 'contato_inicial',
    "temperatura" "Temperatura" NOT NULL DEFAULT 'FRIO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imoveis" (
    "id" TEXT NOT NULL,
    "inscricaoIptu" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "quadra" TEXT,
    "lote" TEXT,
    "codigoEdificio" TEXT,
    "nomeEdificio" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "areaTerreno" DOUBLE PRECISION,
    "areaEdificada" DOUBLE PRECISION,
    "certidaoCache" JSONB,
    "certidaoBuscadaEm" TIMESTAMP(3),
    "leadId" TEXT,
    "statusCaptacao" TEXT NOT NULL DEFAULT 'IDENTIFICADO',
    "interesse" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "canal" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "duracao" INTEGER,
    "gravacao" TEXT,
    "mensagem" TEXT,
    "resultado" TEXT,
    "agendadoPara" TIMESTAMP(3),
    "completadoEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "canal" "CanalConversa" NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "status" "StatusConversa" NOT NULL DEFAULT 'ATIVA',
    "contexto" JSONB,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_conversa" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "papel" "PapelMensagem" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_conversa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_agente_tenantId_key" ON "configuracoes_agente"("tenantId");

-- CreateIndex
CREATE INDEX "usuarios_email_idx" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "cache_cpf_cpf_key" ON "cache_cpf"("cpf");

-- CreateIndex
CREATE INDEX "cache_cpf_cpf_idx" ON "cache_cpf"("cpf");

-- CreateIndex
CREATE INDEX "cache_cpf_expiraEm_idx" ON "cache_cpf"("expiraEm");

-- CreateIndex
CREATE INDEX "consultas_cpf_tenantId_idx" ON "consultas_cpf"("tenantId");

-- CreateIndex
CREATE INDEX "consultas_cpf_cpf_idx" ON "consultas_cpf"("cpf");

-- CreateIndex
CREATE INDEX "consultas_cpf_consultadoEm_idx" ON "consultas_cpf"("consultadoEm");

-- CreateIndex
CREATE INDEX "leads_tenantId_idx" ON "leads"("tenantId");

-- CreateIndex
CREATE INDEX "leads_cpf_idx" ON "leads"("cpf");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_telefone_idx" ON "leads"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_tenantId_cpf_key" ON "leads"("tenantId", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_inscricaoIptu_key" ON "imoveis"("inscricaoIptu");

-- CreateIndex
CREATE INDEX "imoveis_inscricaoIptu_idx" ON "imoveis"("inscricaoIptu");

-- CreateIndex
CREATE INDEX "imoveis_bairro_idx" ON "imoveis"("bairro");

-- CreateIndex
CREATE INDEX "imoveis_codigoEdificio_idx" ON "imoveis"("codigoEdificio");

-- CreateIndex
CREATE INDEX "imoveis_leadId_idx" ON "imoveis"("leadId");

-- CreateIndex
CREATE INDEX "atividades_leadId_idx" ON "atividades"("leadId");

-- CreateIndex
CREATE INDEX "atividades_tipo_idx" ON "atividades"("tipo");

-- CreateIndex
CREATE INDEX "atividades_agendadoPara_idx" ON "atividades"("agendadoPara");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_sessaoId_key" ON "conversas"("sessaoId");

-- CreateIndex
CREATE INDEX "conversas_leadId_idx" ON "conversas"("leadId");

-- CreateIndex
CREATE INDEX "conversas_sessaoId_idx" ON "conversas"("sessaoId");

-- CreateIndex
CREATE INDEX "mensagens_conversa_conversaId_idx" ON "mensagens_conversa"("conversaId");

-- AddForeignKey
ALTER TABLE "configuracoes_agente" ADD CONSTRAINT "configuracoes_agente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas_cpf" ADD CONSTRAINT "consultas_cpf_cacheId_fkey" FOREIGN KEY ("cacheId") REFERENCES "cache_cpf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_conversa" ADD CONSTRAINT "mensagens_conversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
