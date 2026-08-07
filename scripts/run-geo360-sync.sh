#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${GEO360_CONTAINER:-elyon_backend}"
CONCORRENCIA="${GEO360_CONCORRENCIA:-10}"
PAUSA_MS="${GEO360_PAUSA_MS:-150}"

run_city() {
  local cidade="$1"
  docker exec "${CONTAINER}" node dist/scripts/sincronizar-geo360.js \
    "--cidade=${cidade}" \
    "--concorrencia=${CONCORRENCIA}" \
    "--pausa-ms=${PAUSA_MS}" \
    --retomar \
    --promover
}

run_city goiania
run_city aparecidadegoiania
