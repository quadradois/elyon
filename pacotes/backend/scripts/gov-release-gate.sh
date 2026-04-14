#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-quick}"
DATE_NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "== GOV RELEASE GATE =="
echo "Timestamp (UTC): ${DATE_NOW}"
echo "Mode: ${MODE}"
echo

export NODE_OPTIONS="${NODE_OPTIONS:-"--max-old-space-size=4096"}"

run() {
  echo ">> $*"
  "$@"
  echo
}

run_core_tests() {
  run npm -C "${ROOT_DIR}" test -- \
    src/agentes/__tests__/conversation-state.test.ts \
    src/agentes/__tests__/input-builder.test.ts \
    src/agentes/__tests__/output-extraction.test.ts \
    src/agentes/__tests__/response-filters.test.ts \
    src/agentes/__tests__/shared-behavioral-guardrails.test.ts \
    src/agentes/__tests__/agent-factories.test.ts \
    src/agentes/__tests__/skills-system.test.ts \
    src/agentes/__tests__/gov-05-ivonet-regression.e2e.test.ts \
    src/casos-de-uso/agentes/__tests__/mover-para-fase.usecase.test.ts \
    src/agentes/__tests__/governanca-qualificacao.test.ts \
    src/__tests__/rotas/metricas-agentes.test.ts \
    --runInBand
}

run_full_tests() {
  run npm -C "${ROOT_DIR}" test -- \
    src/agentes/__tests__/conversation-state.test.ts \
    src/agentes/__tests__/input-builder.test.ts \
    src/agentes/__tests__/output-extraction.test.ts \
    src/agentes/__tests__/response-filters.test.ts \
    src/agentes/__tests__/handoff-filters.test.ts \
    src/agentes/__tests__/shared-behavioral-guardrails.test.ts \
    src/agentes/__tests__/sentiment-analyzer.test.ts \
    src/agentes/__tests__/classificador-objecao.test.ts \
    src/agentes/__tests__/google-calendar.test.ts \
    src/agentes/__tests__/context-builder.test.ts \
    src/agentes/__tests__/entry-guardrail.test.ts \
    src/agentes/__tests__/templates-prospeccao.test.ts \
    src/agentes/__tests__/skills-system.test.ts \
    src/agentes/__tests__/agent-resolution.test.ts \
    src/agentes/__tests__/agent-chain.test.ts \
    src/agentes/__tests__/agent-runner.test.ts \
    src/agentes/__tests__/agent-factories.test.ts \
    src/agentes/__tests__/gov-05-ivonet-regression.e2e.test.ts \
    src/casos-de-uso/agentes/__tests__/mover-para-fase.usecase.test.ts \
    src/agentes/__tests__/governanca-qualificacao.test.ts \
    src/__tests__/rotas/metricas-agentes.test.ts \
    --runInBand
}

case "${MODE}" in
  quick|"")
    run_core_tests
    ;;
  --full|full)
    run_full_tests
    ;;
  *)
    echo "Uso: bash scripts/gov-release-gate.sh [quick|--full]"
    exit 1
    ;;
esac

run npm -C "${ROOT_DIR}" run build -- --pretty false

echo "Checklist manual pós-gate (obrigatório):"
echo "[ ] Validar amostra real em /dashboard/leads/:id sem dados fantasmas"
echo "[ ] Validar trilha em /api/metricas-agentes/governanca/trilha?leadId=<id>"
echo "[ ] Validar rollback: identificar commit/tag anterior e comando de retorno"
echo
echo "GOV RELEASE GATE: OK"

