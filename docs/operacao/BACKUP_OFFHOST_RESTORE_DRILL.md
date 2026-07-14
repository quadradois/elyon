# Backup off-host e restore drill do ELYON

## Estado e decisões

Owner técnico: `platform-sre`. Owner de dados: `platform-data`.

| Item | Estado em 14/07/2026 |
|---|---|
| Destino | Cloudflare R2, repositório Restic criptografado |
| Integridade do repositório | `restic check` sem erros, 14 snapshots |
| Último snapshot observado | 14/07/2026 03:00:01 CEST |
| Retenção | 7 diários, 4 semanais e 6 mensais |
| RPO | **Proposta pendente de aprovação: 6 horas** |
| RTO | **Proposta pendente de aprovação: 4 horas** |
| Canal externo de alerta | Pendente de configuração |
| Restore drill | Pendente de aprovação dos objetivos |

O backup local em `/root/elyon/backups` não é off-host e não protege contra
perda da VPS. Em 14/07/2026 ele ocupava 9,7 GB e o filesystem raiz estava em
96%; não apagar dumps antes de concluir e validar o restore drill.

## Arquitetura

1. O container `elyon_backup` cria um dump PostgreSQL comprimido.
2. `run-offhost-backup.sh` valida o gzip e envia o dump mais recente ao Restic.
3. Restic cifra, deduplica e grava no R2, depois aplica a retenção aprovada.
4. `restic check` valida índices, snapshots, árvores e blobs diariamente.
5. `check-offhost-backup.sh` consulta o snapshot e alerta quando sua idade
   ultrapassa RPO + tolerância.
6. O restore drill baixa o dump do R2, valida tamanho/checksum e restaura em um
   PostgreSQL temporário sem rede, com dados em tmpfs e sem volumes de produção.

O provedor R2 já está selecionado. O segredo do repositório Restic e as
credenciais R2 precisam de cópia de custódia fora da própria VPS; sem essa
custódia, a perda total do host ainda pode impedir a recuperação.

## Configuração segura

Use `scripts/ops/offhost-backup.env.example` somente como referência. O arquivo
real fica em `/etc/elyon/offhost-backup.env`, pertence a `root:root`, modo `0600`
e nunca é versionado.

Além das credenciais Restic/R2, configure um endpoint externo compatível com
payload `{"text":"..."}`:

```bash
export OFFHOST_ALERT_WEBHOOK_URL=https://endpoint-seguro.example/alerta
```

Não passe credenciais ou o webhook na linha de comando e não publique valores
em logs, issues ou PRs.

## Instalação após aprovação

O instalador exige a confirmação explícita dos objetivos e recusa ativar timers
sem canal externo de alerta:

```bash
sudo ./scripts/install-offhost-backup.sh \
  --rpo-hours 6 \
  --rto-hours 4 \
  --approve-objectives \
  --disable-legacy-cron
```

Ele preserva uma cópia do crontab, remove apenas a entrada legada
`/root/backup_r2.sh`, instala units systemd e executa os modos `--check` antes de
ativar qualquer escrita off-host.

Verifique:

```bash
systemctl list-timers 'elyon-offhost-*'
systemctl status elyon-offhost-backup.timer elyon-offhost-freshness.timer
journalctl -u elyon-offhost-backup.service -u elyon-offhost-freshness.service
sudo cat /var/lib/elyon-offhost-backup/latest.env
sudo cat /var/lib/elyon-offhost-backup/freshness.env
```

## Backup manual controlado

```bash
sudo OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  ./scripts/ops/run-offhost-backup.sh --check

sudo OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  ./scripts/ops/run-offhost-backup.sh --apply --confirm-offhost-write
```

O modo `--apply` gera primeiro um dump local novo, valida o gzip, cria snapshot,
aplica retenção e registra evidência sem conteúdo do banco ou segredos.

## Restore drill isolado

Pré-condições:

- imagem `pgvector/pgvector:0.8.0-pg15` já presente; o script não faz pull;
- espaço em disco para o dump comprimido + 512 MB;
- memória disponível para tmpfs de 6 GB;
- nenhum outro restore drill em execução;
- snapshot recente e `restic check` verde.

Execute primeiro a inspeção sem mutação:

```bash
sudo OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  ./scripts/ops/run-offhost-restore-drill.sh --check
```

Depois da janela aprovada:

```bash
sudo OFFHOST_ENV_FILE=/etc/elyon/offhost-backup.env \
  ./scripts/ops/run-offhost-restore-drill.sh \
  --apply --confirm-isolated-restore
```

O container usa `--network none`, banco em tmpfs e nenhum volume do ELYON. O
gate exige restore SQL sem erros, migrations concluídas, tabelas públicas e as
tabelas críticas `tenants`, `usuarios`, `leads` e `webhook_eventos`. O container
e o dump temporário são removidos mesmo em falha.

A evidência fica em:

```text
/var/lib/elyon-offhost-backup/restore-drills/YYYYMMDDTHHMMSSZ.env
```

Ela registra snapshot, checksum, duração, RTO, contagem de tabelas/migrations e
isolamento, sem PII.

## Aceite por segunda pessoa

A segunda pessoa deve, sem auxílio de quem executou o drill:

1. localizar a evidência mais recente;
2. confirmar `status=success`, `critical_tables=4` e duração menor que o RTO;
3. verificar que o container temporário não existe mais;
4. confirmar que produção continuou saudável;
5. registrar nome, data e resultado na issue #12, sem anexar segredos.

## Rollback operacional

Se a automação falhar, desative somente os timers novos e restaure o crontab
preservado em `/var/lib/elyon-offhost-backup/`:

```bash
systemctl disable --now elyon-offhost-backup.timer elyon-offhost-freshness.timer
```

Não apague snapshots R2, dumps locais, volumes Docker ou o arquivo de
credenciais durante o incidente. Corrija a causa e execute `--check` antes de
reativar os timers.
