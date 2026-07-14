# Runbook operacional de producao

**Owner primario:** `platform-sre`
**Owners de apoio:** `backend` e `security`
**Ultima validacao:** 2026-07-14, contra a VPS de producao
**Revisao:** trimestral e apos mudanca de topologia, deploy, backup ou segredos

Este documento e a fonte operacional canonica do Elyon. Guias historicos e
diagnosticos em outros diretorios nao autorizam comandos em producao.

## Fonte de verdade e topologia

- Repositorio na VPS: `/root/elyon`.
- Compose unico: `/root/elyon/docker-compose.yml`.
- Rede externa: `elyon_network`; integracao compartilhada: `crm_quadradois_net`.
- Release implantado: SHA completo em `/var/lib/elyon-last-deployed-commit`.
- Deploy: GitHub Actions, ambiente protegido `production`, chamando o wrapper
  SSH restrito. Nao editar codigo nem executar `git pull` manualmente na VPS.

| Servico Compose | Container | Funcao |
|---|---|---|
| `backend` | `elyon_backend` | API e metricas internas |
| `worker` | `elyon_worker` | processamento assincrono |
| `frontend` | `elyon_frontend` | CRM web |
| `site` | `elyon_site` | site institucional |
| `postgres` | `elyon_postgres` | PostgreSQL 15 + pgvector |
| `redis` | `elyon_redis` | cache e filas |
| `traefik` | `elyon_traefik` | proxy reverso e TLS |
| `prometheus` | `elyon_prometheus` | metricas e alertas internos |
| `backup` | `elyon_backup` | backup local pre-deploy e agendado |
| `audio_converter` | `elyon_audio_converter` | conversao de audio |

Inventario seguro:

```bash
cd /root/elyon
docker compose config --services
docker compose ps
git rev-parse HEAD
cat /var/lib/elyon-last-deployed-commit
```

Os dois SHAs devem ser iguais depois de um deploy concluido.

## Deploy

Fluxo normal:

```text
branch -> PR -> checks -> merge em main -> deploy protegido -> smoke test
```

O pipeline valida Compose, testes, migrations em banco vazio, imagens e SHA. Na
VPS, `scripts/deploy.sh update <sha>` cria backup local, preserva as imagens
anteriores, aplica migrations retrocompativeis, sobe os servicos e testa API,
worker, CRM e site. Consulte detalhes em
[Pipeline CI/CD](./PIPELINE_CI_CD_PRODUCAO.md) e
[Workflow de deploy seguro](./WORKFLOW_DEPLOY_SEGURO.md).

Validacao pos-deploy:

```bash
cd /root/elyon
./scripts/deploy.sh status
curl --fail https://api.elyon.ia.br/live
curl --fail https://api.elyon.ia.br/ready
curl --fail --output /dev/null https://crm.elyon.ia.br
curl --fail --output /dev/null https://elyon.ia.br
```

## Rollback de aplicacao

Falha durante o deploy restaura automaticamente as imagens anteriores. Se a
falha surgir depois, declare incidente e:

1. bloqueie novos deployments no ambiente `production`;
2. confirme o SHA e consulte `journalctl -t elyon-ci-deploy` e
   `journalctl -t elyon-deploy`;
3. identifique as tags `rollback-<sha-anterior>` sem remove-las;
4. restaure backend, worker, frontend e site com as imagens preservadas;
5. valide os quatro checks acima e registre o SHA efetivamente servido.

Rollback de imagem nao reverte schema. Migrations devem ser retrocompativeis;
qualquer reversao de dados exige backup verificado e plano especifico.

## Backup e restore

O backup local e executado antes de cada deploy. O PostgreSQL tambem possui dump
horario criptografado no Cloudflare R2 via Restic, com RPO de 1 hora, RTO de 4
horas e restore drill isolado. Credenciais permanecem apenas em
`/root/backup_r2.env` com modo `0600`.

Comandos de verificacao:

```bash
systemctl status elyon-offhost-backup.timer
journalctl -u elyon-offhost-backup.service --since=-2h
cd /root/elyon
sudo scripts/ops/restore-drill-r2.sh latest
```

Procedimento completo: [Backup off-host e restore drill](./BACKUP_OFFHOST_E_RESTORE.md).
Restore no banco de producao somente com incidente declarado, janela aprovada,
bloqueio de escrita e plano de retorno.

## Rotacao de segredos

1. declare janela, owner e servicos consumidores;
2. confirme backup e restore recentes;
3. gere o novo valor diretamente na VPS, sem ecoar em terminal ou logs;
4. atualize o arquivo correto (`/root/elyon/secrets/`, `.env` modo `0600` ou
   `/root/backup_r2.env`), preservando temporariamente a versao anterior quando
   o protocolo exigir dupla leitura;
5. recrie apenas os servicos consumidores e valide readiness e integracoes;
6. revogue o valor anterior e registre apenas identificador, data e resultado.

Para chaves de criptografia de credenciais, seguir obrigatoriamente
[Rotacao da chave de criptografia](../operacoes/ROTACAO_CHAVE_CRIPTOGRAFIA.md).
Nunca publicar valores em commits, tickets, evidencias ou comandos gravados no
historico.

## Incidentes

Prioridade inicial:

1. preservar evidencia: horario, SHA, `docker compose ps`, readiness e journals;
2. conter o impacto sem apagar volumes, backups ou tags de rollback;
3. decidir entre recuperar dependencia, rollback de imagem ou restore de dados;
4. validar API, worker, CRM, site, backup e alertas;
5. registrar causa, periodo de impacto, acao e follow-up.

Comandos seguros de triagem:

```bash
cd /root/elyon
docker compose ps
docker compose logs --since=15m backend worker traefik
curl --fail https://api.elyon.ia.br/ready
cat /var/lib/elyon-disk-monitor/latest
systemctl list-timers --all | grep elyon
```

Nao usar durante resposta a incidente: `git reset --hard`, `git clean`,
`docker volume prune` ou exclusao de backups. Alertas e diagnostico detalhado:
[Observabilidade e SLO](./OBSERVABILIDADE_E_SLO.md).

## Checklist de revisao

- `bash scripts/ops/verify-runbooks.sh` aprovado.
- `docker compose config --services` coincide com a tabela de topologia.
- Links e owners revisados.
- Deploy, rollback, backup/restore, segredos e incidentes continuam executaveis.
- Data de ultima validacao atualizada apos teste seguro na VPS.
