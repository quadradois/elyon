# Runbook — Observabilidade do ciclo de vida da Agenda

## Sinais

| Sinal | Consulta/alerta | Ação |
|---|---|---|
| Rejeições | `rate(elyon_agenda_lifecycle_decisions_total{resultado="rejeitado"}[5m])` | Segmentar por `reason_code`; confirmar proteção esperada ou regressão. |
| Conflitos | taxa acima de 5% por 10 min | Verificar clientes com versão obsoleta e payload divergente. |
| Replays | razão `replay / aceito` acima de 20% por 15 min | Investigar polling/retry agressivo; não reprocessar efeitos manualmente. |
| Vencidos | `elyon_agenda_lifecycle_expired_pending > 0` por 15 min | Classificar `REALIZADO` ou `NAO_COMPARECEU`. |
| Idade da fila | `elyon_agenda_lifecycle_operational_queue_age_seconds > 3600` | Acionar o responsável operacional. |
| Outbox | aumento de efeitos em `reconciliacao` | Pausar efeitos e reconciliar pelo `correlationId`. |

## Privacidade

Labels aceitas são códigos fechados de resultado, motivo e fase. Nome, telefone, e-mail, CPF, conversa, mensagem e justificativa não podem aparecer em métricas ou logs. Correlação usa somente IDs técnicos.

## Diagnóstico

1. Localize o `correlationId` no ledger e na outbox.
2. Compare versão esperada, versão atual, estado, fase e `reasonCode`.
3. Confirme um único resultado lógico por chave idempotente.
4. Para efeito em `RECONCILIACAO`, confirme o provedor antes de retry.
5. Registre a decisão sem copiar PII para logs.

## Critérios de parada

- mutação tardia por `CANCELAR` ou `REAGENDAR`;
- duplicação de milestone ou efeito;
- vazamento de PII;
- fila acima de uma hora sem owner;
- conflito ou erro transitório acima de 5% por 10 minutos.
