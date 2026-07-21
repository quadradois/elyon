#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE=${ELYON_BACKUP_ENV_FILE:-/root/backup_r2.env}
ROOT_DIR=${ELYON_ROOT_DIR:-/root/elyon}
BACKUP_DIR=${ELYON_OFFHOST_BACKUP_DIR:-$ROOT_DIR/backups/offhost}
STATUS_DIR=${ELYON_BACKUP_STATUS_DIR:-$ROOT_DIR/backups/status}
STATUS_FILE=$STATUS_DIR/offhost.env
LOCAL_BACKUP_KEEP=${ELYON_OFFHOST_LOCAL_KEEP:-2}
STARTED_AT=$(date +%s)
LAST_SUCCESS=0
DUMP_BYTES=0

log() { printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$*"; }

status_value() {
  local key="$1"
  [[ -f "$STATUS_FILE" ]] || return 0
  sed -n "s/^${key}=//p" "$STATUS_FILE" | tail -1
}

write_status() {
  local run_success="$1" duration snapshot_id="${2:-unknown}" temp
  duration=$(( $(date +%s) - STARTED_AT ))
  temp=$(mktemp "$STATUS_DIR/.offhost.env.XXXXXX")
  {
    printf 'last_run_timestamp=%s\n' "$(date +%s)"
    printf 'last_run_success=%s\n' "$run_success"
    printf 'last_success_timestamp=%s\n' "$LAST_SUCCESS"
    printf 'last_duration_seconds=%s\n' "$duration"
    printf 'last_dump_bytes=%s\n' "$DUMP_BYTES"
    printf 'last_snapshot_id=%s\n' "$snapshot_id"
    printf 'last_restore_success_timestamp=%s\n' "$(status_value last_restore_success_timestamp)"
    printf 'last_restore_duration_seconds=%s\n' "$(status_value last_restore_duration_seconds)"
  } > "$temp"
  chmod 0644 "$temp"
  mv -f "$temp" "$STATUS_FILE"
}

on_error() {
  local exit_code=$?
  log "backup off-host falhou (exit=$exit_code)"
  mkdir -p "$STATUS_DIR"
  LAST_SUCCESS=$(status_value last_success_timestamp)
  LAST_SUCCESS=${LAST_SUCCESS:-0}
  write_status 0
  logger -t elyon-offhost-backup -- "status=failure exit=$exit_code"
  exit "$exit_code"
}
trap on_error ERR

[[ $(id -u) -eq 0 ]] || { echo 'Execute como root.' >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Credenciais ausentes: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$ENV_FILE"
for command_name in docker gzip restic sha256sum; do
  command -v "$command_name" >/dev/null || { echo "Comando ausente: $command_name" >&2; exit 1; }
done
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY ausente}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD ausente}"
[[ "$LOCAL_BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] \
  || { echo 'ELYON_OFFHOST_LOCAL_KEEP deve ser inteiro positivo.' >&2; exit 1; }

install -d -m 0750 "$BACKUP_DIR"
install -d -m 0755 "$STATUS_DIR"
LAST_SUCCESS=$(status_value last_success_timestamp)
LAST_SUCCESS=${LAST_SUCCESS:-0}

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
dump_path="$BACKUP_DIR/elyon-${timestamp}.sql.gz"
dump_tmp="${dump_path}.tmp"
checksum_path="${dump_path}.sha256"
rm -f "$dump_tmp"

log "criando dump consistente do PostgreSQL"
docker exec elyon_postgres sh -ceu \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  | gzip -1 > "$dump_tmp"
gzip -t "$dump_tmp"
mv -f "$dump_tmp" "$dump_path"
DUMP_BYTES=$(stat -c %s "$dump_path")
(cd "$BACKUP_DIR" && sha256sum "$(basename "$dump_path")" > "$(basename "$checksum_path")")

log "enviando dump criptografado ao repositório Restic"
restic backup --tag elyon-db-hourly "$dump_path" "$checksum_path"
snapshot_id=$(restic snapshots --tag elyon-db-hourly --latest 1 --json \
  | sed -n 's/.*"short_id":"\([^"]*\)".*/\1/p' | head -1)
snapshot_id=${snapshot_id:-unknown}

restic forget --tag elyon-db-hourly --keep-hourly 48 --keep-daily 30 --keep-monthly 6
if [[ $(date -u +%H) == 03 ]]; then
  restic prune
  restic check --read-data-subset=1/100
fi

# O R2/Restic mantém a retenção histórica. Localmente, conservamos apenas os
# dumps mais recentes para não duplicar dezenas de gigabytes na VPS.
mapfile -t local_dumps < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'elyon-*.sql.gz' -printf '%f\n' | sort -r
)
for old_dump in "${local_dumps[@]:$LOCAL_BACKUP_KEEP}"; do
  rm -f -- "$BACKUP_DIR/$old_dump" "$BACKUP_DIR/$old_dump.sha256"
done
LAST_SUCCESS=$(date +%s)
write_status 1 "$snapshot_id"
logger -t elyon-offhost-backup -- \
  "status=success snapshot=$snapshot_id bytes=$DUMP_BYTES duration=$((LAST_SUCCESS - STARTED_AT))"
log "backup off-host concluído (snapshot=$snapshot_id, bytes=$DUMP_BYTES)"
