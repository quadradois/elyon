-- AlterTable
ALTER TABLE "imoveis_rancho" ALTER COLUMN "cidade" SET DATA TYPE TEXT,
ALTER COLUMN "inscricao_cartografica" SET DATA TYPE TEXT,
ALTER COLUMN "cpf_cnpj" SET DATA TYPE TEXT,
ALTER COLUMN "nome_pessoa" SET DATA TYPE TEXT,
ALTER COLUMN "bairro" SET DATA TYPE TEXT,
ALTER COLUMN "cep" SET DATA TYPE TEXT,
ALTER COLUMN "sincronizado_em" DROP DEFAULT,
ALTER COLUMN "complemento" SET DATA TYPE TEXT,
ALTER COLUMN "logradouro" SET DATA TYPE TEXT,
ALTER COLUMN "nr_lote" SET DATA TYPE TEXT,
ALTER COLUMN "propriedad_mapa" SET DATA TYPE INTEGER,
ALTER COLUMN "status_proprietario" SET DATA TYPE TEXT,
ALTER COLUMN "fonte_proprietario" SET DATA TYPE TEXT,
ALTER COLUMN "enriquecido_em" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "imoveis_rancho_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "webhook_eventos" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- DropTable
DROP TABLE "geo360_diag_cpf";

-- RenameIndex
ALTER INDEX "idx_imrancho_cidade_setor_quadra" RENAME TO "imoveis_rancho_cidade_id_setor_id_quadra_idx";

-- RenameIndex
ALTER INDEX "idx_imrancho_cpf" RENAME TO "imoveis_rancho_cpf_cnpj_idx";

-- RenameIndex
ALTER INDEX "idx_imrancho_idbairro" RENAME TO "imoveis_rancho_id_bairro_idx";

-- RenameIndex
ALTER INDEX "idx_imrancho_inscricao" RENAME TO "imoveis_rancho_inscricao_cartografica_key";

-- RenameIndex
ALTER INDEX "idx_imrancho_status_prop" RENAME TO "imoveis_rancho_status_proprietario_idx";
