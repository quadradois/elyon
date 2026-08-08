#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/ops/backup-offhost-r2.sh"

grep -q -- 'restic forget --tag elyon-db-hourly --group-by host,tags --keep-hourly 48 --keep-daily 30 --keep-monthly 6' "$SCRIPT"

if grep -q -- 'restic forget --tag elyon-db-hourly --keep-hourly' "$SCRIPT"; then
  echo 'backup-offhost-r2: restic forget sem --group-by host,tags encontrado' >&2
  exit 1
fi

echo 'backup-offhost-r2: retenção remota usa group-by host,tags'
