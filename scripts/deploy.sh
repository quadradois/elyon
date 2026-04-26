#!/bin/bash
# ============================================
# ELYON - Script de Deploy para Produção
# ============================================
# Uso: ./scripts/deploy.sh [comando]
# Comandos: build, up, down, logs, migrate, restart
# ============================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo "Copie .env.production.example para .env e configure as variáveis."
    exit 1
fi

# Carregar variáveis de ambiente
source .env

# Função para exibir ajuda
show_help() {
    echo "============================================"
    echo "ELYON - Script de Deploy"
    echo "============================================"
    echo ""
    echo "Uso: ./scripts/deploy.sh [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  build     - Constrói as imagens Docker"
    echo "  up        - Inicia todos os serviços"
    echo "  down      - Para todos os serviços"
    echo "  restart   - Reinicia todos os serviços"
    echo "  logs      - Exibe logs em tempo real"
    echo "  migrate   - Executa migrations do banco"
    echo "  status    - Exibe status dos containers"
    echo "  clean     - Remove containers e volumes órfãos"
    echo "  update    - Pull das imagens + rebuild + restart"
    echo ""
}

# Função para build
do_build() {
    echo -e "${YELLOW}🔨 Construindo imagens Docker...${NC}"
    docker compose -f docker-compose.yml build --no-cache
    echo -e "${GREEN}✅ Build concluído!${NC}"
}

# Função para iniciar
do_up() {
    echo -e "${YELLOW}🚀 Iniciando serviços...${NC}"
    docker compose -f docker-compose.yml up -d
    echo -e "${GREEN}✅ Serviços iniciados!${NC}"
    echo ""
    echo "URLs disponíveis:"
    echo "  Frontend: https://crm.elyon.ia.br"
    echo "  API:      https://api.elyon.ia.br"
    echo "  Site:     https://elyon.ia.br"
    echo ""
}

# Função para parar
do_down() {
    echo -e "${YELLOW}⏹️ Parando serviços...${NC}"
    docker compose -f docker-compose.yml down
    echo -e "${GREEN}✅ Serviços parados!${NC}"
}

# Função para reiniciar
do_restart() {
    echo -e "${YELLOW}🔄 Reiniciando serviços...${NC}"
    docker compose -f docker-compose.yml restart
    echo -e "${GREEN}✅ Serviços reiniciados!${NC}"
}

# Função para logs
do_logs() {
    echo -e "${YELLOW}📜 Exibindo logs (Ctrl+C para sair)...${NC}"
    docker compose -f docker-compose.yml logs -f
}

# Função para migrations
do_migrate() {
    echo -e "${YELLOW}🔄 Executando migrations...${NC}"
    docker compose -f docker-compose.yml exec backend npx prisma migrate deploy
    echo -e "${GREEN}✅ Migrations aplicadas!${NC}"
}

# Função para status
do_status() {
    echo -e "${YELLOW}📊 Status dos containers:${NC}"
    docker compose -f docker-compose.yml ps
}

# Função para limpar
do_clean() {
    echo -e "${YELLOW}🧹 Limpando containers e volumes órfãos...${NC}"
    docker system prune -f
    docker volume prune -f
    echo -e "${GREEN}✅ Limpeza concluída!${NC}"
}

# Função para atualizar
do_update() {
    echo -e "${YELLOW}📥 Atualizando sistema...${NC}"
    git pull origin main
    do_build
    do_down
    do_up
    echo -e "${GREEN}✅ Atualização concluída!${NC}"
}

# Processar comando
case "$1" in
    build)
        do_build
        ;;
    up)
        do_up
        ;;
    down)
        do_down
        ;;
    restart)
        do_restart
        ;;
    logs)
        do_logs
        ;;
    migrate)
        do_migrate
        ;;
    status)
        do_status
        ;;
    clean)
        do_clean
        ;;
    update)
        do_update
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Comando inválido: $1${NC}"
        show_help
        exit 1
        ;;
esac
