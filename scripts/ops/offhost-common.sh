#!/usr/bin/env bash

offhost_fail() {
  echo "ERRO: $*" >&2
  return 1
}

offhost_load_config() {
  local env_file="${OFFHOST_ENV_FILE:-/etc/elyon/offhost-backup.env}"
  [[ -f "$env_file" ]] || offhost_fail "configuracao ausente: $env_file"

  local mode
  mode=$(stat -c '%a' "$env_file")
  [[ "$mode" == '600' || "$mode" == '400' ]] || \
    offhost_fail "permissao insegura em $env_file: $mode (esperado 600 ou 400)"

  # shellcheck disable=SC1090
  source "$env_file"

  export RESTIC_CACHE_DIR="${RESTIC_CACHE_DIR:-/var/cache/elyon-restic}"

  command -v restic >/dev/null || offhost_fail 'restic nao encontrado'
  command -v curl >/dev/null || offhost_fail 'curl nao encontrado'
  command -v logger >/dev/null || offhost_fail 'logger nao encontrado'
  command -v python3 >/dev/null || offhost_fail 'python3 nao encontrado'
  [[ -n "${RESTIC_REPOSITORY:-}" ]] || offhost_fail 'RESTIC_REPOSITORY ausente'
  if [[ -z "${RESTIC_PASSWORD:-}" && -z "${RESTIC_PASSWORD_FILE:-}" ]]; then
    offhost_fail 'RESTIC_PASSWORD ou RESTIC_PASSWORD_FILE ausente'
  fi
}

offhost_state_dir() {
  printf '%s\n' "${OFFHOST_STATE_DIR:-/var/lib/elyon-offhost-backup}"
}

offhost_log() {
  local level="$1"
  shift
  local message
  message="ELYON_OFFHOST_BACKUP level=${level} host=$(hostname) $*"
  local priority='daemon.info'
  [[ "$level" == 'WARNING' ]] && priority='daemon.warning'
  [[ "$level" == 'CRITICAL' ]] && priority='daemon.crit'

  echo "$message"
  logger -t elyon-offhost-backup -p "$priority" -- "$message"
}

offhost_alert() {
  local level="$1"
  shift
  local message
  message="ELYON_OFFHOST_BACKUP level=${level} host=$(hostname) $*"

  offhost_log "$level" "$*"

  local webhook="${OFFHOST_ALERT_WEBHOOK_URL:-${DISK_ALERT_WEBHOOK_URL:-}}"
  if [[ -n "$webhook" ]]; then
    local field="${OFFHOST_ALERT_WEBHOOK_FIELD:-text}"
    [[ "$field" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || \
      offhost_fail 'OFFHOST_ALERT_WEBHOOK_FIELD invalido'
    local payload
    payload=$(python3 -c 'import json,sys; print(json.dumps({sys.argv[1]: sys.argv[2]}))' \
      "$field" "$message")
    if ! curl --fail --silent --show-error --max-time 15 \
      -H 'Content-Type: application/json' \
      --data "$payload" "$webhook" >/dev/null; then
      offhost_log CRITICAL 'event=external_alert_delivery_failed'
      return 1
    fi
  fi
}

offhost_require_positive_integer() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || offhost_fail "$name deve ser inteiro positivo"
}

offhost_latest_snapshot_json() {
  local tag="${OFFHOST_RESTIC_TAG:-elyon-postgres}"
  local snapshots
  snapshots=$(restic snapshots --latest 1 --tag "$tag" --json)
  if [[ "$snapshots" == '[]' ]]; then
    snapshots=$(restic snapshots --latest 1 --json)
  fi
  printf '%s\n' "$snapshots"
}

offhost_snapshot_field() {
  local field="$1"
  python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[-1][sys.argv[1]] if data else "")' "$field"
}
