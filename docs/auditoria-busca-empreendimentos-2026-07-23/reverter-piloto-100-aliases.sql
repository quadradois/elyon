\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _aliases_piloto_removidos
ON COMMIT DROP
AS
WITH removidos AS (
  DELETE FROM geo360_lote_aliases
  WHERE metadados ->> 'loteMigracao' = 'legacy-alias-pilot-20260723-v1'
  RETURNING cidade, id_lote, nome
)
SELECT *
FROM removidos;

DO $$
DECLARE
  total_removido integer;
BEGIN
  SELECT count(*) INTO total_removido
  FROM _aliases_piloto_removidos;

  IF total_removido NOT IN (0, 100) THEN
    RAISE EXCEPTION
      'Rollback abortado: quantidade inesperada de aliases do piloto: %',
      total_removido;
  END IF;
END
$$;

COMMIT;

SELECT count(*) AS aliases_restantes_do_piloto
FROM geo360_lote_aliases
WHERE metadados ->> 'loteMigracao' = 'legacy-alias-pilot-20260723-v1';
