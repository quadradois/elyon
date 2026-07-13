#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute como root." >&2
  exit 1
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

install -d -m 0750 /etc/elyon
install -m 0755 "$ROOT_DIR/scripts/ops/check-disk-usage.sh" \
  /usr/local/sbin/elyon-check-disk-usage
install -m 0644 "$ROOT_DIR/scripts/ops/elyon-docker-logs.logrotate" \
  /etc/logrotate.d/elyon-docker-containers
install -m 0644 "$ROOT_DIR/scripts/systemd/elyon-disk-monitor.service" \
  /etc/systemd/system/elyon-disk-monitor.service
install -m 0644 "$ROOT_DIR/scripts/systemd/elyon-disk-monitor.timer" \
  /etc/systemd/system/elyon-disk-monitor.timer

systemd-analyze verify /etc/systemd/system/elyon-disk-monitor.service \
  /etc/systemd/system/elyon-disk-monitor.timer
logrotate --debug /etc/logrotate.d/elyon-docker-containers >/dev/null
systemctl daemon-reload
systemctl enable --now elyon-disk-monitor.timer
systemctl start elyon-disk-monitor.service

echo "Guardrails operacionais instalados."
systemctl --no-pager status elyon-disk-monitor.timer || true
cat /var/lib/elyon-disk-monitor/latest
