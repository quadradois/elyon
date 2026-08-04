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
}

wait_for_health() {
  local attempts=30
  local api_path="${1:-ready}"
  local urls=(
    "https://api.elyon.ia.br/${api_path}"
    'https://crm.elyon.ia.br'
    'https://elyon.ia.br'
  )

  for ((i = 1; i <= attempts; i++)); do
    local healthy=true
    for url in "${urls[@]}"; do
      if ! curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
        healthy=false
        break
      fi
    done

    if [[ "$healthy" == true ]]; then
      if docker compose -f docker-compose.yml exec -T worker \
        node -e "fetch('http://127.0.0.1:3001/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
        echo -e "${GREEN}Health checks de API, worker, CRM e site aprovados.${NC}"
        return 0
      fi
    fi
    sleep 2
  done

  echo -e "${RED}Health check falhou após $((attempts * 2)) segundos.${NC}" >&2
  return 1
}

snapshot_current_images() {
  local tag="$1"
  local container repository image_id

  while read -r container repository; do
    image_id=$(docker inspect --format '{{.Image}}' "$container") || return 1
    docker image tag "$image_id" "${repository}:rollback-${tag}" || return 1
  done <<'EOF'
elyon_backend elyon-backend
elyon_frontend elyon-frontend
elyon_site elyon-site
EOF
}

rollback_application_images() {
  local tag="$1"
  echo -e "${YELLOW}Restaurando imagens da aplicação do release anterior...${NC}" >&2

  docker image tag "elyon-backend:rollback-${tag}" elyon-backend:latest || return 1
  docker image tag "elyon-frontend:rollback-${tag}" elyon-frontend:latest || return 1
  docker image tag "elyon-site:rollback-${tag}" elyon-site:latest || return 1
  if docker run --rm --entrypoint test elyon-backend:latest -f /app/dist/worker.js; then
    docker compose -f docker-compose.yml up -d --no-deps --force-recreate backend worker frontend site || return 1
  else
    docker compose -f docker-compose.yml rm -sf worker >/dev/null 2>&1 || true
    docker compose -f docker-compose.yml up -d --no-deps --force-recreate backend frontend site || return 1
  fi
  # A imagem anterior pode anteceder a introdução de /ready.
  wait_for_health health
}

cleanup_old_rollback_tags() {
  local keep_tag="$1"
  local repository image_ref

  for repository in elyon-backend elyon-frontend elyon-site; do
    while read -r image_ref; do
      [[ -n "$image_ref" ]] || continue
      [[ "$image_ref" == "${repository}:rollback-${keep_tag}" ]] && continue
      docker image rm "$image_ref" >/dev/null 2>&1 || true
    done < <(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}' | grep ':rollback-' || true)
  done
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
  wait_for_health
}

do_update() {
  require_env
  validate_release_state
  local expected previous rollback_tag
  expected=$(resolve_expected_commit "${1:-}")
  previous=$(cat /var/lib/elyon-last-deployed-commit 2>/dev/null || git rev-parse HEAD)
  rollback_tag=${previous:0:12}

  snapshot_current_images "$rollback_tag" || fail "Não foi possível preservar as imagens atuais."

  git merge --ff-only "$expected"
  validate_compose

  scripts/ops/install-offhost-backup.sh || fail "Instalação do backup off-host falhou."

  scripts/ops/prune-local-storage.sh || fail "Manutenção preventiva de espaço falhou."

  if ! docker exec elyon_backup /backup.sh; then
    fail "Backup pré-deploy falhou; release cancelado."
  fi

  if ! docker compose -f docker-compose.yml build; then
    rollback_application_images "$rollback_tag" || true
    fail "Build falhou; imagens anteriores restauradas."
  fi

  if ! docker compose -f docker-compose.yml run --rm --no-deps backend ./scripts/prisma-migrate-deploy.sh; then
    rollback_application_images "$rollback_tag" || true
    fail "Migration falhou; aplicação anterior restaurada."
  fi

  if ! docker compose -f docker-compose.yml up -d --remove-orphans; then
    rollback_application_images "$rollback_tag" || true
    fail "Inicialização falhou; aplicação anterior restaurada."
  fi

  if ! wait_for_health; then
    rollback_application_images "$rollback_tag" || true
    fail "Health check falhou; aplicação anterior restaurada."
  fi

  record_deployment "$expected"
  cleanup_old_rollback_tags "$rollback_tag"
  scripts/ops/prune-local-storage.sh || true
  echo -e "${GREEN}Deploy concluído no commit $expected.${NC}"
}

do_migrate() {
  require_env
  validate_release_state
  local head remote_main
  head=$(git rev-parse HEAD)
  remote_main=$(git rev-parse origin/main)
  [[ "$head" == "$remote_main" ]] || fail "Migração permitida somente no topo de origin/main."
  docker compose -f docker-compose.yml exec -T backend ./scripts/prisma-migrate-deploy.sh
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
