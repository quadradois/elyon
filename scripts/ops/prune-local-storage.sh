#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=${ELYON_ROOT_DIR:-/root/elyon}
BACKUP_ROOT=${ELYON_BACKUP_ROOT:-$ROOT_DIR/backups}
DISK_MOUNTPOINT=${ELYON_DISK_MOUNTPOINT:-/}
DOCKER_PRUNE_THRESHOLD=${ELYON_DOCKER_PRUNE_THRESHOLD:-85}
JOURNAL_MAX_SIZE=${ELYON_JOURNAL_MAX_SIZE:-500M}
SKIP_JOURNAL_VACUUM=${ELYON_SKIP_JOURNAL_VACUUM:-0}

log() { printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$*"; }

keep_newest() {
  local directory="$1" pattern="$2" keep="$3"
  [[ -d "$directory" ]] || return 0

  mapfile -d '' files < <(
    find "$directory" -maxdepth 1 -type f -name "$pattern" \
      -printf '%T@ %p\0' | sort -z -nr
  )

  local index entry path
  for ((index = keep; index < ${#files[@]}; index++)); do
    entry=${files[$index]}
    path=${entry#* }
    [[ -n "$path" ]] && rm -f -- "$path"
  done
}

install -d -m 0750 "$BACKUP_ROOT"

# Retenção local curta para restauração rápida; o histórico longo fica no R2.
keep_newest "$BACKUP_ROOT/last" 'elyon-*.sql.gz' 2
keep_newest "$BACKUP_ROOT/daily" 'elyon-*.sql.gz' 3
keep_newest "$BACKUP_ROOT/weekly" 'elyon-*.sql.gz' 2
keep_newest "$BACKUP_ROOT/monthly" 'elyon-*.sql.gz' 2

# Parciais interrompidos não são restauráveis.
find "$BACKUP_ROOT/offhost" -maxdepth 1 -type f -name '*.tmp' -mmin +120 -delete 2>/dev/null || true

used_percent=$(df --output=pcent "$DISK_MOUNTPOINT" | tail -1 | tr -dc '0-9')
if [[ -n "$used_percent" && "$used_percent" -ge "$DOCKER_PRUNE_THRESHOLD" ]]; then
  log "uso de disco em ${used_percent}%; removendo cache de build e imagens dangling"
  docker builder prune -af >/dev/null
  docker image prune -f >/dev/null
fi

if [[ "$SKIP_JOURNAL_VACUUM" != 1 ]] && command -v journalctl >/dev/null; then
  journalctl --vacuum-size="$JOURNAL_MAX_SIZE" >/dev/null
fi

log "manutenção concluída: uso=$(df --output=pcent "$DISK_MOUNTPOINT" | tail -1 | xargs)"
