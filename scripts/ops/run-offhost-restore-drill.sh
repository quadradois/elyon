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
  sudo ./scripts/ops/run-offhost-restore-drill.sh --check
  sudo ./scripts/ops/run-offhost-restore-drill.sh --apply --confirm-isolated-restore

O restore usa container sem rede, banco em tmpfs e nunca conecta ao PostgreSQL de producao.
EOF
}

while (($#)); do
  case "$1" in
    --check|--apply) [[ -z "$mode" ]] || offhost_fail 'informe apenas um modo'; mode="$1" ;;
    --confirm-isolated-restore) confirmed=true ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; offhost_fail "argumento invalido: $1"; exit 2 ;;
  esac
  shift
done

[[ -n "$mode" ]] || { usage >&2; offhost_fail 'informe --check ou --apply'; exit 2; }
[[ $(id -u) -eq 0 ]] || { offhost_fail 'execute como root'; exit 1; }

offhost_load_config
for command_name in docker python3 gzip sha256sum openssl flock df realpath seq; do
  command -v "$command_name" >/dev/null || offhost_fail "$command_name nao encontrado"
done

readonly RTO_HOURS="${OFFHOST_RTO_HOURS:-4}"
readonly POSTGRES_IMAGE="${OFFHOST_RESTORE_IMAGE:-pgvector/pgvector:0.8.0-pg15}"
readonly TMPFS_SIZE="${OFFHOST_RESTORE_TMPFS_SIZE:-6g}"
readonly SOURCE_ROLE="${OFFHOST_SOURCE_DB_USER:-elyon_user}"
STATE_DIR=$(offhost_state_dir)
readonly STATE_DIR
readonly WORK_ROOT="${OFFHOST_RESTORE_WORK_ROOT:-$STATE_DIR/restore-work}"
readonly RESTORE_FS_PATH="${OFFHOST_RESTORE_FS_PATH:-/var/lib}"
readonly LOCK_FILE="${OFFHOST_RESTORE_LOCK_FILE:-/var/lock/elyon-offhost-restore-drill.lock}"

