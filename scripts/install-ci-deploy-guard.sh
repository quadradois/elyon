#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PUBLIC_KEY_FILE=${1:-}
AUTHORIZED_KEYS='/root/.ssh/authorized_keys'
MARKER='elyon-github-actions'

[[ $(id -u) -eq 0 ]] || { echo 'Execute como root.' >&2; exit 1; }
[[ -n "$PUBLIC_KEY_FILE" && -f "$PUBLIC_KEY_FILE" ]] || {
  echo "Uso: $0 /caminho/chave-ci.pub" >&2
  exit 1
}

public_key=$(<"$PUBLIC_KEY_FILE")
public_key=${public_key%$'\r'}
[[ "$public_key" =~ ^ssh-ed25519[[:space:]]+[A-Za-z0-9+/=]+[[:space:]]+$MARKER$ ]] || {
  echo "A chave pública deve ser Ed25519 e terminar com o comentário $MARKER." >&2
  exit 1
}

install -m 0755 "$ROOT_DIR/scripts/ops/elyon-ci-deploy" /usr/local/sbin/elyon-ci-deploy
install -d -m 0700 /root/.ssh
touch "$AUTHORIZED_KEYS"
chmod 0600 "$AUTHORIZED_KEYS"

tmp_file=$(mktemp)
trap 'rm -f "$tmp_file"' EXIT
grep -v "$MARKER" "$AUTHORIZED_KEYS" > "$tmp_file" || true
printf 'restrict,command="/usr/local/sbin/elyon-ci-deploy" %s\n' "$public_key" >> "$tmp_file"
install -m 0600 "$tmp_file" "$AUTHORIZED_KEYS"

echo "Wrapper instalado: /usr/local/sbin/elyon-ci-deploy"
ssh-keygen -lf "$PUBLIC_KEY_FILE"
