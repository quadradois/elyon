-- CreateTable
CREATE TABLE "listas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeEdificio" TEXT NOT NULL,
    "localizacao" TEXT,
    "cep" TEXT,
    "totalContatos" INTEGER NOT NULL DEFAULT 0,
    "totalEnriquecidos" INTEGER NOT NULL DEFAULT 0,
    "totalComWhatsapp" INTEGER NOT NULL DEFAULT 0,
    "totalUsados" INTEGER NOT NULL DEFAULT 0,
    "dadosPesquisa" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos_lista" (
    "id" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "inscricaoIptu" TEXT,
    "unidade" TEXT,
    "box" TEXT,
    "enderecoImovel" TEXT,
    "bairroImovel" TEXT,
    "telefone" TEXT,
    "telefone2" TEXT,
    "telefone3" TEXT,
    "telefone4" TEXT,
    "telefone5" TEXT,
    "telefonesJson" JSONB,
    "email" TEXT,
    "email2" TEXT,
    "email3" TEXT,
    "email4" TEXT,
    "email5" TEXT,
    "emailsJson" JSONB,
    "temWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "quantidadeWhatsapp" INTEGER NOT NULL DEFAULT 0,
    "usadoEmCampanha" BOOLEAN NOT NULL DEFAULT false,
    "campanhaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_lista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listas_tenantId_idx" ON "listas"("tenantId");

-- CreateIndex
CREATE INDEX "listas_nomeEdificio_idx" ON "listas"("nomeEdificio");

-- CreateIndex
CREATE INDEX "contatos_lista_listaId_idx" ON "contatos_lista"("listaId");

-- CreateIndex
CREATE INDEX "contatos_lista_usadoEmCampanha_idx" ON "contatos_lista"("usadoEmCampanha");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_lista_listaId_cpf_key" ON "contatos_lista"("listaId", "cpf");

-- AddForeignKey
ALTER TABLE "listas" ADD CONSTRAINT "listas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_lista" ADD CONSTRAINT "contatos_lista_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "listas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
