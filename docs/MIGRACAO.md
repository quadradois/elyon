# Guia de Migração do Elyon para Outro Servidor

> **Data de criação:** Março de 2026  
> Stack: Docker Compose · PostgreSQL 15 + pgvector · Redis 7 · Node.js · Traefik

---

## Visão Geral

```
SERVIDOR ATUAL                    NOVO SERVIDOR
──────────────                    ─────────────
elyon_postgres  ──── dump ──────▶ elyon_postgres (restaurado)
elyon_redis     ── snapshot ────▶ elyon_redis    (restaurado)
/root/elyon/    ─── rsync ──────▶ /root/elyon/
Traefik certs   ── (Let's Encrypt re-emite automaticamente)
```

---

## Pré-requisitos

### Servidor Atual (origem)
- Acesso root / sudo
- Containers `elyon_postgres` e `elyon_redis` em execução
- `rsync` instalado

### Novo Servidor (destino)
```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Instalar Docker Compose plugin (se não vier com Docker)
apt-get install -y docker-compose-plugin

# Instalar rsync
apt-get install -y rsync
```

---

## Passo a Passo

### Etapa 1 — Exportar no servidor atual

```bash
cd /root/elyon
chmod +x scripts/migrate_export.sh scripts/migrate_import.sh

# Opção A: gerar pacote e transferir automaticamente
./scripts/migrate_export.sh root@<IP_NOVO_SERVIDOR>

# Opção B: apenas gerar o pacote (transferir depois)
./scripts/migrate_export.sh
```

O script gera um arquivo `/tmp/elyon_migration_TIMESTAMP.tar.gz` contendo:
- `db/elyon_dump.pgdump` — dump completo do PostgreSQL (formato custom)
- `redis/dump.rdb` — snapshot do Redis (sessões/cache)
- `app/` — todo o código-fonte + `.env` + `secrets/`

---

### Etapa 2 — Transferir o pacote (se não foi automático)

```bash
# No servidor ATUAL
scp /tmp/elyon_migration_TIMESTAMP.tar.gz root@<IP_NOVO>:/tmp/
```

---

### Etapa 3 — Restaurar no novo servidor

```bash
# No NOVO servidor
cd /tmp
tar -xzf elyon_migration_TIMESTAMP.tar.gz

# Entrar no diretório do app exportado
cd /tmp/elyon_export_TIMESTAMP/app

# Executar importação
bash scripts/migrate_import.sh /tmp/elyon_export_TIMESTAMP
```

O script de importação realiza automaticamente:
1. Criação das redes Docker (`elyon_network`, `crm_quadradois_net`)
2. Inicialização do PostgreSQL
3. Restore do banco de dados
4. Inicialização e restore do Redis
5. Build de todos os containers
6. Inicialização completa + migrations Prisma
7. Verificação de saúde do backend

---

### Etapa 4 — DNS e Certificados TLS

1. **Aponte os registros DNS** do domínio para o IP do novo servidor:
   ```
   A  elyon.quadradois.com.br      → <IP_NOVO>
   A  api.elyon.quadradois.com.br  → <IP_NOVO>
   A  quadradois.com.br            → <IP_NOVO>
   A  www.quadradois.com.br        → <IP_NOVO>
   ```

2. O **Traefik** emite os certificados Let's Encrypt automaticamente na primeira requisição.  
   Aguarde 1-2 minutos após o DNS propagar.

3. Se quiser forçar a emissão:
   ```bash
   # Restartar Traefik para forçar renovação
   docker restart elyon_traefik
   ```

---

### Etapa 5 — Evolution API (WhatsApp)

A Evolution API roda como serviço separado. Após a migração:

1. Verifique se a Evolution está configurada:
   ```bash
   curl https://evo.quadradois.com.br/manager
   ```

2. Se a Evolution também precisar migrar, repita processo similar com o `docker-compose.yml` do diretório `evolution/`.

3. **Reconectar instâncias WhatsApp:** Cada instância precisará de um novo QR Code se o servidor mudar. Acesse o Manager da Evolution e clique em "Conectar".

---

## Verificação Pós-Migração

```bash
# Status de todos os containers
docker compose -f /root/elyon/docker-compose.prod.yml ps

# Logs em tempo real
docker logs elyon_backend -f --tail=100

# Testar banco de dados
docker exec elyon_postgres psql -U elyon_user -d elyon -c "\dt"

# Testar Redis
docker exec elyon_redis redis-cli -a "$REDIS_PASSWORD" PING

# Testar endpoints
curl -sf https://api.elyon.quadradois.com.br/health
curl -I https://elyon.quadradois.com.br
```

---

## Rollback (se algo der errado)

```bash
# No NOVO servidor — parar tudo
docker compose -f /root/elyon/docker-compose.prod.yml down

# No SERVIDOR ATUAL — reativar
docker compose -f /root/elyon/docker-compose.prod.yml up -d

# Reverter DNS para o IP antigo
```

---

## Manutenção de Backups Automáticos

O serviço `backup` do `docker-compose.prod.yml` executa automaticamente:
- **Daily:** 03h00 (mantém 7 dias)
- **Weekly:** mantém 4 semanas
- **Monthly:** mantém 6 meses

Backups ficam em `/root/elyon/backups/`.

---

## Variáveis que Podem Precisar de Ajuste no Novo Servidor

| Variável | Motivo |
|----------|--------|
| `FRONTEND_URL` | Se o domínio mudar |
| `BACKEND_URL` | Se o domínio mudar |
| `EVOLUTION_API_URL` | Se a Evolution migrar junto |
| `ACME_EMAIL` | E-mail para certificados Let's Encrypt |
| `AWS_*` | Credenciais S3 (normalmente as mesmas) |

Edite `/root/elyon/.env` antes de executar `migrate_import.sh`.
