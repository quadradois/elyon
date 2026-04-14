-- Rastreamento de Proprietário por Imóvel (detecção de venda)
--
-- cpfProprietario : CPF/CNPJ atual vindo do scraper da Prefeitura
-- cpfVerificadoEm : última vez que o scraper confirmou o proprietário (TTL 30 dias)
-- histProprietarios: auditoria de trocas [{cpf, ate: ISO}]
--
-- Quando job-mineracao raspa o IPTU e o CPF retornado difere do cpfProprietario salvo:
--   1. O sistema detecta "imóvel vendido"
--   2. Invalida o cache_cpf do CPF antigo (expiraEm = now)
--   3. Salva o novo CPF e reinicia a verificação
--   4. Appenda a entrada no histProprietarios

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS "cpfProprietario"    TEXT,
  ADD COLUMN IF NOT EXISTS "cpfVerificadoEm"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "histProprietarios"  JSONB;

CREATE INDEX IF NOT EXISTS "imoveis_cpfProprietario_idx" ON imoveis ("cpfProprietario");
