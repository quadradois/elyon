#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE=${ELYON_BACKUP_ENV_FILE:-/root/backup_r2.env}
ROOT_DIR=${ELYON_ROOT_DIR:-/root/elyon}
STATUS_DIR=${ELYON_BACKUP_STATUS_DIR:-$ROOT_DIR/backups/status}
STATUS_FILE=$STATUS_DIR/offhost.env
EVIDENCE_DIR=${ELYON_RESTORE_EVIDENCE_DIR:-/var/lib/elyon/restore-drills}
RTO_SECONDS=${ELYON_RTO_SECONDS:-14400}
SNAPSHOT=${1:-latest}
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
CONTAINER="elyon_restore_drill_${RUN_ID,,}"
VOLUME="elyon_restore_drill_data_${RUN_ID,,}"
RESTORE_ROOT="/tmp/elyon-restore-drill-$RUN_ID"
STARTED_AT=$(date +%s)

log() { printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$*"; }

on_error() {
  local exit_code=$? line="${1:-unknown}"
  trap - ERR
  log "restore drill falhou (exit=$exit_code, line=$line)" >&2
  return "$exit_code"
}

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -rf "$RESTORE_ROOT"
}
trap cleanup EXIT
trap 'on_error $LINENO' ERR

[[ $(id -u) -eq 0 ]] || { echo 'Execute como root.' >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Credenciais ausentes: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"
for command_name in docker gzip restic sha256sum; do
  command -v "$command_name" >/dev/null || { echo "Comando ausente: $command_name" >&2; exit 1; }
done
install -d -m 0755 "$STATUS_DIR" "$EVIDENCE_DIR"

log "localizando dump no snapshot $SNAPSHOT"
dump_path=$(restic ls "$SNAPSHOT" \
  | awk '$NF ~ /\/backups\/(offhost|last)\/.*\.sql\.gz$/ { print $NF }' \
  | sort | tail -1)
[[ -n "$dump_path" ]] || { echo "Nenhum dump SQL gzip encontrado no snapshot $SNAPSHOT" >&2; exit 1; }
checksum_path="${dump_path}.sha256"
mkdir -p "$RESTORE_ROOT"
restic restore "$SNAPSHOT" --include "$dump_path" --include "$checksum_path" --target "$RESTORE_ROOT"
local_dump="$RESTORE_ROOT$dump_path"
[[ -s "$local_dump" ]] || { echo "Dump restaurado ausente: $local_dump" >&2; exit 1; }
gzip -t "$local_dump"
if [[ -s "$RESTORE_ROOT$checksum_path" ]]; then
  (cd "$(dirname "$local_dump")" && sha256sum -c "$(basename "$checksum_path")")
fi
dump_sha256=$(sha256sum "$local_dump" | cut -d' ' -f1)
dump_bytes=$(stat -c %s "$local_dump")
available_bytes=$(df --output=avail -B1 "$RESTORE_ROOT" | tail -1 | tr -d ' ')
(( available_bytes > dump_bytes * 5 )) || {
  echo "Espaço insuficiente para restore isolado: disponível=$available_bytes dump=$dump_bytes" >&2
  exit 1
}

docker volume create "$VOLUME" >/dev/null
docker run -d --name "$CONTAINER" --network none \
  -e POSTGRES_USER=elyon_restore \
  -e POSTGRES_PASSWORD=restore-drill-only \
  -e POSTGRES_DB=elyon_restore \
  -v "$VOLUME:/var/lib/postgresql/data" \
  pgvector/pgvector:0.8.0-pg15 >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U elyon_restore -d elyon_restore >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U elyon_restore -d elyon_restore >/dev/null

# Roles são globais ao cluster e não fazem parte do pg_dump do banco.
docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore \
  -c 'CREATE ROLE elyon_tenant_access NOLOGIN' >/dev/null
log "restaurando dump em PostgreSQL isolado"
gzip -dc "$local_dump" \
  | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore >/dev/null

query() {
  docker exec "$CONTAINER" psql -U elyon_restore -d elyon_restore -Atc "$1"
}
table_count=$(query "select count(*) from pg_tables where schemaname='public';")
migration_count=$(query "select count(*) from public._prisma_migrations;")
tenant_count=$(query "select count(*) from public.tenants;")
lead_count=$(query "select count(*) from public.leads;")
database_bytes=$(query "select pg_database_size(current_database());")
(( table_count > 0 && migration_count > 0 && tenant_count > 0 && lead_count > 0 )) || {
  echo "Integridade inválida: tables=$table_count migrations=$migration_count tenants=$tenant_count leads=$lead_count" >&2
  exit 1
}

finished_at=$(date +%s)
duration=$((finished_at - STARTED_AT))
(( duration <= RTO_SECONDS )) || { echo "Restore excedeu RTO: ${duration}s > ${RTO_SECONDS}s" >&2; exit 1; }
evidence="$EVIDENCE_DIR/restore-drill-$RUN_ID.json"
cat > "$evidence" <<EOF
{
  "schemaVersion": 1,
  "executedAt": "$(date -u --iso-8601=seconds)",
  "snapshot": "$SNAPSHOT",
  "dumpPath": "$dump_path",
  "dumpSha256": "$dump_sha256",
  "dumpBytes": $dump_bytes,
  "databaseBytes": $database_bytes,
  "durationSeconds": $duration,
  "rtoSeconds": $RTO_SECONDS,
  "tableCount": $table_count,
  "migrationCount": $migration_count,
  "tenantCount": $tenant_count,
  "leadCount": $lead_count,
  "success": true
}
EOF
chmod 0644 "$evidence"

temp_status=$(mktemp "$STATUS_DIR/.offhost.env.XXXXXX")
if [[ -f "$STATUS_FILE" ]]; then
  grep -vE '^last_restore_(success_timestamp|duration_seconds)=' "$STATUS_FILE" > "$temp_status"
fi
{
  printf 'last_restore_success_timestamp=%s\n' "$finished_at"
  printf 'last_restore_duration_seconds=%s\n' "$duration"
} >> "$temp_status"
chmod 0644 "$temp_status"
mv -f "$temp_status" "$STATUS_FILE"
logger -t elyon-restore-drill -- \
  "status=success snapshot=$SNAPSHOT duration=$duration tables=$table_count migrations=$migration_count"
log "restore drill aprovado em ${duration}s; evidência: $evidence"
