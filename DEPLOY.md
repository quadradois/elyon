# 🚀 Guia de Deploy - ELYON

Este documento descreve o processo completo de deploy do sistema ELYON para produção.

## 📋 Pré-requisitos

### No servidor (VPS)

- Ubuntu 22.04 LTS ou similar
- Docker 24+ e Docker Compose v2+
- Mínimo 4GB RAM (recomendado 8GB+)
- 50GB+ de disco SSD
- Portas 80 e 443 liberadas

### DNS Configurado

Aponte os seguintes subdomínios para o IP do servidor:

```
elyon.quadradois.com.br     → IP_DO_SERVIDOR
api.elyon.quadradois.com.br → IP_DO_SERVIDOR
admin.quadradois.com.br     → IP_DO_SERVIDOR
```

---

## 🔧 Instalação Inicial

### 1. Conectar ao Servidor

```bash
ssh root@SEU_SERVIDOR
```

### 2. Instalar Docker

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version
```

### 3. Clonar Repositório

```bash
cd /opt
git clone https://github.com/quadradois/elyon.git
cd elyon
```

### 4. Configurar Variáveis de Ambiente

```bash
# Copiar template
cp .env.production.example .env

# Editar variáveis
nano .env
```

**⚠️ IMPORTANTE:** Configure TODAS as variáveis obrigatórias:

- `DB_PASSWORD` - Senha forte para PostgreSQL
- `REDIS_PASSWORD` - Senha forte para Redis
- `JWT_SECRET` - Gere com: `openssl rand -hex 32`
- `OPENAI_API_KEY` - Sua chave da OpenAI
- `ASAAS_API_KEY` - Chave do Asaas (produção!)

### 5. Deploy Inicial

```bash
# Tornar script executável
chmod +x scripts/deploy.sh

# Build das imagens
./scripts/deploy.sh build

# Iniciar serviços
./scripts/deploy.sh up
```

---

## 🔐 Configurar Webhook do Asaas

Após o deploy, configure o webhook no painel Asaas:

1. Acesse [Asaas → Integrações → Webhooks](https://www.asaas.com/configuracoes/integracao)
2. Clique em **Adicionar Webhook**
3. Configure:
   - **URL**: `https://api.elyon.quadradois.com.br/api/billing/webhook`
   - **Enviar para URL**: Marcar
   - **Eventos**:
     - ✅ PAYMENT_CONFIRMED
     - ✅ PAYMENT_RECEIVED
     - ✅ PAYMENT_OVERDUE
     - ✅ SUBSCRIPTION_CREATED
     - ✅ SUBSCRIPTION_DELETED
4. Salvar

### Testar Webhook

```bash
# Ver logs do backend
./scripts/deploy.sh logs | grep webhook
```

---

## 📊 Comandos Úteis

```bash
# Ver status dos containers
./scripts/deploy.sh status

# Ver logs em tempo real
./scripts/deploy.sh logs

# Reiniciar serviços
./scripts/deploy.sh restart

# Executar migrations
./scripts/deploy.sh migrate

# Atualizar (git pull + rebuild)
./scripts/deploy.sh update

# Parar tudo
./scripts/deploy.sh down
```

---

## 🔄 Atualizações

### Atualização Simples (sem breaking changes)

```bash
cd /opt/elyon
git pull origin main
./scripts/deploy.sh update
```

### Atualização com Migrations

```bash
cd /opt/elyon
git pull origin main
./scripts/deploy.sh build
./scripts/deploy.sh down
./scripts/deploy.sh up
# Migrations rodam automaticamente no startup
```

---

## 🔍 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker-compose -f docker-compose.prod.yml logs backend

# Verificar se banco está ok
docker-compose -f docker-compose.prod.yml exec postgres pg_isready
```

### Erro de SSL/Certificado

```bash
# Verificar status do Traefik
docker-compose -f docker-compose.prod.yml logs traefik

# Certificados estão em:
docker volume inspect elyon_traefik_letsencrypt
```

### Erro de conexão com banco

```bash
# Verificar se PostgreSQL está rodando
docker-compose -f docker-compose.prod.yml ps postgres

# Conectar manualmente
docker-compose -f docker-compose.prod.yml exec postgres psql -U elyon_user -d elyon
```

---

## 📁 Backups

### Backup do Banco de Dados

```bash
# Criar backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U elyon_user elyon > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U elyon_user -d elyon
```

### Backup Automático (cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 3h)
0 3 * * * cd /opt/elyon && docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U elyon_user elyon > /backups/elyon_$(date +\%Y\%m\%d).sql
```

---

## 🌐 URLs de Produção

| Serviço       | URL                                                     |
| ------------- | ------------------------------------------------------- |
| Dashboard     | https://elyon.quadradois.com.br                         |
| API Backend   | https://api.elyon.quadradois.com.br                     |
| Admin/Billing | https://admin.quadradois.com.br                         |
| Webhook Asaas | https://api.elyon.quadradois.com.br/api/billing/webhook |

---

## ✅ Checklist Pós-Deploy

- [ ] Dashboard acessível em https://elyon.quadradois.com.br
- [ ] API respondendo em https://api.elyon.quadradois.com.br/health
- [ ] Certificado SSL válido (cadeado verde)
- [ ] Login funcionando
- [ ] Webhook do Asaas configurado
- [ ] Teste de pagamento realizado
- [ ] Backup automático configurado
