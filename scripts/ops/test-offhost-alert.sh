#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./offhost-common.sh
source "$SCRIPT_DIR/offhost-common.sh"

[[ $(id -u) -eq 0 ]] || { offhost_fail 'execute como root'; exit 1; }
offhost_load_config

webhook="${OFFHOST_ALERT_WEBHOOK_URL:-${DISK_ALERT_WEBHOOK_URL:-}}"
[[ -n "$webhook" ]] || offhost_fail 'webhook externo ausente'

offhost_alert TEST "event=configuration_test payload_field=${OFFHOST_ALERT_WEBHOOK_FIELD:-text}"
echo 'ALERT_TEST_OK'
