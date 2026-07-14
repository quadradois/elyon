#!/usr/bin/env sh
set -eu

API_URL="${SMOKE_API_URL:-https://api.elyon.ia.br}"
CRM_URL="${SMOKE_CRM_URL:-https://crm.elyon.ia.br}"
SITE_URL="${SMOKE_SITE_URL:-https://elyon.ia.br}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-20}"

probe() {
  url="$1"
  curl --fail --show-error --silent \
    --connect-timeout 10 \
    --max-time "$TIMEOUT_SECONDS" \
    --retry 6 \
    --retry-all-errors \
    --retry-delay 5 \
    "$url" >/dev/null
  printf 'smoke ok: %s\n' "$url"
}

probe "$API_URL/live"
probe "$API_URL/ready"
probe "$CRM_URL"
probe "$SITE_URL"
