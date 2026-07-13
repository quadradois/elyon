#!/usr/bin/env bash
set -Eeuo pipefail

readonly OWNER='platform-data'
readonly SOURCE_CONTAINER="${SOURCE_CONTAINER:-elyon_postgres}"
readonly POSTGRES_IMAGE="${POSTGRES_IMAGE:-pgvector/pgvector:0.8.0-pg15}"
readonly OUTPUT_ROOT="${ANONYMIZED_DB_OUTPUT_ROOT:-/var/lib/elyon/anonymized-db}"
readonly REPO_DIR="${REPO_DIR:-/root/elyon}"
readonly LOCK_FILE="${ANONYMIZED_DB_LOCK_FILE:-/var/lock/elyon-anonymized-db-copy.lock}"
readonly TIMEOUT_SECONDS="${ANONYMIZATION_TIMEOUT_SECONDS:-3600}"
readonly MIN_FREE_BYTES=$((1024 * 1024 * 1024))

mode=''
confirmed=false

usage() {
  cat <<'EOF'
Uso:
  sudo ./scripts/ops/create-anonymized-db-copy.sh --check
  sudo ./scripts/ops/create-anonymized-db-copy.sh --apply --confirm-production-copy

Variaveis opcionais:
  SOURCE_CONTAINER               Container PostgreSQL de origem (elyon_postgres)
  POSTGRES_IMAGE                 Imagem isolada compativel com producao
  ANONYMIZED_DB_OUTPUT_ROOT      Diretorio fora do repositorio para o artefato
  ANONYMIZATION_TIMEOUT_SECONDS  Timeout por etapa pesada (3600)
EOF
}

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

while (($#)); do
  case "$1" in
    --check|--apply)
      [[ -z "$mode" ]] || fail 'informe apenas um modo'
      mode="$1"
      ;;
    --confirm-production-copy)
      confirmed=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "argumento invalido: $1"
      ;;
  esac
  shift
done

