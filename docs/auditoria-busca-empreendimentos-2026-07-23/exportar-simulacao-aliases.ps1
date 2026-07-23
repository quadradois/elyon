param(
  [string]$OutputDir = $PSScriptRoot,
  [string]$SshHost = "root@86.48.0.157"
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$baseCte = @'
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
base AS (
  SELECT
    e.codigo AS codigo_edificio,
    e.nome AS nome_legado,
    e.logradouro AS logradouro_legado,
    e."totalUnidades" AS total_unidades_legado,
    p.id_lote,
    p.unidades_sobrepostas,
    cs.qtd_lotes,
    ls.qtd_codigos,
    g.nome_condominio AS nome_oficial,
    g.endereco_oficial,
    g.total_unidades AS total_unidades_geo,
    regexp_replace(
      translate(
        upper(trim(coalesce(e.nome, ''))),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      '',
      'g'
    ) AS nome_norm,
    regexp_replace(
      translate(
        upper(trim(coalesce(g.nome_condominio, ''))),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      '',
      'g'
    ) AS oficial_norm,
    EXISTS (
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
            upper(trim(coalesce(e.nome, ''))),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'AAAAAEEEEIIIIOOOOOUUUUC'
          ),
          '[^A-Z0-9]+',
          '',
          'g'
        )
    ) AS alias_ja_existe
  FROM edificios_geo e
  LEFT JOIN pares p ON p.codigo_edificio = e.codigo
  LEFT JOIN codigo_stats cs ON cs.codigo_edificio = e.codigo
  LEFT JOIN lote_stats ls ON ls.id_lote = p.id_lote
  LEFT JOIN geo360_lotes g
    ON g.cidade = 'goiania'
   AND g.id_lote = p.id_lote
),
classificados AS (
  SELECT
    *,
    CASE
      WHEN codigo_edificio <= 0 THEN 'IGNORAR_AGRUPADOR_ZERO'
      WHEN id_lote IS NULL THEN 'QUARENTENA_SEM_MAPEAMENTO'
      WHEN nome_norm = ''
        OR length(nome_norm) < 3
        OR nome_norm ~ '^[0-9]+$'
        OR nome_norm IN (
          'ED', 'EDIFICIO', 'CONDOMINIO', 'RES', 'RESIDENCIAL',
          'SEMNOME', 'NAOINFORMADO', 'NA', 'NAOCADASTRADO',
          'CONDOMINIONAOCADASTRADO', 'EDIFICIONAOCADASTRADO',
          'SEMIDENTIFICACAO', 'SEMDENOMINACAO'
        )
        THEN 'REVISAO_NOME_FRACO'
      WHEN trim(nome_legado) ~ '^[0-9]'
        OR length(regexp_replace(nome_norm, '[0-9]', '', 'g')) < 5
        THEN 'REVISAO_NOME_SUSPEITO'
      WHEN alias_ja_existe THEN 'IGNORAR_ALIAS_EXISTENTE'
      WHEN qtd_lotes > 1 THEN 'REVISAO_CODIGO_MULTILOTE'
      WHEN qtd_codigos > 1 THEN 'REVISAO_LOTE_MULTICODIGO'
      WHEN oficial_norm <> '' AND oficial_norm = nome_norm
        THEN 'IGNORAR_REDUNDANTE_OFICIAL'
      WHEN oficial_norm <> '' AND oficial_norm <> nome_norm
        THEN 'REVISAO_CONFLITO_NOME_OFICIAL'
      WHEN unidades_sobrepostas < 2
        THEN 'REVISAO_EVIDENCIA_UMA_UNIDADE'
      WHEN total_unidades_legado IS DISTINCT FROM total_unidades_geo
        THEN 'REVISAO_DIVERGENCIA_TOTAL_UNIDADES'
      ELSE 'AUTO_ALIAS_1A1_TOTAIS_IGUAIS'
    END AS classificacao
  FROM base
)
'@

function Exportar-CsvSomenteLeitura {
  param(
    [string]$Where,
    [string]$FileName
  )

  $select = @"
$baseCte
SELECT
  classificacao,
  'goiania' AS cidade,
  id_lote,
  codigo_edificio AS codigo_legado,
  nome_legado,
  nome_oficial,
  logradouro_legado,
  endereco_oficial,
  unidades_sobrepostas,
  total_unidades_legado,
  total_unidades_geo,
  qtd_lotes,
  qtd_codigos
FROM classificados
WHERE $Where
ORDER BY classificacao, nome_legado, codigo_edificio, id_lote
"@

  $copy = "COPY ($select) TO STDOUT WITH (FORMAT CSV, HEADER TRUE);"
  $lines = $copy | & ssh -o BatchMode=yes $SshHost `
    "docker exec -i elyon_postgres psql -v ON_ERROR_STOP=1 -q -U elyon_user -d elyon"

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao exportar $FileName"
  }

  $path = Join-Path $OutputDir $FileName
  [System.IO.File]::WriteAllLines(
    $path,
    [string[]]$lines,
    $utf8
  )
  return $path
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$auto = Exportar-CsvSomenteLeitura `
  -Where "classificacao = 'AUTO_ALIAS_1A1_TOTAIS_IGUAIS'" `
  -FileName "aliases-auto.csv"

$revisao = Exportar-CsvSomenteLeitura `
  -Where "classificacao LIKE 'REVISAO_%'" `
  -FileName "aliases-revisao.csv"

$quarentena = Exportar-CsvSomenteLeitura `
  -Where "classificacao = 'QUARENTENA_SEM_MAPEAMENTO'" `
  -FileName "aliases-quarentena.csv"

$ignorados = Exportar-CsvSomenteLeitura `
  -Where "classificacao LIKE 'IGNORAR_%'" `
  -FileName "aliases-ignorados.csv"

[pscustomobject]@{
  automaticos = $auto
  revisao = $revisao
  quarentena = $quarentena
  ignorados = $ignorados
} | Format-List
