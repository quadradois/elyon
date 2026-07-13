# Workflow de engenharia

## Prioridade e estado

| Sinal | Uso |
|---|---|
| `priority:P0` | risco critico; tratar imediatamente |
| `priority:P1` | proxima onda de fundacao |
| `priority:P2` | evolucao planejada |
| `workflow:ready` | criterios e dependencias permitem iniciar |
| `workflow:blocked` | depende de decisao ou estado externo identificado |

Uma issue so recebe `workflow:ready` quando possui contexto, aceite verificavel,
risco, dependencias e estrategia de validacao. Ao descobrir nova dependencia,
registre-a na issue e troque o estado para `workflow:blocked`.

## Branch e worktree

Parta do topo de `origin/main` e use uma branch por issue:

```bash
git fetch origin main
git worktree add ../elyon-issue-N -b agent/issue-N-descricao origin/main
```

Nao misture mudancas de issues distintas. Preserve worktrees sujas e selecione
arquivos explicitamente no commit.

## Pull request e Definition of Done

O PR deve conter `Closes #N`, preencher o template e demonstrar os criterios da
constituicao. Merge ocorre somente depois dos checks aplicaveis. A issue fecha
automaticamente pelo merge; deploy e validacao devem ser registrados quando a
mudanca afeta runtime.

## Estado real das protecoes em 2026-07-13

- A API do GitHub nao retorna branch protection para `main` e nao ha ruleset no
  repositorio. Portanto, a exigencia de PR/checks ainda e uma regra de processo,
  nao um bloqueio server-side.
- O ambiente `production` aceita somente branches protegidas, mas nao possui
  reviewer obrigatorio configurado.
- O workflow versionado executa CI em PR/push e deploy automatico em push para
  `main`, usando SSH restrito e smoke externo.

Enquanto as protecoes server-side nao forem configuradas, auto-merge so deve ser
habilitado depois de todos os checks verdes e o SHA implantado deve ser conferido
na execucao do workflow.

## Rollout e rollback

Para producao, siga [Pipeline CI/CD](../operacao/PIPELINE_CI_CD_PRODUCAO.md) e
[Deploy seguro](../operacao/WORKFLOW_DEPLOY_SEGURO.md). Cada PR de runtime deve
definir owner, timeout, sinais de sucesso, condicao de abortar e diferenca entre
rollback da aplicacao e rollback de dados/schema.
