\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _piloto_aliases_20260723
ON COMMIT DROP
AS
WITH pares AS (
  SELECT
    l."codigoEdificio" AS codigo_edificio,
    r.id_lote,
    count(*)::integer AS unidades_sobrepostas
  FROM imoveis l
  JOIN imoveis_rancho r
    ON r.cidade = 'goiania'
   AND r.inscricao_cartografica = l."inscricaoIptu"
  WHERE l."codigoEdificio" > 0
    AND r.id_lote IS NOT NULL
  GROUP BY l."codigoEdificio", r.id_lote
),
codigo_stats AS (
  SELECT codigo_edificio, count(*)::integer AS qtd_lotes
  FROM pares
  GROUP BY codigo_edificio
),
lote_stats AS (
  SELECT id_lote, count(*)::integer AS qtd_codigos
  FROM pares
  GROUP BY id_lote
),
candidatos AS (
  SELECT
    p.id_lote,
    e.codigo AS codigo_legado,
    trim(regexp_replace(e.nome, '[[:space:]]+', ' ', 'g')) AS nome_original,
    upper(trim(regexp_replace(e.nome, '[[:space:]]+', ' ', 'g'))) AS nome_normalizado,
    p.unidades_sobrepostas,
    e."totalUnidades" AS total_unidades_legado,
    g.total_unidades AS total_unidades_geo
  FROM edificios_geo e
  JOIN pares p
    ON p.codigo_edificio = e.codigo
  JOIN codigo_stats cs
    ON cs.codigo_edificio = e.codigo
  JOIN lote_stats ls
    ON ls.id_lote = p.id_lote
  JOIN geo360_lotes g
    ON g.cidade = 'goiania'
   AND g.id_lote = p.id_lote
  WHERE cs.qtd_lotes = 1
    AND ls.qtd_codigos = 1
    AND p.unidades_sobrepostas >= 3
    AND e."totalUnidades" IS NOT DISTINCT FROM g.total_unidades
    AND coalesce(trim(g.nome_condominio), '') = ''
    AND length(trim(e.nome)) BETWEEN 8 AND 80
    AND trim(e.nome) !~ '[0-9_/@#]'
    AND trim(e.nome) ~ '^[[:alpha:]][[:alpha:] .''&-]+$'
    AND upper(trim(e.nome)) !~ '^(RES|COND|ED)[.]?([[:space:]]|$)'
    AND upper(e.nome) ~ (
      'RESIDENCIAL|CONDOM[IÍ]NIO|EDIF[IÍ]CIO|TORRE|SHOPPING|GALERIA|'
      'VILLAGE|VILLE|PARQUE|PLAZA|CENTER|PALACE|TOWER|HOME|PREMIER|'
      'BUSINESS|OFFICE|FLAT|HOTEL|JARDIM|SOLAR|PORTAL|MORADA|VILA|'
      'VILLA|PRIV[EÊ]|ROYAL|GARDEN|PARK'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM geo360_lote_aliases a
      WHERE a.cidade = 'goiania'
        AND a.id_lote = p.id_lote
        AND regexp_replace(
          translate(
            upper(trim(a.nome)),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'AAAAAEEEEIIIIOOOOOUUUUC'
          ),
          '[^A-Z0-9]+',
          '',
          'g'
        ) = regexp_replace(
          translate(
            upper(trim(e.nome)),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'AAAAAEEEEIIIIOOOOOUUUUC'
          ),
          '[^A-Z0-9]+',
          '',
          'g'
        )
    )
)
SELECT *
FROM candidatos
ORDER BY unidades_sobrepostas DESC, nome_normalizado, id_lote
LIMIT 100;

DO $$
DECLARE
  total integer;
  chaves_duplicadas integer;
BEGIN
  SELECT count(*) INTO total
  FROM _piloto_aliases_20260723;

  IF total <> 100 THEN
    RAISE EXCEPTION
      'Piloto abortado: esperados 100 candidatos, encontrados %',
      total;
  END IF;

  SELECT count(*) INTO chaves_duplicadas
  FROM (
    SELECT id_lote, nome_normalizado
    FROM _piloto_aliases_20260723
    GROUP BY id_lote, nome_normalizado
    HAVING count(*) > 1
  ) d;

  IF chaves_duplicadas <> 0 THEN
    RAISE EXCEPTION
      'Piloto abortado: encontradas % chaves duplicadas',
      chaves_duplicadas;
  END IF;
END
$$;

INSERT INTO geo360_lote_aliases (
  cidade,
  id_lote,
  nome,
  tipo,
  fonte_url,
  validado,
  validado_em,
  observacao,
  metadados,
  criado_em,
  atualizado_em
)
SELECT
  'goiania',
  p.id_lote,
  p.nome_normalizado,
  'LEGADO',
  NULL,
  true,
  clock_timestamp(),
  'Piloto controlado: vínculo legado-GEO360 1:1, totais iguais e pelo menos 3 unidades coincidentes.',
  jsonb_build_object(
    'loteMigracao', 'legacy-alias-pilot-20260723-v1',
    'origem', 'edificios_geo',
    'codigoLegado', p.codigo_legado,
    'nomeOriginal', p.nome_original,
    'unidadesSobrepostas', p.unidades_sobrepostas,
    'totalUnidadesLegado', p.total_unidades_legado,
    'totalUnidadesGeo360', p.total_unidades_geo,
    'regra', '1:1_totais_iguais_min_3_sem_nome_oficial_filtro_semantico'
  ),
  clock_timestamp(),
  clock_timestamp()
FROM _piloto_aliases_20260723 p
ON CONFLICT (cidade, id_lote, nome) DO NOTHING;

DO $$
DECLARE
  total_lote integer;
BEGIN
  SELECT count(*) INTO total_lote
  FROM geo360_lote_aliases
  WHERE metadados ->> 'loteMigracao' = 'legacy-alias-pilot-20260723-v1';

  IF total_lote <> 100 THEN
    RAISE EXCEPTION
      'Piloto abortado: lote persistido deveria conter 100 aliases, contém %',
      total_lote;
  END IF;
END
$$;

COMMIT;

SELECT
  count(*) AS aliases_piloto,
  count(*) FILTER (WHERE validado) AS aliases_validados,
  count(DISTINCT id_lote) AS lotes_distintos,
  min(criado_em) AS primeiro_registro,
  max(criado_em) AS ultimo_registro
FROM geo360_lote_aliases
WHERE metadados ->> 'loteMigracao' = 'legacy-alias-pilot-20260723-v1';

