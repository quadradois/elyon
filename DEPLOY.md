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
