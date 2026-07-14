#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT_DIR"

authoritative_docs=(
  DEPLOY.md
  docs/README.md
  docs/operacao/RUNBOOK_OPERACIONAL.md
  docs/operacao/PIPELINE_CI_CD_PRODUCAO.md
  docs/operacao/WORKFLOW_DEPLOY_SEGURO.md
  docs/operacao/BACKUP_OFFHOST_E_RESTORE.md
  docs/operacao/OBSERVABILIDADE_E_SLO.md
  docs/operacoes/ROTACAO_CHAVE_CRIPTOGRAFIA.md
  docs/guias/MIGRACAO.md
  docs/guias/DEPLOY_ADMIN.md
 )

for file in "${authoritative_docs[@]}"; do
  [[ -f "$file" ]] || { echo "Runbook ausente: $file" >&2; exit 1; }
done

if grep -En 'docker-compose\.prod\.yml|/opt/elyon|elyon_admin' \
  "${authoritative_docs[@]}" scripts/migrate_import.sh docker-compose.yml; then
  echo "Referencia operacional obsoleta encontrada." >&2
  exit 1
fi

mapfile -t actual_services < <(docker compose -f docker-compose.yml config --no-interpolate --services | sort)
expected_services=(
  audio_converter
  backend
  backup
  frontend
  postgres
  prometheus
  redis
  site
  traefik
  worker
)

if [[ "${actual_services[*]}" != "${expected_services[*]}" ]]; then
  echo "Servicos do Compose divergiram do inventario esperado." >&2
  printf 'Atual: %s\n' "${actual_services[*]}" >&2
  exit 1
fi

for service in "${expected_services[@]}"; do
  grep -q "| \`$service\` |" docs/operacao/RUNBOOK_OPERACIONAL.md || {
    echo "Servico sem registro no runbook: $service" >&2
    exit 1
  }
done

grep -q '^\*\*Owner primario:\*\*' docs/operacao/RUNBOOK_OPERACIONAL.md
grep -q '^\*\*Ultima validacao:\*\*' docs/operacao/RUNBOOK_OPERACIONAL.md

echo "Runbooks e topologia operacional validados."
