#!/bin/bash
# ============================================
# ELYON - Script de Importação (Novo Servidor)
# ============================================
# Execute este script no SERVIDOR DE DESTINO,
# DENTRO do diretório do projeto desempacotado.
#
# Uso: bash scripts/migrate_import.sh <EXPORT_DIR>
#   Ex: bash scripts/migrate_import.sh /tmp/elyon_export_20260307_120000
#
# Pré-requisitos no novo servidor:
#   - Docker 24+
#   - Docker Compose v2
#   - git (opcional)
#   - rsync
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EXPORT_DIR="${1:-}"
INSTALL_DIR="/root/elyon"

log()    { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()     { echo -e "${GREEN}[OK]${NC}  $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }
step()   { echo ""; echo -e "${YELLOW}══════════════════════════════════════${NC}"; echo -e "${YELLOW} $1${NC}"; echo -e "${YELLOW}══════════════════════════════════════${NC}"; }

# ──────────────────────────────────────────
# 1. Validações
# ──────────────────────────────────────────
step "1/8 — Validações"

[[ -n "$EXPORT_DIR" ]]                         || error "Informe o caminho do export: bash migrate_import.sh /tmp/elyon_export_TIMESTAMP"
[[ -d "$EXPORT_DIR" ]]                         || error "Diretório de export não encontrado: ${EXPORT_DIR}"
[[ -f "${EXPORT_DIR}/db/elyon_dump.pgdump" ]]  || error "Dump do banco não encontrado em ${EXPORT_DIR}/db/"
[[ -d "${EXPORT_DIR}/app" ]]                   || error "Diretório app/ não encontrado em ${EXPORT_DIR}"

command -v docker &>/dev/null  || error "Docker não instalado. Instale com: curl -fsSL https://get.docker.com | sh"
docker compose version &>/dev/null 2>&1 || \
  docker-compose version &>/dev/null    || error "Docker Compose não encontrado."

ok "Pré-requisitos verificados."

# ──────────────────────────────────────────
# 2. Copiar arquivos da aplicação
# ──────────────────────────────────────────
step "2/8 — Copiando arquivos da aplicação"

if [[ -d "$INSTALL_DIR" ]]; then
  warn "Diretório ${INSTALL_DIR} já existe. Fazendo backup em ${INSTALL_DIR}_bak_$(date +%Y%m%d_%H%M%S)"
  mv "$INSTALL_DIR" "${INSTALL_DIR}_bak_$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$INSTALL_DIR"
rsync -a "${EXPORT_DIR}/app/" "${INSTALL_DIR}/"
ok "Arquivos copiados para ${INSTALL_DIR}"

cd "$INSTALL_DIR"

# ──────────────────────────────────────────
# 3. Verificar e ajustar .env
# ──────────────────────────────────────────
step "3/8 — Configuração do .env"

if [[ -f .env ]]; then
  ok "Arquivo .env encontrado (importado do servidor anterior)."
  echo ""
  echo -e "${YELLOW}⚠️  URLs configuradas no .env:${NC}"
  grep -E "FRONTEND_URL|BACKEND_URL|EVOLUTION_API_URL|ACME_EMAIL" .env || true
  echo ""
else
  warn ".env não encontrado! Copiando exemplo..."
  cp .env.production.example .env
  error "Preencha o arquivo .env em ${INSTALL_DIR}/.env e re-execute este script."
fi

source .env

# ──────────────────────────────────────────
# 4. Criar redes Docker
# ──────────────────────────────────────────
step "4/8 — Criando redes Docker"

docker network inspect elyon_network &>/dev/null || {
  docker network create elyon_network
  ok "Rede elyon_network criada."
}

# crm_quadradois_net é externa (usada se o CRM também estiver no servidor)
docker network inspect crm_quadradois_net &>/dev/null || {
  warn "Rede crm_quadradois_net não existe. Criando como isolada..."
  docker network create crm_quadradois_net
}

ok "Redes configuradas."

# ──────────────────────────────────────────
# 5. Subir apenas o PostgreSQL para restaurar
# ──────────────────────────────────────────
step "5/8 — Subindo PostgreSQL e restaurando banco"

log "Iniciando container postgres..."
DC_CMD="docker compose"
command -v docker-compose &>/dev/null && DC_CMD="docker-compose"

${DC_CMD} -f docker-compose.yml up -d postgres
log "Aguardando PostgreSQL ficar pronto..."

MAX_WAIT=60
ELAPSED=0
until docker exec elyon_postgres pg_isready -U "${DB_USER:-elyon_user}" &>/dev/null; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  [[ $ELAPSED -ge $MAX_WAIT ]] && error "PostgreSQL não respondeu em ${MAX_WAIT}s"
  echo -n "."
done
echo ""
ok "PostgreSQL pronto!"

# Restaurar dump
log "Restaurando dump do banco (isso pode levar alguns minutos)..."
docker cp "${EXPORT_DIR}/db/elyon_dump.pgdump" elyon_postgres:/tmp/elyon_dump.pgdump

# Dropar conexões ativas e recriar o banco
docker exec elyon_postgres psql -U "${DB_USER:-elyon_user}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME:-elyon}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

docker exec elyon_postgres psql -U "${DB_USER:-elyon_user}" -d postgres -c \
  "DROP DATABASE IF EXISTS \"${DB_NAME:-elyon}\";" 2>/dev/null || true

docker exec elyon_postgres psql -U "${DB_USER:-elyon_user}" -d postgres -c \
  "CREATE DATABASE \"${DB_NAME:-elyon}\";"

docker exec elyon_postgres pg_restore \
  -U "${DB_USER:-elyon_user}" \
  -d "${DB_NAME:-elyon}" \
  --no-owner --no-acl \
  /tmp/elyon_dump.pgdump

docker exec elyon_postgres rm -f /tmp/elyon_dump.pgdump
ok "Banco de dados restaurado com sucesso!"

# ──────────────────────────────────────────
# 6. Restaurar Redis (se disponível)
# ──────────────────────────────────────────
step "6/8 — Restaurando Redis"

if [[ -f "${EXPORT_DIR}/redis/dump.rdb" ]]; then
  log "Subindo Redis..."
  ${DC_CMD} -f docker-compose.yml up -d redis
  sleep 3

  # Parar o redis para substituir o RDB
  docker stop elyon_redis
  docker cp "${EXPORT_DIR}/redis/dump.rdb" elyon_redis:/data/dump.rdb
  docker start elyon_redis
  ok "Redis restaurado."
else
  warn "Sem snapshot Redis — subindo Redis vazio (dados de sessão e cache serão recriados)."
  ${DC_CMD} -f docker-compose.yml up -d redis
fi

# ──────────────────────────────────────────
# 7. Build e inicialização completa
# ──────────────────────────────────────────
step "7/8 — Build e inicialização dos serviços"

log "Construindo imagens (backend, frontend, site)..."
${DC_CMD} -f docker-compose.yml build

log "Subindo todos os serviços..."
${DC_CMD} -f docker-compose.yml up -d

log "Aguardando backend ficar pronto..."
sleep 10

log "Executando migrations do Prisma (seguro em produção)..."
docker exec elyon_backend npx prisma migrate deploy 2>/dev/null && \
  ok "Migrations aplicadas." || warn "Migrations puladas (verifique manualmente se necessário)."

# ──────────────────────────────────────────
# 8. Verificação final
# ──────────────────────────────────────────
step "8/8 — Verificação final"

echo ""
${DC_CMD} -f docker-compose.yml ps
echo ""

# Checar saúde do backend
BACKEND_URL="${BACKEND_URL:-https://api.elyon.ia.br}"
log "Testando readiness do backend em ${BACKEND_URL}/ready ..."
sleep 5
if curl -sf --max-time 10 "${BACKEND_URL}/ready" &>/dev/null 2>&1; then
  ok "Backend pronto em ${BACKEND_URL}/ready"
else
  warn "Backend ainda não está respondendo. Verifique os logs:"
  echo "  docker logs elyon_backend --tail=50"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       MIGRAÇÃO CONCLUÍDA! 🎉             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Frontend:  ${FRONTEND_URL:-https://crm.elyon.ia.br}"
echo "  API:       ${BACKEND_URL:-https://api.elyon.ia.br}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1. Aponte o DNS para o IP deste servidor"
echo "  2. Teste o login no frontend"
echo "  3. Verifique a Evolution API (WhatsApp)"
echo "  4. Monitore os logs: docker logs elyon_backend -f"
echo ""