[[ -n "$mode" ]] || { usage >&2; fail 'informe --check ou --apply'; }
[[ $(id -u) -eq 0 ]] || fail 'execute como root para proteger artefatos e limpar containers temporarios'
command -v docker >/dev/null || fail 'docker nao encontrado'
command -v openssl >/dev/null || fail 'openssl nao encontrado'
command -v sha256sum >/dev/null || fail 'sha256sum nao encontrado'
command -v flock >/dev/null || fail 'flock nao encontrado'
command -v realpath >/dev/null || fail 'realpath nao encontrado'
command -v timeout >/dev/null || fail 'timeout nao encontrado'
[[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || fail 'ANONYMIZATION_TIMEOUT_SECONDS deve ser inteiro positivo'
docker inspect "$SOURCE_CONTAINER" >/dev/null 2>&1 || fail "container de origem ausente: $SOURCE_CONTAINER"
[[ $(docker inspect --format '{{.State.Running}}' "$SOURCE_CONTAINER") == true ]] || fail 'PostgreSQL de origem nao esta em execucao'

source_user=$(docker exec "$SOURCE_CONTAINER" sh -lc 'printf %s "$POSTGRES_USER"')
source_db=$(docker exec "$SOURCE_CONTAINER" sh -lc 'printf %s "$POSTGRES_DB"')
[[ -n "$source_user" && -n "$source_db" ]] || fail 'POSTGRES_USER/POSTGRES_DB ausentes no container de origem'

source_size=$(docker exec "$SOURCE_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$source_user" -d "$source_db" -Atc \
  "SELECT pg_database_size(current_database());")
[[ "$source_size" =~ ^[0-9]+$ ]] || fail 'nao foi possivel medir o banco de origem'

docker_root=$(docker info --format '{{.DockerRootDir}}')
free_bytes=$(df -PB1 "$docker_root" | awk 'NR == 2 {print $4}')
required_bytes=$((source_size * 2 + MIN_FREE_BYTES))
((free_bytes >= required_bytes)) || fail \
  "espaco insuficiente: livre=${free_bytes} requerido=${required_bytes} (2x banco + 1 GiB)"

output_root_canonical=$(realpath -m "$OUTPUT_ROOT")
repo_canonical=$(realpath -m "$REPO_DIR")
case "$output_root_canonical" in
  "$repo_canonical"|"$repo_canonical"/*) fail 'o artefato anonimizado nao pode ser gravado dentro do repositorio' ;;
esac

echo "CHECK_OK owner=${OWNER} source_container=${SOURCE_CONTAINER} source_db=${source_db} source_bytes=${source_size} free_bytes=${free_bytes}"
echo 'A origem sera somente leitura via pg_dump; nenhum dump bruto sera persistido.'

if [[ "$mode" == '--check' ]]; then
  echo 'Nenhum container, banco, arquivo ou volume foi alterado.'
  exit 0
fi

[[ "$confirmed" == true ]] || fail '--apply exige --confirm-production-copy'

exec 9>"$LOCK_FILE"
flock -n 9 || fail 'ja existe outra copia anonimizada em execucao'

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
scrub_container="elyon_anonymize_${timestamp}_$$"
verify_container="elyon_anonymize_verify_${timestamp}_$$"
target_user='elyon_anonymizer'
target_db='elyon_anonymized'
target_password=$(openssl rand -hex 24)
dump_path="${output_root_canonical}/elyon-anonymized-${timestamp}.dump"
checksum_path="${dump_path}.sha256"
inventory_path="${output_root_canonical}/elyon-anonymized-${timestamp}.inventory.csv"
evidence_path="${output_root_canonical}/elyon-anonymized-${timestamp}.evidence"

cleanup() {
  docker rm -f "$scrub_container" "$verify_container" >/dev/null 2>&1 || true
  unset target_password
}
trap cleanup EXIT INT TERM

install -d -m 700 "$output_root_canonical"
umask 077
[[ ! -e "$dump_path" ]] || fail "artefato ja existe: $dump_path"

start_isolated_postgres() {
  local container="$1"
  docker run -d --rm --network none \
    --name "$container" \
    --label 'elyon.purpose=anonymized-db-copy' \
    -e POSTGRES_DB="$target_db" \
    -e POSTGRES_USER="$target_user" \
    -e POSTGRES_PASSWORD="$target_password" \
    "$POSTGRES_IMAGE" >/dev/null

  local attempt=0
  local ready_streak=0
  while ((attempt < 60)); do
    if docker exec "$container" pg_isready -U "$target_user" -d "$target_db" >/dev/null 2>&1; then
      ready_streak=$((ready_streak + 1))
      if ((ready_streak >= 3)); then
        return 0
      fi
    else
      ready_streak=0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  fail "PostgreSQL temporario nao ficou pronto: $container"
}

echo 'Criando copia temporaria por streaming...'
start_isolated_postgres "$scrub_container"
timeout --foreground "$TIMEOUT_SECONDS" docker exec "$SOURCE_CONTAINER" pg_dump \
  -U "$source_user" -d "$source_db" \
  --format=custom --no-owner --no-acl \
  | timeout --foreground "$TIMEOUT_SECONDS" docker exec -i "$scrub_container" pg_restore \
      -U "$target_user" -d "$target_db" \
      --no-owner --no-acl --exit-on-error

echo 'Anonimizando colunas sensiveis na copia isolada...'
timeout --foreground "$TIMEOUT_SECONDS" docker exec -i "$scrub_container" psql \
  -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" <<'SQL'
DO $elyon_anonymize$
DECLARE
  item record;
  assignment text;
  digest_expr text;
  replacement text;
  affected bigint;
BEGIN
  FOR item IN
    SELECT
      table_schema,
      table_name,
      column_name,
      data_type,
      udt_name,
      character_maximum_length,
      lower(column_name) AS normalized_name
    FROM information_schema.columns columns
    WHERE table_schema = 'public'
      AND table_name <> '_prisma_migrations'
      AND is_generated = 'NEVER'
      AND EXISTS (
        SELECT 1
        FROM information_schema.tables tables
        WHERE tables.table_schema = columns.table_schema
          AND tables.table_name = columns.table_name
          AND tables.table_type = 'BASE TABLE'
      )
      AND (
        lower(column_name) ~ '(cpf|cnpj|email|telefone|whatsapp|nome|endereco|logradouro|complemento|cep|senha|password|token|secret|api.*key|apikey|payload|conteudo|texto|mensagem|resposta|prompt|descricao|observacoes|avatar|url|instagram|facebook|site|rawbody|foto|hash|erro)'
        OR lower(column_name) ~ '(dados|detalhes|config|regras|scripts|tools|snapshot|resultado|briefing|parametros|personalidade|expertise|diferenciais|perfil)'
        OR lower(column_name) ~ '(asaas|evolution|messageid|eventoid|crm.*id)'
        OR lower(column_name) ~ '(^ip$|aceiteip|clientip|sourceip|remoteip|useragent|nascimento|idade|^sexo$|profissao|renda|salario|^rg$|mae|escolaridade|estadocivil|obito|^ppe$|signo|latitude|longitude|social|empresa|s3key|storage|por$)'
        OR lower(column_name) ~ '(^numero$|bairro|cidade|^estado$|quadra|lote|apartamento|bloco|unidade|^box$|inscricao|iptu|slug|taskid|motivo|situacao|dores|consequencias|expectativa|objecoes)'
      )
      AND (
        data_type IN (
          'text', 'character varying', 'character', 'json', 'jsonb', 'bytea',
          'smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision',
          'date', 'timestamp without time zone', 'timestamp with time zone', 'boolean'
        )
        OR (data_type = 'ARRAY' AND udt_name = '_text')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints constraints
        JOIN information_schema.key_column_usage key_columns
          ON key_columns.constraint_schema = constraints.constraint_schema
          AND key_columns.constraint_name = constraints.constraint_name
          AND key_columns.table_schema = constraints.table_schema
          AND key_columns.table_name = constraints.table_name
        WHERE constraints.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
          AND key_columns.table_schema = columns.table_schema
          AND key_columns.table_name = columns.table_name
          AND key_columns.column_name = columns.column_name
      )
    ORDER BY table_name, ordinal_position
  LOOP
    digest_expr := format(
      'md5(%L || ctid::text || coalesce(%I::text, %L))',
      item.table_schema || '.' || item.table_name || '.' || item.column_name,
      item.column_name,
      ''
    );

    IF item.data_type = 'jsonb' THEN
      replacement := '''{}''::jsonb';
    ELSIF item.data_type = 'json' THEN
      replacement := '''{}''::json';
    ELSIF item.data_type = 'bytea' THEN
      replacement := 'decode('''', ''hex'')';
    ELSIF item.data_type = 'ARRAY' THEN
      replacement := 'ARRAY[]::text[]';
    ELSIF item.data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision') THEN
      replacement := format('mod((''x'' || substring(%s from 1 for 8))::bit(32)::bigint, 30000)', digest_expr);
    ELSIF item.data_type = 'date' THEN
      replacement := 'DATE ''2000-01-01''';
    ELSIF item.data_type IN ('timestamp without time zone', 'timestamp with time zone') THEN
      replacement := 'TIMESTAMP ''2000-01-01 00:00:00''';
    ELSIF item.data_type = 'boolean' THEN
      replacement := 'false';
    ELSIF item.normalized_name ~ 'email' THEN
      replacement := format('''anon+'' || substring(%s from 1 for 20) || ''@example.invalid''', digest_expr);
    ELSIF item.normalized_name ~ 'cnpj' THEN
      replacement := format('substring(translate(%s, ''abcdef'', ''123456'') from 1 for 14)', digest_expr);
    ELSIF item.normalized_name ~ 'cpf' THEN
      replacement := format('substring(translate(%s, ''abcdef'', ''123456'') from 1 for 11)', digest_expr);
    ELSIF item.normalized_name ~ '(telefone|whatsapp)' THEN
      replacement := format('''55'' || substring(translate(%s, ''abcdef'', ''123456'') from 1 for 11)', digest_expr);
    ELSIF item.normalized_name ~ '(senha|password)' THEN
      replacement := format('''$2b$12$invalid-anonymized-'' || substring(%s from 1 for 20)', digest_expr);
    ELSE
      replacement := format('''anon_'' || substring(%s from 1 for 24)', digest_expr);
    END IF;

    IF item.character_maximum_length IS NOT NULL THEN
      replacement := format('left((%s)::text, %s)', replacement, item.character_maximum_length);
    END IF;

    assignment := format(
      'CASE WHEN %1$I IS NULL THEN NULL ELSE %2$s END',
      item.column_name,
      replacement
    );

    EXECUTE format(
      'UPDATE %I.%I SET %I = %s',
      item.table_schema,
      item.table_name,
      item.column_name,
      assignment
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'anonymized %.% rows=%', item.table_name, item.column_name, affected;
  END LOOP;
END
$elyon_anonymize$;

VACUUM ANALYZE;
SQL

echo 'Gerando inventario sem valores de usuario...'
{
  printf 'table,column,data_type\n'
  docker exec "$scrub_container" psql \
    -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -At -F ',' -c "
      SELECT table_name, column_name, data_type
      FROM information_schema.columns columns
      WHERE table_schema = 'public'
        AND table_name <> '_prisma_migrations'
        AND is_generated = 'NEVER'
        AND EXISTS (
          SELECT 1
          FROM information_schema.tables tables
          WHERE tables.table_schema = columns.table_schema
            AND tables.table_name = columns.table_name
            AND tables.table_type = 'BASE TABLE'
        )
        AND (
          lower(column_name) ~ '(cpf|cnpj|email|telefone|whatsapp|nome|endereco|logradouro|complemento|cep|senha|password|token|secret|api.*key|apikey|payload|conteudo|texto|mensagem|resposta|prompt|descricao|observacoes|avatar|url|instagram|facebook|site|rawbody|foto|hash|erro)'
          OR lower(column_name) ~ '(dados|detalhes|config|regras|scripts|tools|snapshot|resultado|briefing|parametros|personalidade|expertise|diferenciais|perfil)'
          OR lower(column_name) ~ '(asaas|evolution|messageid|eventoid|crm.*id)'
          OR lower(column_name) ~ '(^ip$|aceiteip|clientip|sourceip|remoteip|useragent|nascimento|idade|^sexo$|profissao|renda|salario|^rg$|mae|escolaridade|estadocivil|obito|^ppe$|signo|latitude|longitude|social|empresa|s3key|storage|por$)'
          OR lower(column_name) ~ '(^numero$|bairro|cidade|^estado$|quadra|lote|apartamento|bloco|unidade|^box$|inscricao|iptu|slug|taskid|motivo|situacao|dores|consequencias|expectativa|objecoes)'
        )
        AND (
          data_type IN (
            'text', 'character varying', 'character', 'json', 'jsonb', 'bytea',
            'smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision',
            'date', 'timestamp without time zone', 'timestamp with time zone', 'boolean'
          )
          OR (data_type = 'ARRAY' AND udt_name = '_text')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints constraints
          JOIN information_schema.key_column_usage key_columns
            ON key_columns.constraint_schema = constraints.constraint_schema
            AND key_columns.constraint_name = constraints.constraint_name
            AND key_columns.table_schema = constraints.table_schema
            AND key_columns.table_name = constraints.table_name
          WHERE constraints.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
            AND key_columns.table_schema = columns.table_schema
            AND key_columns.table_name = columns.table_name
            AND key_columns.column_name = columns.column_name
        )
      ORDER BY table_name, ordinal_position;"
} > "$inventory_path"

table_count=$(docker exec "$scrub_container" psql \
  -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -Atc \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';")
migration_table=$(docker exec "$scrub_container" psql \
  -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -Atc \
  "SELECT coalesce(to_regclass('public._prisma_migrations')::text, '');")
if [[ -n "$migration_table" ]]; then
  migration_count=$(docker exec "$scrub_container" psql \
    -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -Atc \
    'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL;')
else
  migration_count=0
fi

echo 'Exportando somente a copia ja anonimizada...'
timeout --foreground "$TIMEOUT_SECONDS" docker exec "$scrub_container" pg_dump \
  -U "$target_user" -d "$target_db" \
  --format=custom --no-owner --no-acl > "$dump_path"
[[ -s "$dump_path" ]] || fail 'dump anonimizado vazio'
chmod 600 "$dump_path" "$inventory_path"

docker rm -f "$scrub_container" >/dev/null

echo 'Restaurando o artefato em um segundo PostgreSQL descartavel...'
start_isolated_postgres "$verify_container"
timeout --foreground "$TIMEOUT_SECONDS" docker exec -i "$verify_container" pg_restore \
  -U "$target_user" -d "$target_db" \
  --no-owner --no-acl --exit-on-error < "$dump_path"
verified_table_count=$(docker exec "$verify_container" psql \
  -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -Atc \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';")
[[ "$verified_table_count" == "$table_count" ]] || fail \
  "restore divergente: tabelas_origem=${table_count} tabelas_restore=${verified_table_count}"
verified_migration_table=$(docker exec "$verify_container" psql \
  -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -Atc \
  "SELECT coalesce(to_regclass('public._prisma_migrations')::text, '');")
if [[ -n "$verified_migration_table" ]]; then
  verified_migration_count=$(docker exec "$verify_container" psql \
    -v ON_ERROR_STOP=1 -U "$target_user" -d "$target_db" -Atc \
    'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL;')
else
  verified_migration_count=0
fi
[[ "$verified_migration_count" == "$migration_count" ]] || fail \
  "restore divergente: migrations_origem=${migration_count} migrations_restore=${verified_migration_count}"

checksum=$(sha256sum "$dump_path" | awk '{print $1}')
printf '%s  %s\n' "$checksum" "$(basename "$dump_path")" > "$checksum_path"
cat > "$evidence_path" <<EOF
created_at_utc=${timestamp}
owner=${OWNER}
source_container=${SOURCE_CONTAINER}
source_database=${source_db}
source_bytes=${source_size}
raw_dump_persisted=false
anonymized_dump=${dump_path}
sha256=${checksum}
inventory=${inventory_path}
public_tables=${table_count}
finished_prisma_migrations=${migration_count}
restore_verified=true
verified_public_tables=${verified_table_count}
verified_finished_prisma_migrations=${verified_migration_count}
postgres_image=${POSTGRES_IMAGE}
retention_deadline_utc=$(date -u -d '+24 hours' +%Y-%m-%dT%H:%M:%SZ)
EOF
chmod 600 "$checksum_path" "$evidence_path"

echo "ANONYMIZED_COPY_OK dump=${dump_path} sha256=${checksum} evidence=${evidence_path}"
echo 'Artefato com permissao 0600; transfira apenas por canal administrativo seguro e remova em ate 24 horas.'
