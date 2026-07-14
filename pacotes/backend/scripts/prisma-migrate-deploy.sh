#!/bin/sh
set -eu

BASELINE_MIGRATION='20260714000000_baseline'
ALLOWED_DRIFT='prisma/legacy-baseline-allowed-drift.sql'
TIMEOUT_SECONDS="${PRISMA_MIGRATION_TIMEOUT_SECONDS:-600}"

case "$TIMEOUT_SECONDS" in
  ''|*[!0-9]*) echo 'ERRO: PRISMA_MIGRATION_TIMEOUT_SECONDS deve ser inteiro positivo' >&2; exit 1 ;;
  0) echo 'ERRO: PRISMA_MIGRATION_TIMEOUT_SECONDS deve ser maior que zero' >&2; exit 1 ;;
esac

command -v timeout >/dev/null 2>&1 || {
  echo 'ERRO: utilitario timeout ausente' >&2
  exit 1
}

run_with_timeout() {
  timeout "$TIMEOUT_SECONDS" "$@"
}

normalize_sql() {
  sed 's/\r$//' "$1" | awk '
    /^[[:space:]]*$/ { blank_count++; next }
    {
      while (blank_count > 0) {
        print ""
        blank_count--
      }
      print
    }
  '
}

state=$(run_with_timeout node dist/scripts/prisma-baseline-state.js)
echo "Prisma baseline state: ${state}"

case "$state" in
  EMPTY|BASELINE_APPLIED)
    ;;
  LEGACY_READY)
    raw_drift=$(mktemp)
    actual_drift=$(mktemp)
    expected_drift=$(mktemp)
    trap 'rm -f "$raw_drift" "$actual_drift" "$expected_drift"' EXIT INT TERM
    normalize_sql "$ALLOWED_DRIFT" > "$expected_drift"

    PRISMA_HIDE_UPDATE_MESSAGE=true NO_UPDATE_NOTIFIER=1 \
      run_with_timeout npx prisma migrate diff \
        --from-schema-datasource prisma/schema.prisma \
        --to-schema-datamodel prisma/schema.prisma \
        --script > "$raw_drift"
    normalize_sql "$raw_drift" > "$actual_drift"

    if ! cmp -s "$expected_drift" "$actual_drift"; then
      expected_hash=$(sha256sum "$expected_drift" | awk '{print $1}')
      actual_hash=$(sha256sum "$actual_drift" | awk '{print $1}')
      echo "ERRO: drift legado nao aprovado expected_sha256=${expected_hash} actual_sha256=${actual_hash}" >&2
      exit 1
    fi

    echo "Adotando baseline Prisma ${BASELINE_MIGRATION} no banco legado verificado."
    run_with_timeout npx prisma migrate resolve --applied "$BASELINE_MIGRATION"
    ;;
  *)
    echo "ERRO: estado de baseline desconhecido: ${state}" >&2
    exit 1
    ;;
esac

run_with_timeout npx prisma migrate deploy
