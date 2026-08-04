# Backup off-host e restore drill

## Contrato operacional

- **Owners:** `platform-sre` (execução e alertas) e `backend` (integridade do schema).
- **Destino:** Cloudflare R2 por API S3, em repositório Restic criptografado.
- **RPO provisório:** 1 hora.
- **RTO provisório:** 4 horas.
- **Retenção remota:** 48 snapshots horários, 30 diários e 6 mensais.
- **Retenção local off-host:** nenhum dump duplicado após confirmação do
  snapshot no R2; configurável por `ELYON_OFFHOST_LOCAL_KEEP`.
- **Retenção local de restauração rápida:** 2 backups pré-deploy, 3 diários,
  2 semanais e 2 mensais.
- **Revisão:** trimestral e após mudança relevante de banco ou storage.

As credenciais ficam somente em `/root/backup_r2.env`, modo `0600`. O arquivo
deve definir `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `RESTIC_REPOSITORY` e
`RESTIC_PASSWORD`; valores nunca entram no repositório, logs ou evidências.

## Instalação e agenda

O deploy instala `elyon-offhost-backup.timer` e
`elyon-storage-maintenance.timer`, remove apenas a entrada legada de
`/root/backup_r2.sh` do crontab e preserva os demais jobs. O timer persistente
executa no minuto 05 de cada hora:

```bash
systemctl status elyon-offhost-backup.timer
systemctl list-timers elyon-offhost-backup.timer
journalctl -u elyon-offhost-backup.service --since=-2h
```

Cada execução cria um `pg_dump` consistente, testa o gzip, calcula SHA-256 e
envia dump e checksum ao Restic com a tag `elyon-db-hourly`. Depois que o
snapshot remoto é confirmado, o dump horário local é removido; a retenção
histórica é aplicada pelo Restic no R2. O timer de manutenção limita os backups
locais, remove parciais interrompidos, limita o journal a 500 MB e, somente a
partir de 85% de uso do disco, limpa cache de build e imagens Docker dangling.
Às 03:05 UTC o backup também
executa `prune` e uma leitura amostral de integridade do repositório.

Para disparo controlado fora da agenda:

```bash
systemctl start elyon-offhost-backup.service
systemctl show elyon-offhost-backup.service -p Result -p ExecMainStatus
```

## Métricas e alertas

O status atômico em `backups/status/offhost.env` é montado somente para leitura
no backend. O Prometheus recebe horário, resultado, duração e tamanho do último
backup, além do último restore drill. Alertas críticos são gerados quando:

- a última tentativa falha por 10 minutos;
- não existe backup bem-sucedido nos últimos 90 minutos;
- não existe restore drill aprovado nos últimos 90 dias.

### Backup falhou ou está atrasado

1. Consultar `systemctl status` e o journal, sem imprimir o arquivo de credenciais.
2. Verificar espaço local, saúde do PostgreSQL, DNS/rede e lock do Restic.
3. Executar `restic unlock` apenas após confirmar que não há outro processo ativo.
4. Reexecutar o serviço e confirmar que as métricas voltaram a `1` e idade < 90 min.

## Restore drill isolado

O drill nunca altera o PostgreSQL de produção. Ele restaura o dump mais recente
em um container sem rede e volume temporário, valida gzip/SHA-256, aplica SQL com
`ON_ERROR_STOP`, conta tabelas, migrations, tenants e leads, compara o tempo ao
RTO e remove container, volume e arquivos temporários ao sair.

```bash
cd /root/elyon
sudo scripts/ops/restore-drill-r2.sh latest
```

A evidência sem dados de negócio nem segredos fica em
`/var/lib/elyon/restore-drills/restore-drill-<UTC>.json`. Para verificar:

```bash
systemctl show elyon-offhost-backup.timer -p ActiveState -p NextElapseUSecRealtime
restic snapshots --tag elyon-db-hourly --latest 5
cat /var/lib/elyon/restore-drills/restore-drill-<UTC>.json
docker ps -a --filter name=elyon_restore_drill
docker volume ls --filter name=elyon_restore_drill
```

Os dois últimos comandos devem ficar vazios após o drill. Um restore real exige
incidente declarado, janela aprovada, bloqueio de escrita e plano específico;
não reutilize o container temporário do drill para produção.
