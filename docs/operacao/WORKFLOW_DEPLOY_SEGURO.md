# Workflow de deploy seguro do ELYON

## Objetivo

Impedir que alterações feitas diretamente na VPS sejam sobrescritas e garantir que cada deploy corresponda a um commit revisável do GitHub.

## Regras

1. Não editar código dentro de `/root/elyon`.
2. Não executar `git pull` manualmente na VPS.
3. Não executar build ou migração com worktree suja.
4. Publicar toda mudança em branch, revisar por PR e integrar em `main`.
5. Implantar informando o SHA exato que está no topo de `origin/main`.
6. Não versionar dumps, exports, `.env`, backups ou secrets.

## Fluxo

```text
branch -> commit -> push -> PR -> checks -> merge em main
       -> confirmar SHA de origin/main -> deploy seguro -> health check
```

### 1. Obter o commit aprovado

```bash
git ls-remote origin refs/heads/main
```

### 2. Implantar

```bash
cd /root/elyon
./scripts/deploy.sh update <sha-exato>
```

O script interrompe a execução quando:

- a branch não é `main`;
- existem alterações ou arquivos não rastreados;
- o SHA informado não é o topo de `origin/main`;
- o Compose é inválido;
- o health check final falha.

O deploy usa fast-forward, não executa `down` e registra o commit implantado no journal e em `/var/lib/elyon-last-deployed-commit`.

## Operações permitidas sem novo deploy

```bash
./scripts/deploy.sh status
./scripts/deploy.sh logs
./scripts/deploy.sh restart
./scripts/deploy.sh clean-build-cache
```

## Guardrails de disco e logs

Instalar uma vez:

```bash
sudo ./scripts/install-ops-guards.sh
```

Verificar:

```bash
systemctl status elyon-disk-monitor.timer
cat /var/lib/elyon-disk-monitor/latest
journalctl -t elyon-disk-monitor
logrotate --debug /etc/logrotate.d/elyon-docker-containers
```

O monitor registra `WARNING` a partir de 80% e `CRITICAL` a partir de 90%. Um webhook opcional pode ser configurado em `/etc/elyon/disk-monitor.env`:

```bash
DISK_ALERT_WEBHOOK_URL=https://endpoint-seguro.example/alerta
```

Não registrar tokens ou credenciais nesse arquivo sem restringi-lo a `0600`.

## Emergência

Em incidente, preservar primeiro:

```bash
git status --short
git diff --binary > /root/elyon-emergency.patch
```

Não usar `git reset --hard`, `git clean`, `docker volume prune` ou exclusão de backups durante resposta ao incidente.
