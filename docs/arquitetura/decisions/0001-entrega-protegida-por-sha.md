# ADR-0001: entrega versionada e deploy por SHA

Data: 2026-07-13

Estado: aceita

## Contexto

Alteracoes diretas na VPS nao sao revisaveis e podem divergir do GitHub. O
release precisa associar codigo, checks e evidencia operacional ao mesmo commit.

## Decisao

Toda mudanca usa issue, branch, PR e merge em `main`. O deployment recebe o SHA
completo do topo de `origin/main`; a chave de CI usa forced-command e nao oferece
shell. O deploy cria backup, preserva imagens, aplica migrations e executa smoke.

## Consequencias

O GitHub passa a ser a fonte de verdade e cada release e auditavel. A estrategia
exige migrations retrocompativeis. Protecoes server-side da `main` e reviewer do
ambiente continuam como melhoria necessaria; ate la, os mesmos gates sao regra
obrigatoria de processo.

## Rollout e rollback

O rollout segue o workflow `ci-backend.yml`. Falhas restauram imagens anteriores;
schema e dados exigem plano especifico e backup verificado. O SHA implantado fica
em `/var/lib/elyon-last-deployed-commit` e nos journals operacionais.
