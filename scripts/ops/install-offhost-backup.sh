#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ELYON_ROOT_DIR:-/root/elyon}
ENV_FILE=${ELYON_BACKUP_ENV_FILE:-/root/backup_r2.env}

[[ $(id -u) -eq 0 ]] || { echo 'Execute como root.' >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Credenciais ausentes: $ENV_FILE" >&2; exit 1; }
command -v restic >/dev/null || { echo 'restic não está instalado.' >&2; exit 1; }

install -d -m 0750 "$ROOT_DIR/backups/offhost"
install -d -m 0755 "$ROOT_DIR/backups/status" /var/lib/elyon/restore-drills
chmod 0700 "$ROOT_DIR/scripts/ops/backup-offhost-r2.sh" "$ROOT_DIR/scripts/ops/restore-drill-r2.sh"
install -m 0644 "$ROOT_DIR/ops/systemd/elyon-offhost-backup.service" /etc/systemd/system/
install -m 0644 "$ROOT_DIR/ops/systemd/elyon-offhost-backup.timer" /etc/systemd/system/

if crontab -l 2>/dev/null | grep -qF '/root/backup_r2.sh'; then
  crontab -l 2>/dev/null | grep -vF '/root/backup_r2.sh' | crontab -
fi

systemctl daemon-reload
systemctl enable --now elyon-offhost-backup.timer
systemctl is-enabled --quiet elyon-offhost-backup.timer
systemctl is-active --quiet elyon-offhost-backup.timer
echo 'Timer de backup off-host instalado e ativo.'
