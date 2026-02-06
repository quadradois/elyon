/*
  Warnings:

  - A unique constraint covering the columns `[tokenConfirmacao]` on the table `atividades` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sessaoWhatsappId]` on the table `configuracoes_agente` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoIntegracao" AS ENUM ('CRM_QUADRADOIS', 'CRM_OUTRO', 'CANALPRO', 'WEBHOOK_CUSTOM');

-- CreateEnum
CREATE TYPE "TipoLLM" AS ENUM ('OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'GOOGLE_VERTEX', 'GROQ', 'MISTRAL', 'TOGETHER', 'DEEPSEEK');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('DESCONECTADO', 'CONECTANDO', 'CONECTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "Urgencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "TipoPlaybook" AS ENUM ('QUALIFICACAO', 'VENDA', 'LOCACAO', 'CAPTACAO', 'COMERCIAL');

-- CreateEnum
CREATE TYPE "TipoItemPlaybook" AS ENUM ('CHECKBOX', 'TEXTO', 'SELECT', 'NUMERO', 'DATA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusLead" ADD VALUE 'TENTATIVA_AGENDAMENTO';
ALTER TYPE "StatusLead" ADD VALUE 'VISITA_AGENDADA';
ALTER TYPE "StatusLead" ADD VALUE 'AVALIACAO_EM_ANDAMENTO';
ALTER TYPE "StatusLead" ADD VALUE 'DOCUMENTACAO';
ALTER TYPE "StatusLead" ADD VALUE 'ONBOARDING';
ALTER TYPE "StatusLead" ADD VALUE 'CAPTADO';
ALTER TYPE "StatusLead" ADD VALUE 'ARQUIVADO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoAtividade" ADD VALUE 'AVALIACAO';
ALTER TYPE "TipoAtividade" ADD VALUE 'FOLLOW_UP';

-- DropIndex
DROP INDEX "configuracoes_agente_tenantId_key";

-- AlterTable
ALTER TABLE "alertas_corretor" ADD COLUMN     "riscoEscalacao" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "atividades" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "canceladoPor" TEXT,
ADD COLUMN     "confirmacoesEnviadas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confirmadoEm" TIMESTAMP(3),
ADD COLUMN     "confirmadoPor" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "statusAgendamento" "StatusAgendamento" DEFAULT 'PENDENTE',
ADD COLUMN     "tokenConfirmacao" TEXT;

-- AlterTable
ALTER TABLE "campanhas" ADD COLUMN     "agenteId" TEXT;

-- AlterTable
ALTER TABLE "configuracoes_agente" ADD COLUMN     "sessaoWhatsappId" TEXT;

-- AlterTable
ALTER TABLE "conversas" ADD COLUMN     "dadosColetados" JSONB,
ADD COLUMN     "faseSPIN" TEXT,
ADD COLUMN     "podeQualificar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tentativasRecovery" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "areaImovel" TEXT,
ADD COLUMN     "autorizouAnuncio" BOOLEAN,
ADD COLUMN     "comCorretorAtualmente" BOOLEAN,
ADD COLUMN     "comissaoAcordada" TEXT,
ADD COLUMN     "consequencias" TEXT,
ADD COLUMN     "contratoUrl" TEXT,
ADD COLUMN     "crmPropertyCode" TEXT,
ADD COLUMN     "crmPropertyId" INTEGER,
ADD COLUMN     "crmProprietarioId" INTEGER,
ADD COLUMN     "crmSyncError" TEXT,
ADD COLUMN     "crmSyncStatus" TEXT,
ADD COLUMN     "custosAtuais" TEXT,
ADD COLUMN     "dadosImovelColetadosEm" TIMESTAMP(3),
ADD COLUMN     "dataAssinatura" TIMESTAMP(3),
ADD COLUMN     "doresIdentificadas" TEXT[],
ADD COLUMN     "enderecoImovel" TEXT,
ADD COLUMN     "enviadoParaCrmEm" TIMESTAMP(3),
ADD COLUMN     "estadoConservacao" TEXT,
ADD COLUMN     "expectativaServico" TEXT,
ADD COLUMN     "imovelAndar" INTEGER,
ADD COLUMN     "imovelAreaTotal" DOUBLE PRECISION,
ADD COLUMN     "imovelBanheiros" INTEGER,
ADD COLUMN     "imovelCaracteristicas" TEXT[],
ADD COLUMN     "imovelDescricao" TEXT,
ADD COLUMN     "imovelFotos" TEXT[],
ADD COLUMN     "imovelSuites" INTEGER,
ADD COLUMN     "imovelValorCondominio" DOUBLE PRECISION,
ADD COLUMN     "imovelValorIPTU" DOUBLE PRECISION,
ADD COLUMN     "imovelValorLocacao" DOUBLE PRECISION,
ADD COLUMN     "interesseAvaliacao" BOOLEAN,
ADD COLUMN     "interesseEm" TEXT,
ADD COLUMN     "motivacaoVenda" TEXT,
ADD COLUMN     "motivoPerda" TEXT,
ADD COLUMN     "objecoes" TEXT[],
ADD COLUMN     "observacoesSpin" TEXT,
ADD COLUMN     "ocupacaoImovel" TEXT,
ADD COLUMN     "prazoDesejado" TEXT,
ADD COLUMN     "prazoTrabalho" INTEGER,
ADD COLUMN     "pressaoTempo" BOOLEAN,
ADD COLUMN     "quartosImovel" INTEGER,
ADD COLUMN     "situacaoAtual" TEXT,
ADD COLUMN     "situacaoFinanceira" TEXT,
ADD COLUMN     "temDividas" BOOLEAN,
ADD COLUMN     "tempoDecisao" TEXT,
ADD COLUMN     "tentativasAnteriores" TEXT,
ADD COLUMN     "tipoAutorizacao" TEXT,
ADD COLUMN     "tipoImovel" TEXT,
ADD COLUMN     "ultimaAcaoIA" TEXT,
ADD COLUMN     "ultimaAcaoIAEm" TIMESTAMP(3),
ADD COLUMN     "urgencia" "Urgencia",
ADD COLUMN     "vagasImovel" INTEGER,
ADD COLUMN     "valorPretendido" TEXT,
ADD COLUMN     "vigenciaFim" TIMESTAMP(3),
ADD COLUMN     "vigenciaInicio" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "configuracoes_integracao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoIntegracao" NOT NULL DEFAULT 'CRM_QUADRADOIS',
    "nome" TEXT NOT NULL DEFAULT 'CRM Principal',
    "apiUrl" TEXT NOT NULL,
    "apiKeyCriptografada" TEXT NOT NULL,
    "tenantIdDestino" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoTesteEm" TIMESTAMP(3),
    "ultimoTesteOk" BOOLEAN,
    "ultimoErro" TEXT,
    "totalEnvios" INTEGER NOT NULL DEFAULT 0,
    "totalSucessos" INTEGER NOT NULL DEFAULT 0,
    "totalFalhas" INTEGER NOT NULL DEFAULT 0,
    "ultimoEnvioEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_integracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_llm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoProvider" "TipoLLM" NOT NULL DEFAULT 'ANTHROPIC',
    "modeloPreferido" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "apiKeyCriptografada" TEXT,
    "baseUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "priorizacao" INTEGER NOT NULL DEFAULT 1,
    "maxTokensPorMes" INTEGER,
    "maxRequisicoesPorMinuto" INTEGER,
    "totalChamadas" INTEGER NOT NULL DEFAULT 0,
    "totalTokensInput" BIGINT NOT NULL DEFAULT 0,
    "totalTokensOutput" BIGINT NOT NULL DEFAULT 0,
    "custoEstimado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ultimoUsoEm" TIMESTAMP(3),
    "ultimoTesteEm" TIMESTAMP(3),
    "ultimoTesteOk" BOOLEAN,
    "ultimoErro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_llm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_whatsapp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "instanceName" TEXT NOT NULL,
    "numeroWhatsapp" TEXT,
    "nomeWhatsapp" TEXT,
    "status" "StatusConexao" NOT NULL DEFAULT 'DESCONECTADO',
    "ultimoStatus" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "ignorarGrupos" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoPlaybook" NOT NULL DEFAULT 'QUALIFICACAO',
    "ePadrao" BOOLEAN NOT NULL DEFAULT false,
    "estaAtivo" BOOLEAN NOT NULL DEFAULT true,
    "agenteId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_stages" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "icone" TEXT NOT NULL DEFAULT '📋',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "scriptTexto" TEXT,
    "aiPromptContext" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_items" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tipoItem" "TipoItemPlaybook" NOT NULL DEFAULT 'CHECKBOX',
    "opcoes" TEXT[],
    "placeholder" TEXT,
    "scorePontos" INTEGER NOT NULL DEFAULT 0,
    "atualizaCampo" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "aiExtrairPadrao" TEXT,
    "aiPreencherAuto" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_objections" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "gatilho" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_objections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_playbook_responses" (
    "id" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "playbookItemId" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "respostaOriginal" TEXT,
    "scoreGerado" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_playbook_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracoes_integracao_tenantId_idx" ON "configuracoes_integracao"("tenantId");

-- CreateIndex
CREATE INDEX "configuracoes_integracao_tipo_idx" ON "configuracoes_integracao"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_integracao_tenantId_tipo_key" ON "configuracoes_integracao"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "configuracoes_llm_tenantId_idx" ON "configuracoes_llm"("tenantId");

-- CreateIndex
CREATE INDEX "configuracoes_llm_ativo_idx" ON "configuracoes_llm"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_llm_tenantId_tipoProvider_key" ON "configuracoes_llm"("tenantId", "tipoProvider");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_whatsapp_instanceName_key" ON "sessoes_whatsapp"("instanceName");

-- CreateIndex
CREATE INDEX "sessoes_whatsapp_tenantId_idx" ON "sessoes_whatsapp"("tenantId");

-- CreateIndex
CREATE INDEX "sessoes_whatsapp_instanceName_idx" ON "sessoes_whatsapp"("instanceName");

-- CreateIndex
CREATE INDEX "playbooks_tenantId_ePadrao_idx" ON "playbooks"("tenantId", "ePadrao");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_nome_tenantId_key" ON "playbooks"("nome", "tenantId");

-- CreateIndex
CREATE INDEX "playbook_stages_playbookId_ordem_idx" ON "playbook_stages"("playbookId", "ordem");

-- CreateIndex
CREATE INDEX "playbook_items_stageId_ordem_idx" ON "playbook_items"("stageId", "ordem");

-- CreateIndex
CREATE INDEX "playbook_objections_stageId_idx" ON "playbook_objections"("stageId");

-- CreateIndex
CREATE INDEX "lead_playbook_responses_contatoId_idx" ON "lead_playbook_responses"("contatoId");

-- CreateIndex
CREATE INDEX "lead_playbook_responses_playbookId_idx" ON "lead_playbook_responses"("playbookId");

-- CreateIndex
CREATE INDEX "lead_playbook_responses_playbookItemId_idx" ON "lead_playbook_responses"("playbookItemId");

-- CreateIndex
CREATE UNIQUE INDEX "atividades_tokenConfirmacao_key" ON "atividades"("tokenConfirmacao");

-- CreateIndex
CREATE INDEX "atividades_statusAgendamento_idx" ON "atividades"("statusAgendamento");

-- CreateIndex
CREATE INDEX "atividades_tokenConfirmacao_idx" ON "atividades"("tokenConfirmacao");

-- CreateIndex
CREATE INDEX "bairros_geo_nome_idx" ON "bairros_geo"("nome");

-- CreateIndex
CREATE INDEX "clientes_tenantId_idx" ON "clientes"("tenantId");

-- CreateIndex
CREATE INDEX "clientes_cpf_idx" ON "clientes"("cpf");

-- CreateIndex
CREATE INDEX "clientes_email_idx" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_agente_sessaoWhatsappId_key" ON "configuracoes_agente"("sessaoWhatsappId");

-- CreateIndex
CREATE INDEX "configuracoes_agente_tenantId_idx" ON "configuracoes_agente"("tenantId");

-- CreateIndex
CREATE INDEX "conhecimento_curado_categoria_idx" ON "conhecimento_curado"("categoria");

-- CreateIndex
CREATE INDEX "conhecimento_curado_subcategoria_idx" ON "conhecimento_curado"("subcategoria");

-- CreateIndex
CREATE INDEX "conhecimento_curado_ativo_idx" ON "conhecimento_curado"("ativo");

-- CreateIndex
CREATE INDEX "contratos_tenantId_idx" ON "contratos"("tenantId");

-- CreateIndex
CREATE INDEX "contratos_leadId_idx" ON "contratos"("leadId");

-- CreateIndex
CREATE INDEX "contratos_tokenAceite_idx" ON "contratos"("tokenAceite");

-- CreateIndex
CREATE INDEX "contratos_status_idx" ON "contratos"("status");

-- CreateIndex
CREATE INDEX "conversas_faseSPIN_idx" ON "conversas"("faseSPIN");

-- CreateIndex
CREATE INDEX "edificios_geo_nome_idx" ON "edificios_geo"("nome");

-- CreateIndex
CREATE INDEX "edificios_geo_codigoBairro_idx" ON "edificios_geo"("codigoBairro");

-- CreateIndex
CREATE INDEX "imoveis_codigoBairro_idx" ON "imoveis"("codigoBairro");

-- CreateIndex
CREATE INDEX "leads_urgencia_idx" ON "leads"("urgencia");

-- CreateIndex
CREATE INDEX "renovacoes_log_tenantId_idx" ON "renovacoes_log"("tenantId");

-- CreateIndex
CREATE INDEX "renovacoes_log_renovadoEm_idx" ON "renovacoes_log"("renovadoEm");

-- CreateIndex
CREATE INDEX "transacoes_tenantId_idx" ON "transacoes"("tenantId");

-- CreateIndex
CREATE INDEX "transacoes_status_idx" ON "transacoes"("status");

-- CreateIndex
CREATE INDEX "transacoes_criadoEm_idx" ON "transacoes"("criadoEm");

-- AddForeignKey
ALTER TABLE "configuracoes_integracao" ADD CONSTRAINT "configuracoes_integracao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_llm" ADD CONSTRAINT "configuracoes_llm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_agente" ADD CONSTRAINT "configuracoes_agente_sessaoWhatsappId_fkey" FOREIGN KEY ("sessaoWhatsappId") REFERENCES "sessoes_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_whatsapp" ADD CONSTRAINT "sessoes_whatsapp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "configuracoes_agente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "configuracoes_agente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_stages" ADD CONSTRAINT "playbook_stages_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_items" ADD CONSTRAINT "playbook_items_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "playbook_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_objections" ADD CONSTRAINT "playbook_objections_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "playbook_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_playbook_responses" ADD CONSTRAINT "lead_playbook_responses_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_playbook_responses" ADD CONSTRAINT "lead_playbook_responses_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_playbook_responses" ADD CONSTRAINT "lead_playbook_responses_playbookItemId_fkey" FOREIGN KEY ("playbookItemId") REFERENCES "playbook_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
