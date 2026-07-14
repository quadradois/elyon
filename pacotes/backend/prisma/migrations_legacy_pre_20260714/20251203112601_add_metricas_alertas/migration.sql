-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "atendidoPor" TEXT,
ADD COLUMN     "modoAtendimento" TEXT NOT NULL DEFAULT 'IA',
ADD COLUMN     "motivoPausa" TEXT,
ADD COLUMN     "pausadoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "imoveis" ADD COLUMN     "apartamento" TEXT,
ADD COLUMN     "bloco" TEXT,
ADD COLUMN     "box" TEXT,
ADD COLUMN     "tipoImovel" TEXT,
ADD COLUMN     "unidade" TEXT;

-- CreateTable
CREATE TABLE "metricas_mensagens" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT,
    "conversaId" TEXT,
    "leadId" TEXT,
    "tenantId" TEXT NOT NULL,
    "mensagemUsuario" TEXT,
    "respostaGerada" TEXT,
    "workerUsado" TEXT NOT NULL,
    "modoOperacao" TEXT NOT NULL DEFAULT 'PASSIVO',
    "confianca" INTEGER NOT NULL DEFAULT 0,
    "relevancia" INTEGER NOT NULL DEFAULT 0,
    "tom" TEXT NOT NULL DEFAULT 'ADEQUADO',
    "riscoEscalacao" INTEGER NOT NULL DEFAULT 0,
    "acaoSupervisor" TEXT NOT NULL DEFAULT 'ENVIAR',
    "foiRefinada" BOOLEAN NOT NULL DEFAULT false,
    "foiEscalada" BOOLEAN NOT NULL DEFAULT false,
    "alertaCorretor" BOOLEAN NOT NULL DEFAULT false,
    "tempoProcessamentoMs" INTEGER,
    "tokensUsados" INTEGER,
    "custoEstimado" DECIMAL(65,30),
    "toolsChamadas" JSONB,
    "temperaturaLead" TEXT,
    "processadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metricas_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_corretor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "conversaId" TEXT,
    "tipo" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "contexto" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "visualizadoEm" TIMESTAMP(3),
    "atendidoEm" TIMESTAMP(3),
    "atendidoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_corretor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metricas_mensagens_tenantId_idx" ON "metricas_mensagens"("tenantId");

-- CreateIndex
CREATE INDEX "metricas_mensagens_leadId_idx" ON "metricas_mensagens"("leadId");

-- CreateIndex
CREATE INDEX "metricas_mensagens_conversaId_idx" ON "metricas_mensagens"("conversaId");

-- CreateIndex
CREATE INDEX "metricas_mensagens_workerUsado_idx" ON "metricas_mensagens"("workerUsado");

-- CreateIndex
CREATE INDEX "metricas_mensagens_acaoSupervisor_idx" ON "metricas_mensagens"("acaoSupervisor");

-- CreateIndex
CREATE INDEX "metricas_mensagens_processadoEm_idx" ON "metricas_mensagens"("processadoEm");

-- CreateIndex
CREATE INDEX "alertas_corretor_tenantId_idx" ON "alertas_corretor"("tenantId");

-- CreateIndex
CREATE INDEX "alertas_corretor_status_idx" ON "alertas_corretor"("status");

-- CreateIndex
CREATE INDEX "alertas_corretor_prioridade_idx" ON "alertas_corretor"("prioridade");

-- CreateIndex
CREATE INDEX "alertas_corretor_criadoEm_idx" ON "alertas_corretor"("criadoEm");
