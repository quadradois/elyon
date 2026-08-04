# Deploy do Elyon

**Owner:** `platform-sre`
**Ultima validacao:** 2026-07-14

O deploy de producao ocorre exclusivamente pelo pipeline protegido do GitHub,
depois do merge em `main`. A VPS usa `/root/elyon/docker-compose.yml`; nao faca
edicoes, `git pull`, migrations ou builds manuais no host.

Consulte a fonte operacional unica:

- [Runbook operacional](docs/operacao/RUNBOOK_OPERACIONAL.md)
- [Pipeline CI/CD](docs/operacao/PIPELINE_CI_CD_PRODUCAO.md)
- [Workflow de deploy seguro](docs/operacao/WORKFLOW_DEPLOY_SEGURO.md)

Verificacao segura na VPS:

```bash
cd /root/elyon
./scripts/deploy.sh status
cat /var/lib/elyon-last-deployed-commit
curl --fail https://api.elyon.ia.br/ready
```

O guia anterior foi preservado apenas como registro historico em
`docs/guias/DEPLOY_LEGADO.md` e nao deve ser executado.

## Copilot de agenda do especialista

O deploy do Copilot deve ocorrer com `AGENDA_SPECIALIST_COPILOT_ENABLED=false`.
Depois da migracao aditiva e dos smokes do link legado, habilite o recurso apenas
para o tenant definido em `AGENDA_PILOT_TENANT_ID`, com policy, commands e effects
tambem ativos e com um cutoff UTC aprovado. `AGENDA_REMINDER_MINUTES=60` controla
o lembrete de proximidade.

Para rollback, desligue somente `AGENDA_SPECIALIST_COPILOT_ENABLED`. O webhook
deixa de interceptar respostas de especialistas e o link publico continua sendo
o caminho operacional. As tabelas novas permanecem inertes e nao devem ser
removidas durante rollback da aplicacao.

Se for necessario executar o rollback operacional de RLS, reaplique depois o
isolamento completo com `prisma/rls/apply-tenant-rls.sql`; esse script cobre as
tabelas centrais e as tres tabelas tenant-safe do Copilot.
