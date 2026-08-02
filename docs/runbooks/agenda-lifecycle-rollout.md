# Runbook — Rollout do ciclo de vida da Agenda

## Pré-condições

- migração expand-only validada;
- builds, contratos, matriz de 40 cenários e benchmark verdes;
- tenant piloto e corte aprovados por escrito;
- dashboard, plantão e rollback definidos.

## Flags e escopo

`AGENDA_LIFECYCLE_POLICY_ENABLED` e `AGENDA_LIFECYCLE_COMMANDS_ENABLED` ficam desligadas por padrão. O escopo exige `AGENDA_PILOT_TENANT_ID` e `AGENDA_PILOT_STARTED_AT_UTC`; configuração incompleta falha fechada.

## Onda 0 — política

1. Configure tenant e corte aprovados.
2. Ative apenas `AGENDA_LIFECYCLE_POLICY_ENABLED=true`.
3. Observe uma janela operacional completa.
4. Pare diante de qualquer critério do runbook de observabilidade.

## Onda 1 — comandos

1. Exija aprovação explícita do checkpoint da Onda 0.
2. Ative `AGENDA_LIFECYCLE_COMMANDS_ENABLED=true` apenas no piloto.
3. Valide painel, agente, links, fallback e no-show.
4. Libere efeitos só depois de confirmar ledger e outbox coerentes.

## Rollback sem perda

1. Desative efeitos, depois comandos e por último política.
2. Não reverta a migração nem remova enums.
3. Preserve ledger, milestones e outbox.
4. Mova entregas incertas para `RECONCILIACAO`.
5. Reabra somente após análise e novo corte.

T062 e T063 não são concluídas por merge ou deploy: exigem autorização operacional no momento da ativação e evidência da janela observada.
