-- AlterTable
ALTER TABLE "contatos" ADD COLUMN     "dataRecontato" TIMESTAMP(3),
ADD COLUMN     "motivoRecontato" TEXT;

-- CreateTable
CREATE TABLE "mensagens_prospeccao" (
    "id" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "direcao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "telefone" TEXT,
    "messageId" TEXT,
    "processadaPorIA" BOOLEAN NOT NULL DEFAULT false,
    "respostaGerada" TEXT,
    "toolsChamadas" JSONB,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_prospeccao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_contatoId_idx" ON "mensagens_prospeccao"("contatoId");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_contatoId_dataHora_idx" ON "mensagens_prospeccao"("contatoId", "dataHora");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_direcao_idx" ON "mensagens_prospeccao"("direcao");

-- CreateIndex
CREATE INDEX "contatos_dataRecontato_idx" ON "contatos"("dataRecontato");

-- AddForeignKey
ALTER TABLE "mensagens_prospeccao" ADD CONSTRAINT "mensagens_prospeccao_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