offhost_require_positive_integer OFFHOST_RTO_HOURS "$RTO_HOURS"
[[ "$SOURCE_ROLE" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || offhost_fail 'OFFHOST_SOURCE_DB_USER invalido'
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 || \
  offhost_fail "imagem de restore ausente; nao sera feito pull automatico: $POSTGRES_IMAGE"

snapshot_json=$(offhost_latest_snapshot_json)
snapshot_id=$(printf '%s' "$snapshot_json" | offhost_snapshot_field id)
snapshot_time=$(printf '%s' "$snapshot_json" | offhost_snapshot_field time)
[[ -n "$snapshot_id" && -n "$snapshot_time" ]] || offhost_fail 'snapshot off-host ausente'

dump_metadata=$(restic ls "$snapshot_id" --json | python3 -c '
import json, sys
files=[]
for line in sys.stdin:
    item=json.loads(line)
    path=item.get("path", "")
    if item.get("type") == "file" and "/backups/" in path and path.endswith(".sql.gz"):
        files.append(item)
if not files:
    raise SystemExit("dump .sql.gz nao encontrado no snapshot")
chosen=max(files, key=lambda item: item.get("mtime", ""))
print("{}\t{}".format(chosen.get("path", ""), chosen.get("size", 0)))
')
dump_path=${dump_metadata%%$'\t'*}
dump_size=${dump_metadata##*$'\t'}
[[ -n "$dump_path" && "$dump_size" =~ ^[1-9][0-9]*$ ]] || offhost_fail 'metadados do dump invalidos'

[[ -d "$RESTORE_FS_PATH" ]] || offhost_fail "filesystem de trabalho ausente: $RESTORE_FS_PATH"
free_bytes=$(df -PB1 "$RESTORE_FS_PATH" | awk 'NR == 2 {print $4}')
required_bytes=$((dump_size + 512 * 1024 * 1024))
((free_bytes >= required_bytes)) || offhost_fail \
  "espaco insuficiente para dump criptografado restaurado: livre=$free_bytes requerido=$required_bytes"

echo "CHECK_OK snapshot=${snapshot_id:0:8} snapshot_time=$snapshot_time dump_size_bytes=$dump_size image=$POSTGRES_IMAGE rto_hours=$RTO_HOURS"
echo 'Isolamento: container sem rede, PostgreSQL em tmpfs, nenhum volume de producao montado.'
if [[ "$mode" == '--check' ]]; then
  echo 'Nenhum snapshot, arquivo, container, banco ou volume foi alterado.'
  exit 0
fi

[[ "$confirmed" == true ]] || { offhost_fail '--apply exige --confirm-isolated-restore'; exit 2; }
install -d -m 0700 "$WORK_ROOT" "$STATE_DIR/restore-drills"
exec 9>"$LOCK_FILE"
flock -n 9 || offhost_fail 'outro restore drill esta em execucao'

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
container="elyon_restore_drill_${timestamp}_$$"
work_dir="$WORK_ROOT/$timestamp"
dump_file="$work_dir/database.sql.gz"
evidence_file="$STATE_DIR/restore-drills/${timestamp}.env"
password=$(openssl rand -hex 24)
started_epoch=$(date +%s)
started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
completed=false

work_root_canonical=$(realpath -m "$WORK_ROOT")
work_dir_canonical=$(realpath -m "$work_dir")
case "$work_dir_canonical" in
  "$work_root_canonical"/*) ;;
  *) offhost_fail "diretorio temporario fora da raiz esperada: $work_dir_canonical" ;;
esac

cleanup() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir_canonical"
  unset password
}

on_exit() {
  local rc=$?
  if [[ "$completed" != true ]]; then
    umask 077
    printf 'status=failed\nstarted_utc=%s\nfailed_utc=%s\nexit_code=%s\nsnapshot_id=%s\n' \
      "$started_utc" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$rc" "$snapshot_id" > "$evidence_file"
    offhost_alert CRITICAL "event=restore_drill_failed snapshot=${snapshot_id:0:8} exit_code=$rc"
  fi
  cleanup
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

install -d -m 0700 "$work_dir"
umask 077
restic dump "$snapshot_id" "$dump_path" > "$dump_file"
[[ $(stat -c '%s' "$dump_file") -eq "$dump_size" ]] || offhost_fail 'tamanho restaurado diverge do snapshot'
gzip -t "$dump_file"
checksum=$(sha256sum "$dump_file" | awk '{print $1}')

docker run -d --rm \
  --name "$container" \
  --network none \
  --tmpfs "/var/lib/postgresql/data:rw,size=$TMPFS_SIZE,mode=0700" \
  -e POSTGRES_USER=elyon_restore \
  -e POSTGRES_PASSWORD="$password" \
  -e POSTGRES_DB=elyon_restore_drill \
  "$POSTGRES_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U elyon_restore -d elyon_restore_drill >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$container" pg_isready -U elyon_restore -d elyon_restore_drill >/dev/null
docker exec "$container" psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore_drill \
  -c "CREATE ROLE \"$SOURCE_ROLE\";" >/dev/null

gzip -dc "$dump_file" | docker exec -i "$container" \
  psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore_drill >/dev/null

table_count=$(docker exec "$container" psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore_drill -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
migration_count=$(docker exec "$container" psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore_drill -Atc \
  "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL;")
critical_tables=$(docker exec "$container" psql -v ON_ERROR_STOP=1 -U elyon_restore -d elyon_restore_drill -Atc \
  "SELECT count(*) FROM (VALUES ('tenants'),('usuarios'),('leads'),('webhook_eventos')) AS expected(name) WHERE to_regclass('public.' || name) IS NOT NULL;")

[[ "$table_count" =~ ^[1-9][0-9]*$ ]] || offhost_fail 'restore sem tabelas publicas'
[[ "$migration_count" =~ ^[1-9][0-9]*$ ]] || offhost_fail 'restore sem migrations concluidas'
[[ "$critical_tables" == '4' ]] || offhost_fail "restore sem todas as tabelas criticas: $critical_tables/4"

completed_epoch=$(date +%s)
duration_seconds=$((completed_epoch - started_epoch))
rto_seconds=$((RTO_HOURS * 3600))
((duration_seconds <= rto_seconds)) || offhost_fail \
  "restore excedeu RTO: duracao=$duration_seconds limite=$rto_seconds"

umask 077
printf 'status=success\nstarted_utc=%s\ncompleted_utc=%s\nduration_seconds=%s\nrto_seconds=%s\nsnapshot_id=%s\nsnapshot_time=%s\ndump_path=%s\ndump_size_bytes=%s\nsha256=%s\npublic_tables=%s\nfinished_migrations=%s\ncritical_tables=%s\nisolated_network=none\nstorage=tmpfs\n' \
  "$started_utc" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$duration_seconds" "$rto_seconds" \
  "$snapshot_id" "$snapshot_time" "$dump_path" "$dump_size" "$checksum" \
  "$table_count" "$migration_count" "$critical_tables" > "$evidence_file"

completed=true
trap - EXIT INT TERM
cleanup
offhost_alert OK "event=restore_drill_success snapshot=${snapshot_id:0:8} duration_seconds=$duration_seconds rto_seconds=$rto_seconds tables=$table_count migrations=$migration_count"
echo "EVIDENCE_FILE=$evidence_file"
