# Pipeline CI/CD de produção

## Fluxo

1. Todo pull request para `main` executa testes do backend, type-check, build do frontend, validação dos arquivos Compose e build das imagens da aplicação.
2. `main` aceita merge somente com os checks obrigatórios aprovados.
3. Um push em `main` repete o pipeline e abre um deployment no ambiente GitHub `production`.
4. O ambiente exige aprovação humana antes de liberar a chave SSH.
5. O runner valida que o SHA solicitado é exatamente o topo de `origin/main` na VPS.
6. A VPS cria backup do PostgreSQL, preserva as imagens atuais, constrói o release, executa migrations, inicia os serviços e verifica API, CRM e site.
7. Falha de build, migration, inicialização ou health check restaura as imagens anteriores da aplicação. Migrations devem permanecer retrocompatíveis, pois rollback automático de schema não é seguro.

## Acesso SSH

A chave usada pelo GitHub Actions é exclusiva para CI e sua entrada em `authorized_keys` usa `restrict` e forced-command. Ela não abre shell, não permite forwarding e aceita somente:

```text
probe <sha-completo>
deploy <sha-completo>
```

O wrapper rejeita SHA diferente do topo de `origin/main` e serializa deployments com `flock`.

## Secrets do ambiente `production`

- `PRODUCTION_SSH_HOST`
- `PRODUCTION_SSH_USER`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_SSH_KNOWN_HOSTS`

Nunca adicionar esses valores ao repositório, artefatos ou logs.

## Evidências operacionais

- Commit implantado: `/var/lib/elyon-last-deployed-commit`
- Eventos do wrapper: `journalctl -t elyon-ci-deploy`
- Eventos do deploy: `journalctl -t elyon-deploy`
- Backups: `/root/elyon/backups`
- Estado do monitor de disco: `/var/lib/elyon-disk-monitor/latest`

## Recuperação

Se a restauração automática das imagens não recuperar a aplicação:

1. Bloquear novos deployments no ambiente `production`.
2. Consultar os journals e `docker compose ps`.
3. Confirmar o último SHA em `/var/lib/elyon-last-deployed-commit`.
4. Restaurar explicitamente o release anterior e validar os três endpoints.
5. Não reverter migration de banco sem plano específico e backup verificado.
