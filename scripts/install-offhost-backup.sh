#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
RPO_HOURS=''
RTO_HOURS=''
approved=false
disable_legacy_cron=false
legacy_env='/root/backup_r2.env'

usage() {
  cat <<'EOF'
Uso:
  sudo ./scripts/install-offhost-backup.sh \
    --rpo-hours 6 --rto-hours 4 --approve-objectives \
    --disable-legacy-cron

Opcoes:
  --legacy-env CAMINHO       Configuracao Restic atual (default /root/backup_r2.env)
  --disable-legacy-cron      Remove apenas a linha exata que chama /root/backup_r2.sh

O instalador recusa ativar timers sem aprovacao explicita de RPO/RTO.
EOF
}

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

while (($#)); do
  case "$1" in
    --rpo-hours) shift; RPO_HOURS="${1:-}" ;;
    --rto-hours) shift; RTO_HOURS="${1:-}" ;;
    --approve-objectives) approved=true ;;
    --disable-legacy-cron) disable_legacy_cron=true ;;
    --legacy-env) shift; legacy_env="${1:-}" ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; fail "argumento invalido: $1" ;;
  esac
  shift
done

[[ $(id -u) -eq 0 ]] || fail 'execute como root'
[[ "$approved" == true ]] || fail 'use --approve-objectives somente apos aprovacao do negocio'
[[ "$RPO_HOURS" =~ ^[1-9][0-9]*$ ]] || fail '--rpo-hours deve ser inteiro positivo'
[[ "$RTO_HOURS" =~ ^[1-9][0-9]*$ ]] || fail '--rto-hours deve ser inteiro positivo'
[[ -f "$legacy_env" ]] || fail "configuracao Restic ausente: $legacy_env"
[[ $(stat -c '%a' "$legacy_env") == '600' || $(stat -c '%a' "$legacy_env") == '400' ]] || \
  fail "configuracao Restic deve ter modo 600 ou 400: $legacy_env"

for command_name in systemctl systemd-analyze restic docker crontab; do
  command -v "$command_name" >/dev/null || fail "$command_name nao encontrado"
done

install -d -m 0700 /etc/elyon /usr/local/libexec/elyon \
  /var/lib/elyon-offhost-backup /var/cache/elyon-restic
install -m 0700 "$ROOT_DIR/scripts/ops/offhost-common.sh" /usr/local/libexec/elyon/offhost-common.sh
install -m 0700 "$ROOT_DIR/scripts/ops/run-offhost-backup.sh" /usr/local/libexec/elyon/run-offhost-backup.sh
install -m 0700 "$ROOT_DIR/scripts/ops/check-offhost-backup.sh" /usr/local/libexec/elyon/check-offhost-backup.sh
install -m 0700 "$ROOT_DIR/scripts/ops/run-offhost-restore-drill.sh" /usr/local/libexec/elyon/run-offhost-restore-drill.sh
install -m 0700 "$ROOT_DIR/scripts/ops/test-offhost-alert.sh" /usr/local/libexec/elyon/test-offhost-alert.sh

config_tmp=$(mktemp)
cron_current=$(mktemp)
cron_new=$(mktemp)
cleanup() { rm -f "$config_tmp" "$cron_current" "$cron_new"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

grep -Ev '^[[:space:]]*(export[[:space:]]+)?OFFHOST_(RPO|RTO)_HOURS=' "$legacy_env" > "$config_tmp"
printf '\nexport OFFHOST_RPO_HOURS=%s\nexport OFFHOST_RTO_HOURS=%s\n' "$RPO_HOURS" "$RTO_HOURS" >> "$config_tmp"
if ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?OFFHOST_EXTRA_PATHS=' "$config_tmp"; then
  extra_paths=()
  [[ -f /root/elyon/.env ]] && extra_paths+=(/root/elyon/.env)
  [[ -d /root/elyon/secrets ]] && extra_paths+=(/root/elyon/secrets)
  if ((${#extra_paths[@]})); then
    printf 'export OFFHOST_EXTRA_PATHS=%q\n' "${extra_paths[*]}" >> "$config_tmp"
  fi
fi
install -m 0600 -o root -g root "$config_tmp" /etc/elyon/offhost-backup.env

set -a
# shellcheck disable=SC1091
source /etc/elyon/offhost-backup.env
set +a
[[ -n "${OFFHOST_ALERT_WEBHOOK_URL:-${DISK_ALERT_WEBHOOK_URL:-}}" ]] || \
  fail 'configure OFFHOST_ALERT_WEBHOOK_URL antes de ativar os timers'

install -m 0644 "$ROOT_DIR/scripts/systemd/elyon-offhost-backup.service" /etc/systemd/system/elyon-offhost-backup.service
install -m 0644 "$ROOT_DIR/scripts/systemd/elyon-offhost-backup.timer" /etc/systemd/system/elyon-offhost-backup.timer
install -m 0644 "$ROOT_DIR/scripts/systemd/elyon-offhost-freshness.service" /etc/systemd/system/elyon-offhost-freshness.service
install -m 0644 "$ROOT_DIR/scripts/systemd/elyon-offhost-freshness.timer" /etc/systemd/system/elyon-offhost-freshness.timer

install -d -m 0755 /etc/systemd/system/elyon-offhost-backup.timer.d
cat > /etc/systemd/system/elyon-offhost-backup.timer.d/schedule.conf <<EOF
[Timer]
OnUnitActiveSec=
OnUnitActiveSec=${RPO_HOURS}h
EOF

systemd-analyze verify \
  /etc/systemd/system/elyon-offhost-backup.service \
  /etc/systemd/system/elyon-offhost-backup.timer \
  /etc/systemd/system/elyon-offhost-freshness.service \
  /etc/systemd/system/elyon-offhost-freshness.timer

OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  /usr/local/libexec/elyon/run-offhost-backup.sh --check
OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  /usr/local/libexec/elyon/run-offhost-restore-drill.sh --check
OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  /usr/local/libexec/elyon/test-offhost-alert.sh

if [[ "$disable_legacy_cron" == true ]]; then
  crontab -l > "$cron_current" 2>/dev/null || true
  grep -Fv '/root/backup_r2.sh' "$cron_current" > "$cron_new" || true
  install -m 0600 "$cron_current" "/var/lib/elyon-offhost-backup/crontab-before-migration-$(date -u +%Y%m%dT%H%M%SZ)"
  crontab "$cron_new"
elif crontab -l 2>/dev/null | grep -Fq '/root/backup_r2.sh'; then
  fail 'cron legado ainda ativo; repita com --disable-legacy-cron para evitar backups duplicados'
fi

systemctl daemon-reload
systemctl enable --now elyon-offhost-backup.timer elyon-offhost-freshness.timer
systemctl start elyon-offhost-backup.service
systemctl start elyon-offhost-freshness.service

echo "Instalacao concluida com RPO=${RPO_HOURS}h RTO=${RTO_HOURS}h."
systemctl --no-pager list-timers 'elyon-offhost-*'
