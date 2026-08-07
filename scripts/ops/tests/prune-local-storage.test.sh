#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT

for directory in last daily weekly monthly offhost; do
  mkdir -p "$TEST_ROOT/backups/$directory"
done

for directory in last daily weekly monthly; do
  for number in 1 2 3 4 5; do
    file="$TEST_ROOT/backups/$directory/elyon-2026080${number}.sql.gz"
    touch -d "2026-08-0${number} 00:00:00" "$file"
  done
  ln -s "elyon-20260805.sql.gz" "$TEST_ROOT/backups/$directory/elyon-latest.sql.gz"
done
touch -d '3 hours ago' "$TEST_ROOT/backups/offhost/interrompido.tmp"

ELYON_ROOT_DIR="$TEST_ROOT" \
ELYON_DOCKER_PRUNE_THRESHOLD=101 \
ELYON_SKIP_JOURNAL_VACUUM=1 \
  bash "$ROOT_DIR/scripts/ops/prune-local-storage.sh"

[[ $(find "$TEST_ROOT/backups/last" -maxdepth 1 -type f | wc -l) -eq 2 ]]
[[ $(find "$TEST_ROOT/backups/daily" -maxdepth 1 -type f | wc -l) -eq 3 ]]
[[ $(find "$TEST_ROOT/backups/weekly" -maxdepth 1 -type f | wc -l) -eq 2 ]]
[[ $(find "$TEST_ROOT/backups/monthly" -maxdepth 1 -type f | wc -l) -eq 2 ]]
[[ $(find "$TEST_ROOT/backups/offhost" -maxdepth 1 -type f | wc -l) -eq 0 ]]

for directory in last daily weekly monthly; do
  [[ -L "$TEST_ROOT/backups/$directory/elyon-latest.sql.gz" ]]
done

echo 'prune-local-storage: retenção validada'
