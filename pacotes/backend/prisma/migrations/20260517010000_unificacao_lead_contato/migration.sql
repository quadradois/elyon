-- Unificação Lead/Contato: elimina o modelo Contato.
-- Os dados da tabela `contatos` são migrados para `leads` antes do DROP.
-- A tabela `mensagens_prospeccao` está vazia em produção (troca contatoId -> leadId é segura).

-- DropForeignKey
ALTER TABLE "contatos" DROP CONSTRAINT "contatos_campanhaId_fkey";

-- DropForeignKey
ALTER TABLE "contatos" DROP CONSTRAINT "contatos_leadId_fkey";

-- DropForeignKey
ALTER TABLE "mensagens_prospeccao" DROP CONSTRAINT "mensagens_prospeccao_contatoId_fkey";

-- DropIndex
DROP INDEX "leads_tenantId_cpf_key";

-- DropIndex
DROP INDEX "mensagens_prospeccao_contatoId_dataHora_idx";

-- DropIndex
DROP INDEX "mensagens_prospeccao_contatoId_idx";

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "anoConstituicao" INTEGER,
ADD COLUMN     "apartamento" TEXT,
ADD COLUMN     "areaConstruida" DECIMAL(65,30),
ADD COLUMN     "areaTerreno" DECIMAL(65,30),
ADD COLUMN     "atendidoPor" TEXT,
ADD COLUMN     "bloco" TEXT,
ADD COLUMN     "box" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "cpfMae" TEXT,
ADD COLUMN     "dataRecontato" TIMESTAMP(3),
ADD COLUMN     "email3" TEXT,
ADD COLUMN     "email4" TEXT,
ADD COLUMN     "email5" TEXT,
ADD COLUMN     "emailsJson" JSONB,
ADD COLUMN     "enderecoPessoal" TEXT,
ADD COLUMN     "enriquecidoEm" TIMESTAMP(3),
ADD COLUMN     "escolaridade" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "estadoCivil" TEXT,
ADD COLUMN     "fonteEnriquecimento" TEXT,
ADD COLUMN     "lote" TEXT,
ADD COLUMN     "manifestouInteresse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modoAtendimento" TEXT NOT NULL DEFAULT 'IA',
ADD COLUMN     "motivoDesinteresse" TEXT,
ADD COLUMN     "motivoPausa" TEXT,
ADD COLUMN     "motivoRecontato" TEXT,
ADD COLUMN     "nomeMae" TEXT,
ADD COLUMN     "obitoProvavel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "participacoesEmpresas" JSONB,
ADD COLUMN     "pausadoEm" TIMESTAMP(3),
ADD COLUMN     "perfilInvestidor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ppe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primeiraResposta" TIMESTAMP(3),
ADD COLUMN     "quadra" TEXT,
ADD COLUMN     "quantidadeWhatsapp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "redesSociais" JSONB,
ADD COLUMN     "respondeu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "scoreQualificacao" INTEGER,
ADD COLUMN     "signo" TEXT,
ADD COLUMN     "situacaoCadastral" TEXT,
ADD COLUMN     "statusProspeccao" TEXT,
ADD COLUMN     "telefone4" TEXT,
ADD COLUMN     "telefone5" TEXT,
ADD COLUMN     "telefonesJson" JSONB,
ADD COLUMN     "temWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tentativasContato" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tipoLogradouro" TEXT,
ADD COLUMN     "ultimaTentativa" TIMESTAMP(3),
ADD COLUMN     "unidade" TEXT;

-- AlterTable
ALTER TABLE "mensagens_prospeccao" DROP COLUMN "contatoId",
ADD COLUMN     "leadId" TEXT NOT NULL;

