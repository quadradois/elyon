#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./offhost-common.sh
source "$SCRIPT_DIR/offhost-common.sh"

mode=''
confirmed=false

usage() {
  cat <<'EOF'
Uso:
  sudo ./scripts/ops/run-offhost-backup.sh --check
  sudo ./scripts/ops/run-offhost-backup.sh --apply --confirm-offhost-write

O modo --check valida configuracao, repositorio e ultimo dump sem criar snapshot.
EOF
}

while (($#)); do
  case "$1" in
    --check|--apply) [[ -z "$mode" ]] || offhost_fail 'informe apenas um modo'; mode="$1" ;;
    --confirm-offhost-write) confirmed=true ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; offhost_fail "argumento invalido: $1"; exit 2 ;;
  esac
  shift
done

[[ -n "$mode" ]] || { usage >&2; offhost_fail 'informe --check ou --apply'; exit 2; }
[[ $(id -u) -eq 0 ]] || { offhost_fail 'execute como root'; exit 1; }

offhost_load_config
command -v docker >/dev/null || offhost_fail 'docker nao encontrado'
command -v flock >/dev/null || offhost_fail 'flock nao encontrado'
command -v gzip >/dev/null || offhost_fail 'gzip nao encontrado'
command -v python3 >/dev/null || offhost_fail 'python3 nao encontrado'

readonly BACKUP_CONTAINER="${OFFHOST_LOCAL_BACKUP_CONTAINER:-elyon_backup}"
readonly BACKUP_ROOT="${OFFHOST_LOCAL_BACKUP_ROOT:-/root/elyon/backups}"
readonly RPO_HOURS="${OFFHOST_RPO_HOURS:-24}"
readonly RTO_HOURS="${OFFHOST_RTO_HOURS:-4}"
readonly CHECK_INTERVAL_HOURS="${OFFHOST_REPOSITORY_CHECK_INTERVAL_HOURS:-24}"
readonly LOCK_FILE="${OFFHOST_LOCK_FILE:-/var/lock/elyon-offhost-backup.lock}"
STATE_DIR=$(offhost_state_dir)
readonly STATE_DIR

offhost_require_positive_integer OFFHOST_RPO_HOURS "$RPO_HOURS"
offhost_require_positive_integer OFFHOST_RTO_HOURS "$RTO_HOURS"
offhost_require_positive_integer OFFHOST_REPOSITORY_CHECK_INTERVAL_HOURS "$CHECK_INTERVAL_HOURS"
[[ -d "$BACKUP_ROOT" ]] || offhost_fail "diretorio de backup ausente: $BACKUP_ROOT"
docker inspect "$BACKUP_CONTAINER" >/dev/null 2>&1 || offhost_fail "container ausente: $BACKUP_CONTAINER"
[[ $(docker inspect --format '{{.State.Running}}' "$BACKUP_CONTAINER") == true ]] || \
  offhost_fail "container parado: $BACKUP_CONTAINER"

latest_dump() {
  find "$BACKUP_ROOT/last" -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' \
    | sort -nr | awk 'NR == 1 {sub(/^[^ ]+ /, ""); print; exit}'
}

restic cat config >/dev/null
dump=$(latest_dump)
[[ -n "$dump" && -s "$dump" ]] || offhost_fail 'nenhum dump local valido encontrado'
gzip -t "$dump"

if [[ "$mode" == '--check' ]]; then
  size=$(stat -c '%s' "$dump")
  echo "CHECK_OK destination=off-host encrypted=true dump_size_bytes=$size rpo_hours=$RPO_HOURS rto_hours=$RTO_HOURS"
  echo 'Nenhum snapshot, arquivo, container ou agenda foi alterado.'
  exit 0
fi

[[ "$confirmed" == true ]] || { offhost_fail '--apply exige --confirm-offhost-write'; exit 2; }
install -d -m 0700 "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || offhost_fail 'outro backup off-host esta em execucao'

started_epoch=$(date +%s)
started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
completed=false

on_exit() {
  local rc=$?
  if [[ "$completed" != true ]]; then
    umask 077
    printf 'status=failed\nstarted_utc=%s\nfailed_utc=%s\nexit_code=%s\n' \
      "$started_utc" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$rc" > "$STATE_DIR/latest.env"
    offhost_alert CRITICAL "event=backup_failed exit_code=$rc" || true
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker exec "$BACKUP_CONTAINER" /backup.sh
dump=$(latest_dump)
[[ -n "$dump" && -s "$dump" ]] || offhost_fail 'backup local nao produziu dump'
gzip -t "$dump"

paths=("$dump")
if [[ -n "${OFFHOST_EXTRA_PATHS:-}" ]]; then
  read -r -a extra_paths <<<"$OFFHOST_EXTRA_PATHS"
  for path in "${extra_paths[@]}"; do
    [[ -e "$path" ]] || offhost_fail "caminho extra ausente: $path"
    paths+=("$path")
  done
fi

restic backup --host "$(hostname)" --tag "${OFFHOST_RESTIC_TAG:-elyon-postgres}" "${paths[@]}"
restic forget --tag "${OFFHOST_RESTIC_TAG:-elyon-postgres}" \
  --keep-daily "${OFFHOST_KEEP_DAILY:-7}" \
  --keep-weekly "${OFFHOST_KEEP_WEEKLY:-4}" \
  --keep-monthly "${OFFHOST_KEEP_MONTHLY:-6}" --prune

check_stamp="$STATE_DIR/repository-check.epoch"
last_check=0
[[ -f "$check_stamp" ]] && read -r last_check < "$check_stamp"
if [[ ! "$last_check" =~ ^[0-9]+$ ]] || ((started_epoch - last_check >= CHECK_INTERVAL_HOURS * 3600)); then
  restic check
  printf '%s\n' "$(date +%s)" > "$check_stamp"
fi

snapshot_json=$(offhost_latest_snapshot_json)
snapshot_id=$(printf '%s' "$snapshot_json" | offhost_snapshot_field id)
snapshot_time=$(printf '%s' "$snapshot_json" | offhost_snapshot_field time)
[[ -n "$snapshot_id" && -n "$snapshot_time" ]] || offhost_fail 'snapshot criado nao foi localizado'

completed_epoch=$(date +%s)
duration_seconds=$((completed_epoch - started_epoch))
umask 077
printf 'status=success\nstarted_utc=%s\ncompleted_utc=%s\nduration_seconds=%s\nsnapshot_id=%s\nsnapshot_time=%s\ndump_size_bytes=%s\nrpo_hours=%s\nrto_hours=%s\n' \
  "$started_utc" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$duration_seconds" \
  "$snapshot_id" "$snapshot_time" "$(stat -c '%s' "$dump")" "$RPO_HOURS" "$RTO_HOURS" \
  > "$STATE_DIR/latest.env"

completed=true
trap - EXIT INT TERM
offhost_log OK "event=backup_success snapshot=${snapshot_id:0:8} duration_seconds=$duration_seconds"
