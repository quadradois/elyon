# 🚀 Guia de Deploy - ELYON SaaS

**Versão da Documentação:** 2.0 (Pós-Auditoria de Segurança 2025)
**Status do Sistema:** Produção Segura

---

## 🏗️ Arquitetura de Infraestrutura

O ambiente ELYON utiliza uma arquitetura de serviços segmentada para maior segurança:

1.  **Infraestrutura Compartilhada (`/root/infra`)**
    *   **Traefik:** Reverse Proxy com Socket Proxy e TLS Hardening.
    *   **Socket Proxy:** Isola o socket Docker do Traefik.
    *   **Rede:** Gerencia SSL (Let's Encrypt) e roteamento para todos os apps (ELYON, CRM).

2.  **Aplicação ELYON (`/root/elyon`)**
    *   **Frontend:** Nginx (porta 80 interna).
    *   **Backend:** Node.js (usuário não-root `nodejs`).
    *   **PostgreSQL:** Banco de dados dedicado.
    *   **Redis:** Cache dedicado.
    *   **Backup:** Container dedicado de automação de backup.

---

## 📋 Pré-requisitos & Segurança

### 1. Gestão de Secrets (CRÍTICO)

Não utilizamos mais variáveis de ambiente para senhas sensíveis no `.env`. Utilize o diretório de secrets:

```bash
# Localização dos secrets
/root/elyon/secrets/
├── db_password.txt    (chmod 600)
├── redis_password.txt (chmod 600)
└── jwt_secret.txt     (chmod 600)
```

**Para alterar uma senha:**
1. Edite o arquivo correspondente em `/root/elyon/secrets/`.
2. Reinicie os serviços afetados: `./scripts/deploy.sh restart`.

### 2. Infraestrutura (Traefik)

O Traefik deve estar rodando antes de iniciar o ELYON.

```bash
cd /root/infra
docker compose ps
# Deve mostrar: elyon_traefik e docker_socket_proxy UP
```

---

## 🚀 Comandos de Deploy (ELYON)

O script `./scripts/deploy.sh` continua sendo a principal interface de comando.

```bash
cd /root/elyon
chmod +x scripts/deploy.sh
```

### Iniciar Aplicação

```bash
./scripts/deploy.sh up
```

### Atualizar Aplicação (Zero-downtime attempt)

```bash
./scripts/deploy.sh update
# Executa: git pull → build → down → up
```

### Logs em Tempo Real

```bash
./scripts/deploy.sh logs
```

### Status dos Containers

```bash
./scripts/deploy.sh status
```

---

## 🤖 Modo Outbound-Only (Orchestrator)

O runtime oficial do ELYON está em modo **100% outbound com orchestrator**.

No serviço `backend` (compose), mantenha:

```yaml
USAR_ORQUESTRADOR_4_AGENTES: true
MODO_OUTBOUND_ONLY: true
DESATIVAR_INBOUND: true
```

### Efeito operacional

- Mensagens de prospecção ativa continuam no fluxo do orchestrator.
- Fluxo inbound é ignorado globalmente (sem processamento IA de inbound).
- Se `USAR_ORQUESTRADOR_4_AGENTES` estiver desligado, o backend não usa fallback legado de SDR no webhook.

### Rollback controlado (temporário)

Para reabrir inbound temporariamente, defina:

```yaml
MODO_OUTBOUND_ONLY: false
DESATIVAR_INBOUND: false
```

Depois aplique restart:

```bash
./scripts/deploy.sh restart
```

---

## 💾 Backup e Recuperação

O backup agora é **100% automatizado** via container dedicado. Não use scripts manuais via crontab.

### Configuração Atual
*   **Container:** `elyon_backup`
*   **Horário:** Diariamente às 03:00 AM
*   **Retenção:** 7 dias, 4 semanas, 6 meses
*   **Local:** `/root/elyon/backups`

### Verificar Status dos Backups

```bash
# Ver últimos logs de execução
docker logs elyon_backup

# Listar arquivos de backup
ls -lh /root/elyon/backups
```

### Como Restaurar um Backup

1.  **Parar a aplicação** (exceto banco):
    ```bash
    ./scripts/deploy.sh down
    docker compose -f docker-compose.prod.yml up -d postgres
    ```

2.  **Executar Restore:**
    ```bash
    # De dentro do container postgres
    cat /backups/backup_DIARIO_YYYY-MM-DD.sql.gz | gunzip | docker exec -i elyon_postgres psql -U elyon_user -d elyon
    ```
    *(Nota: Requer ajuste de caminho dependendo de onde o arquivo estiver. Se estiver no host, use `docker exec -i ... < arquivo.sql`)*

---

## 🔍 Troubleshooting Comum

### 1. "404 Not Found" no Frontend
*   Verifique se o container `elyon_frontend` está rodando.
*   Verifique se o Traefik está detectando o serviço: `docker logs elyon_traefik | grep elyon`.
*   Verifique se o Cloudflare está em modo **Full (Strict)**.

### 2. Erro de Conexão com Banco
*   Verifique logs do backend: `docker logs elyon_backend`.
*   Confirme se a senha em `secrets/db_password.txt` bate com a usada pelo banco.

### 3. "Bad Gateway" (502)
*   Geralmente significa que o Backend ou Frontend não iniciou ou falhou no healthcheck.
*   Verifique: `./scripts/deploy.sh status`.

---

## 🌐 URLs de Produção

| Serviço | URL |
|---------|-----|
| **Frontend** | https://elyon.quadradois.com.br |
| **Backend API** | https://api.elyon.quadradois.com.br |
| **Admin** | https://admin.quadradois.com.br |
| **CRM** | https://crm.quadradois.com.br |

---

**Equipe de DevOps ELYON**
