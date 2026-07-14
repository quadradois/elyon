-- T01 (P2): Permitir contatos sem campanha vinculada
ALTER TABLE "contatos"
  ALTER COLUMN "campanhaId" DROP NOT NULL;

-- T01 (P2): Trocar unique composto padrão por índice único parcial
DROP INDEX IF EXISTS "contatos_campanhaId_telefone_key";

CREATE UNIQUE INDEX "contatos_campanhaId_telefone_unique_not_null"
  ON "contatos"("campanhaId", "telefone")
  WHERE "campanhaId" IS NOT NULL AND "telefone" IS NOT NULL;
