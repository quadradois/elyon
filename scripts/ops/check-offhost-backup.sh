#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./offhost-common.sh
source "$SCRIPT_DIR/offhost-common.sh"

[[ $(id -u) -eq 0 ]] || { offhost_fail 'execute como root'; exit 1; }
offhost_load_config
command -v python3 >/dev/null || offhost_fail 'python3 nao encontrado'

readonly RPO_HOURS="${OFFHOST_RPO_HOURS:-24}"
readonly GRACE_MINUTES="${OFFHOST_AGE_GRACE_MINUTES:-30}"
STATE_DIR=$(offhost_state_dir)
readonly STATE_DIR
offhost_require_positive_integer OFFHOST_RPO_HOURS "$RPO_HOURS"
[[ "$GRACE_MINUTES" =~ ^[0-9]+$ ]] || offhost_fail 'OFFHOST_AGE_GRACE_MINUTES deve ser inteiro nao negativo'

install -d -m 0700 "$STATE_DIR"
snapshot_json=$(offhost_latest_snapshot_json)
snapshot_id=$(printf '%s' "$snapshot_json" | offhost_snapshot_field id)
snapshot_time=$(printf '%s' "$snapshot_json" | offhost_snapshot_field time)
[[ -n "$snapshot_id" && -n "$snapshot_time" ]] || offhost_fail 'nenhum snapshot off-host encontrado'

snapshot_epoch=$(python3 -c 'from datetime import datetime; import sys; print(int(datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00")).timestamp()))' "$snapshot_time")
now_epoch=$(date +%s)
age_seconds=$((now_epoch - snapshot_epoch))
max_age_seconds=$((RPO_HOURS * 3600 + GRACE_MINUTES * 60))

umask 077
printf 'checked_utc=%s\nsnapshot_id=%s\nsnapshot_time=%s\nage_seconds=%s\nmax_age_seconds=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$snapshot_id" "$snapshot_time" \
  "$age_seconds" "$max_age_seconds" > "$STATE_DIR/freshness.env"

status_file="$STATE_DIR/freshness.status"
previous_status='unknown'
[[ -f "$status_file" ]] && read -r previous_status < "$status_file"

if ((age_seconds > max_age_seconds)); then
  printf 'stale\n' > "$status_file"
  offhost_alert CRITICAL "event=backup_stale snapshot=${snapshot_id:0:8} age_seconds=$age_seconds max_age_seconds=$max_age_seconds"
  exit 1
fi

printf 'fresh\n' > "$status_file"
if [[ "$previous_status" == 'stale' ]]; then
  offhost_alert OK "event=backup_fresh_recovered snapshot=${snapshot_id:0:8} age_seconds=$age_seconds max_age_seconds=$max_age_seconds"
else
  offhost_log OK "event=backup_fresh snapshot=${snapshot_id:0:8} age_seconds=$age_seconds max_age_seconds=$max_age_seconds"
fi
