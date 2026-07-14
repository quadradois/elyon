-- Evolution GO migration: a instância passa a ser identificada pelo id (uuid)
-- e autenticada pelo token próprio. Campos preenchidos ao criar a instância.
ALTER TABLE "sessoes_whatsapp" ADD COLUMN "evolutionInstanceId" TEXT;
ALTER TABLE "sessoes_whatsapp" ADD COLUMN "evolutionToken" TEXT;
