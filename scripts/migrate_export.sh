#!/bin/bash
# ============================================
# ELYON - Script de Exportação para Migração
# ============================================
# Execute este script no SERVIDOR DE ORIGEM.
# Ele empacota tudo que precisa ser transferido.
#
# Uso: ./scripts/migrate_export.sh [NOVO_SERVIDOR_IP]
#   Ex: ./scripts/migrate_export.sh 192.168.1.100
#       ./scripts/migrate_export.sh user@192.168.1.100
#
# Se não passar o IP, o pacote será gerado localmente
# em /tmp/elyon_migration_<timestamp>.tar.gz
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="/tmp/elyon_export_${TIMESTAMP}"
PACKAGE_FILE="/tmp/elyon_migration_${TIMESTAMP}.tar.gz"
DEST_HOST="${1:-}"

log()    { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()     { echo -e "${GREEN}[OK]${NC}  $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

# ──────────────────────────────────────────
# 1. Validações
# ──────────────────────────────────────────
log "Verificando pré-requisitos..."
[[ -f .env ]]                   || error "Execute este script a partir de /root/elyon (arquivo .env não encontrado)"
command -v docker &>/dev/null   || error "Docker não encontrado"
command -v docker-compose &>/dev/null 2>&1 || \
  docker compose version &>/dev/null       || error "Docker Compose não encontrado"

source .env

log "Exportação iniciada em ${TIMESTAMP}"
mkdir -p "${EXPORT_DIR}"/{db,redis,app}

# ──────────────────────────────────────────
# 2. Dump do PostgreSQL
# ──────────────────────────────────────────
log "Criando dump do PostgreSQL..."

DB_CONTAINER=$(docker ps --filter "name=elyon_postgres" --format "{{.Names}}" | head -1)
[[ -n "$DB_CONTAINER" ]] || error "Container elyon_postgres não está em execução. Verifique com: docker ps"

docker exec "${DB_CONTAINER}" \
  pg_dump -U "${DB_USER:-elyon_user}" -d "${DB_NAME:-elyon}" \
  --format=custom --compress=9 \
  --file=/tmp/elyon_dump.pgdump

docker cp "${DB_CONTAINER}:/tmp/elyon_dump.pgdump" "${EXPORT_DIR}/db/elyon_dump.pgdump"
docker exec "${DB_CONTAINER}" rm -f /tmp/elyon_dump.pgdump

ok "Dump do banco criado: $(du -sh "${EXPORT_DIR}/db/elyon_dump.pgdump" | cut -f1)"

# ──────────────────────────────────────────
# 3. Snapshot do Redis (opcional)
# ──────────────────────────────────────────
log "Exportando dados do Redis..."

REDIS_CONTAINER=$(docker ps --filter "name=elyon_redis" --format "{{.Names}}" | head -1)
if [[ -n "$REDIS_CONTAINER" ]]; then
  # Gera RDB snapshot sob demanda
  docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASSWORD:-}" BGSAVE 2>/dev/null || true
  sleep 2
  docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${EXPORT_DIR}/redis/dump.rdb" 2>/dev/null && \
    ok "Snapshot Redis exportado." || warn "Redis RDB não encontrado (cache pode ser descartado)."
else
  warn "Container elyon_redis não encontrado — Redis será descartado na migração."
fi

# ──────────────────────────────────────────
# 4. Arquivos da aplicação
# ──────────────────────────────────────────
log "Copiando arquivos da aplicação..."

# Estrutura do projeto (sem node_modules, .git, build caches)
rsync -a --progress \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='.turbo/' \
  --exclude='build_*.log' \
  --exclude='*/dist/' \
  --exclude='*/.next/' \
  --exclude='*/node_modules/' \
  --exclude='backups/daily/' \
  --exclude='backups/weekly/' \
  --exclude='backups/monthly/' \
  /root/elyon/ "${EXPORT_DIR}/app/"

ok "Arquivos da aplicação copiados."

# ──────────────────────────────────────────
# 5. Backups recentes do banco
# ──────────────────────────────────────────
log "Incluindo backups recentes..."
if ls /root/elyon/backups/last/*.pgdump &>/dev/null 2>&1 || \
   ls /root/elyon/backups/last/*.sql   &>/dev/null 2>&1; then
  cp /root/elyon/backups/last/* "${EXPORT_DIR}/db/" 2>/dev/null || true
  ok "Backups recentes incluídos."
else
  warn "Nenhum backup automático encontrado em backups/last/."
fi

# ──────────────────────────────────────────
# 6. Metadados da exportação
# ──────────────────────────────────────────
cat > "${EXPORT_DIR}/EXPORT_INFO.txt" << EOF
Elyon Migration Export
======================
Data:       $(date)
Servidor:   $(hostname) / $(hostname -I | awk '{print $1}')
DB Name:    ${DB_NAME:-elyon}
DB User:    ${DB_USER:-elyon_user}
Timestamp:  ${TIMESTAMP}

Conteúdo:
  db/elyon_dump.pgdump  → dump completo do PostgreSQL
  redis/dump.rdb        → snapshot Redis (se disponível)
  app/                  → código-fonte + .env + secrets

Para restaurar, execute no novo servidor:
  tar -xzf elyon_migration_${TIMESTAMP}.tar.gz
  cd elyon_export_${TIMESTAMP}
  ./app/scripts/migrate_import.sh
EOF

# ──────────────────────────────────────────
# 7. Empacotar tudo
# ──────────────────────────────────────────
log "Compactando pacote de migração..."
tar -czf "${PACKAGE_FILE}" -C /tmp "elyon_export_${TIMESTAMP}"
ok "Pacote criado: ${PACKAGE_FILE} ($(du -sh "${PACKAGE_FILE}" | cut -f1))"

# ──────────────────────────────────────────
# 8. Transferir para o novo servidor (opcional)
# ──────────────────────────────────────────
if [[ -n "$DEST_HOST" ]]; then
  log "Transferindo para ${DEST_HOST}..."
  scp "${PACKAGE_FILE}" "${DEST_HOST}:/tmp/"
  ok "Transferência concluída!"
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN} PRÓXIMO PASSO — No NOVO servidor:${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
  echo "  ssh ${DEST_HOST}"
  echo "  cd /tmp"
  echo "  tar -xzf elyon_migration_${TIMESTAMP}.tar.gz"
  echo "  cd elyon_export_${TIMESTAMP}/app"
  echo "  bash scripts/migrate_import.sh /tmp/elyon_export_${TIMESTAMP}"
  echo ""
else
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN} PACOTE PRONTO!${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
  echo "  Arquivo: ${PACKAGE_FILE}"
  echo ""
  echo "  Transfira manualmente para o novo servidor:"
  echo "    scp ${PACKAGE_FILE} user@NOVO_IP:/tmp/"
  echo ""
  echo "  No NOVO servidor:"
  echo "    tar -xzf elyon_migration_${TIMESTAMP}.tar.gz -C /tmp"
  echo "    cd /tmp/elyon_export_${TIMESTAMP}/app"
  echo "    bash scripts/migrate_import.sh /tmp/elyon_export_${TIMESTAMP}"
  echo ""
fi

# Limpar diretório temp
rm -rf "${EXPORT_DIR}"
