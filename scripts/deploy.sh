#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail() {
  echo -e "${RED}ERRO: $*${NC}" >&2
  exit 1
}

require_env() {
  [[ -f .env ]] || fail "Arquivo .env não encontrado."
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
}

require_clean_worktree() {
  git diff --quiet || fail "Worktree possui alterações rastreadas não commitadas."
  git diff --cached --quiet || fail "Index possui alterações não commitadas."
  [[ -z "$(git ls-files --others --exclude-standard)" ]] || \
    fail "Worktree possui arquivos não rastreados."
}

fetch_release() {
  git fetch --prune origin main
}

require_main_branch() {
  local branch
  branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  [[ "$branch" == "main" ]] || fail "Deploy permitido somente a partir da branch main; atual=$branch."
}

resolve_expected_commit() {
  local requested="${1:-}"
  [[ -n "$requested" ]] || fail "Informe o commit esperado: ./scripts/deploy.sh update <commit>."

  local expected remote_main
  expected=$(git rev-parse "${requested}^{commit}" 2>/dev/null) || fail "Commit inválido: $requested"
  remote_main=$(git rev-parse 'origin/main^{commit}')
  [[ "$expected" == "$remote_main" ]] || \
    fail "O commit informado não corresponde ao topo de origin/main ($remote_main)."

  printf '%s\n' "$expected"
}

validate_release_state() {
  require_clean_worktree
  require_main_branch
  fetch_release
}

validate_compose() {
  docker compose -f docker-compose.yml config --quiet
  docker compose -f evolution/docker-compose.yml config --quiet
}

wait_for_health() {
  local attempts=30
  local url='https://api.elyon.ia.br/health'

  for ((i = 1; i <= attempts; i++)); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      echo -e "${GREEN}Health check aprovado.${NC}"
      return 0
    fi
    sleep 2
  done

  fail "Health check falhou após $((attempts * 2)) segundos."
}

record_deployment() {
  local commit="$1"
  logger -t elyon-deploy -- "commit=$commit user=$(id -un) host=$(hostname) status=success"
  echo "$commit" > /var/lib/elyon-last-deployed-commit
}

do_build() {
  require_env
  validate_release_state
  local head remote_main
  head=$(git rev-parse HEAD)
  remote_main=$(git rev-parse origin/main)
  [[ "$head" == "$remote_main" ]] || fail "main local não corresponde a origin/main. Use update <commit>."
  validate_compose
  docker compose -f docker-compose.yml build
}

do_up() {
  require_env
  validate_release_state
  local head remote_main
  head=$(git rev-parse HEAD)
  remote_main=$(git rev-parse origin/main)
  [[ "$head" == "$remote_main" ]] || fail "main local não corresponde a origin/main."
  validate_compose
  docker compose -f docker-compose.yml up -d --remove-orphans
  docker compose -f evolution/docker-compose.yml up -d --remove-orphans
  wait_for_health
}

do_update() {
  require_env
  validate_release_state
  local expected
  expected=$(resolve_expected_commit "${1:-}")

  git merge --ff-only "$expected"
  validate_compose
  docker compose -f docker-compose.yml build
  docker compose -f docker-compose.yml up -d --remove-orphans
  docker compose -f evolution/docker-compose.yml up -d --remove-orphans
  wait_for_health
  record_deployment "$expected"
  echo -e "${GREEN}Deploy concluído no commit $expected.${NC}"
}

do_migrate() {
  require_env
  validate_release_state
  local head remote_main
  head=$(git rev-parse HEAD)
  remote_main=$(git rev-parse origin/main)
  [[ "$head" == "$remote_main" ]] || fail "Migração permitida somente no topo de origin/main."
  docker compose -f docker-compose.yml exec -T backend npx prisma migrate deploy
}

show_help() {
  cat <<'EOF'
ELYON — operações e deploy seguro

Uso:
  ./scripts/deploy.sh status
  ./scripts/deploy.sh logs
  ./scripts/deploy.sh restart
  ./scripts/deploy.sh build
  ./scripts/deploy.sh up
  ./scripts/deploy.sh migrate
  ./scripts/deploy.sh update <commit-exato-de-origin/main>
  ./scripts/deploy.sh clean-build-cache

Build, up, migrate e update exigem main limpa e alinhada ao GitHub.
Update exige o SHA exato atualmente publicado em origin/main.
EOF
}

case "${1:-help}" in
  status)
    require_env
    docker compose -f docker-compose.yml ps
    docker compose -f evolution/docker-compose.yml ps
    ;;
  logs)
    require_env
    docker compose -f docker-compose.yml logs -f
    ;;
  restart)
    require_env
    docker compose -f docker-compose.yml restart
    ;;
  build)
    do_build
    ;;
  up)
    do_up
    ;;
  migrate)
    do_migrate
    ;;
  update)
    do_update "${2:-}"
    ;;
  clean-build-cache)
    docker builder prune -f
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    fail "Comando inválido: ${1:-}"
    ;;
esac
