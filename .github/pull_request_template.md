## Issue

Closes #

## Mudanca e motivacao

<!-- Resuma o que mudou, por que agora e o impacto para usuarios/operacao. -->

## Validacao

<!-- Liste comandos executados, cenarios e resultados. -->

- [ ] Testes unitarios/type-check/build aplicaveis passaram
- [ ] Testes de integracao ou smoke foram executados quando aplicaveis
- [ ] Nao depende de dados compartilhados ou de producao

## Revisao de risco

- [ ] Autenticacao, autorizacao, tenant e PII foram avaliados
- [ ] Logs, erros e artefatos nao expoem secrets ou dados sensiveis
- [ ] Compatibilidade REST/WS/eventos foi preservada ou a quebra possui ADR
- [ ] Migration foi testada em banco vazio e em caminho de upgrade, ou nao se aplica

## Rollout, observabilidade e rollback

<!-- Descreva flags, ordem, owner, timeout, sinais e procedimento de rollback. -->

- [ ] Health checks/metricas/logs permitem validar o rollout, ou nao se aplica
- [ ] Rollback de aplicacao e implicacoes de schema foram descritos
- [ ] Documentacao/runbook/ADR foram atualizados quando necessario
