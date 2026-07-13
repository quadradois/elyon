#!/usr/bin/env bash
set -euo pipefail

MOUNTPOINT="${DISK_MOUNTPOINT:-/}"
WARNING_PERCENT="${DISK_WARNING_PERCENT:-80}"
CRITICAL_PERCENT="${DISK_CRITICAL_PERCENT:-90}"
STATE_DIR="${STATE_DIRECTORY:-/var/lib/elyon-disk-monitor}"

for value in "$WARNING_PERCENT" "$CRITICAL_PERCENT"; do
  [[ "$value" =~ ^[0-9]+$ ]] || { echo "Threshold inválido: $value" >&2; exit 2; }
done

if (( WARNING_PERCENT >= CRITICAL_PERCENT || CRITICAL_PERCENT > 100 )); then
  echo "Thresholds inválidos: warning=$WARNING_PERCENT critical=$CRITICAL_PERCENT" >&2
  exit 2
fi

used_percent=$(df -P "$MOUNTPOINT" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')
available=$(df -Ph "$MOUNTPOINT" | awk 'NR == 2 { print $4 }')

level="OK"
priority="daemon.info"
if (( used_percent >= CRITICAL_PERCENT )); then
  level="CRITICAL"
  priority="daemon.crit"
elif (( used_percent >= WARNING_PERCENT )); then
  level="WARNING"
  priority="daemon.warning"
fi

message="ELYON_DISK_STATUS level=$level mount=$MOUNTPOINT used_percent=$used_percent available=$available host=$(hostname)"
echo "$message"
logger -t elyon-disk-monitor -p "$priority" -- "$message"

install -d -m 0750 "$STATE_DIR"
printf '%s\n' "$message" > "$STATE_DIR/latest"

if [[ "$level" != "OK" && -n "${DISK_ALERT_WEBHOOK_URL:-}" ]]; then
  curl --fail --silent --show-error --max-time 10 \
    -H 'Content-Type: application/json' \
    --data "{\"text\":\"$message\"}" \
    "$DISK_ALERT_WEBHOOK_URL" >/dev/null
fi