-- DataMigration: copia os contatos para leads (tenantId derivado da campanha).
-- Ignora contatos que já viraram lead (leadId preenchido) para evitar duplicidade.
INSERT INTO "leads" (
  "id", "tenantId", "campanhaOrigemId", "origem", "nome", "telefone", "email", "cpf",
  "inscricaoIptu", "enderecoPessoal", "enderecoImovel", "statusProspeccao", "tentativasContato",
  "respondeu", "primeiraResposta", "manifestouInteresse", "criadoEm", "atualizadoEm",
  "anoConstituicao", "areaConstruida", "areaTerreno", "bairroImovel", "cep", "cidade",
  "dataNascimento", "email2", "email3", "email4", "email5", "emailsJson", "enriquecidoEm",
  "estado", "estadoCivil", "fonteEnriquecimento", "idade", "motivoDesinteresse", "observacoes",
  "perfilInvestidor", "profissao", "scoreAssertiva", "scoreQualificacao", "sexo", "telefone2",
  "telefone3", "telefone4", "telefone5", "telefonesJson", "temWhatsapp", "quantidadeWhatsapp",
  "tipoImovel", "ultimaTentativa", "valorVenal", "cnpjEmpresa", "empresaAtual", "faixaSalarial",
  "nomeMae", "obitoProvavel", "participacoesEmpresas", "ppe", "redesSociais", "setor", "signo",
  "situacaoCadastral", "rendaEstimada", "apartamento", "bloco", "box", "lote", "nomeEdificio",
  "quadra", "unidade", "dataRecontato", "motivoRecontato", "atendidoPor", "modoAtendimento",
  "motivoPausa", "pausadoEm", "cpfMae", "escolaridade", "tipoLogradouro"
)
SELECT
  c."id", k."tenantId", c."campanhaId", 'mineracao', c."nome", c."telefone", c."email", c."cpf",
  c."inscricaoIptu", c."endereco", c."enderecoImovel", c."statusProspeccao", c."tentativasContato",
  c."respondeu", c."primeiraResposta", c."manifestouInteresse", c."criadoEm", c."atualizadoEm",
  c."anoConstituicao", c."areaConstruida", c."areaTerreno", c."bairroImovel", c."cep", c."cidade",
  c."dataNascimento", c."email2", c."email3", c."email4", c."email5", c."emailsJson", c."enriquecidoEm",
  c."estado", c."estadoCivil", c."fonteEnriquecimento", c."idade", c."motivoDesinteresse", c."observacoes",
  c."perfilInvestidor", c."profissao", c."scoreAssertiva", c."scoreQualificacao", c."sexo", c."telefone2",
  c."telefone3", c."telefone4", c."telefone5", c."telefonesJson", c."temWhatsapp", c."quantidadeWhatsapp",
  c."tipoImovel", c."ultimaTentativa", c."valorVenal"::text, c."cnpjEmpresa", c."empresaAtual", c."faixaSalarial",
  c."nomeMae", c."obitoProvavel", c."participacoesEmpresas", c."ppe", c."redesSociais", c."setor", c."signo",
  c."situacaoCadastral", c."rendaEstimada"::text, c."apartamento", c."bloco", c."box", c."lote", c."nomeEdificio",
  c."quadra", c."unidade", c."dataRecontato", c."motivoRecontato", c."atendidoPor", c."modoAtendimento",
  c."motivoPausa", c."pausadoEm", c."cpfMae", c."escolaridade", c."tipoLogradouro"
FROM "contatos" c
JOIN "campanhas" k ON k."id" = c."campanhaId"
WHERE c."leadId" IS NULL
  AND c."id" NOT IN (SELECT "id" FROM "leads");

-- DropTable
DROP TABLE "contatos";

-- CreateIndex
CREATE INDEX "leads_tenantId_cpf_idx" ON "leads"("tenantId", "cpf");

-- CreateIndex
CREATE INDEX "leads_campanhaOrigemId_statusProspeccao_idx" ON "leads"("campanhaOrigemId", "statusProspeccao");

-- CreateIndex
CREATE INDEX "leads_statusProspeccao_idx" ON "leads"("statusProspeccao");

-- CreateIndex
CREATE INDEX "leads_modoAtendimento_idx" ON "leads"("modoAtendimento");

-- CreateIndex
CREATE INDEX "leads_dataRecontato_idx" ON "leads"("dataRecontato");

-- CreateIndex
CREATE INDEX "leads_tentativasContato_idx" ON "leads"("tentativasContato");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_leadId_idx" ON "mensagens_prospeccao"("leadId");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_leadId_dataHora_idx" ON "mensagens_prospeccao"("leadId", "dataHora");

-- AddForeignKey
ALTER TABLE "mensagens_prospeccao" ADD CONSTRAINT "mensagens_prospeccao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
