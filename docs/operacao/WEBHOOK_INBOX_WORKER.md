# Inbox duravel e worker de webhooks

## Contrato operacional

Os endpoints Evolution, Manus e Asaas autenticam e validam o envelope minimo,
persistem o payload em `webhook_eventos` e respondem `202`. Efeitos de negocio
sao executados somente pelo processo `worker`.
Credenciais de transporte, como `instanceToken` do Evolution, sao validadas mas
nao sao gravadas na inbox.

| Propriedade | Politica |
|---|---|
| Dono | servico Docker `worker` (`dist/worker.js`) |
| Gatilho | polling PostgreSQL a cada 1 s; `FOR UPDATE SKIP LOCKED` |
| Lease | 300 s; evento abandonado volta a ser elegivel |
| Timeout | lease configura o limite de posse; chamadas externas mantem seus timeouts locais |
| Retry | 5 tentativas, backoff exponencial de 5 s ate 15 min |
| Falha final | status `MORTO`, erro sanitizado e payload preservado |
| Idempotencia | chave unica `(provedor, eventoId)` e handlers com transicoes condicionais |

Configuracoes opcionais: `WEBHOOK_WORKER_POLL_MS`,
`WEBHOOK_WORKER_LEASE_SECONDS`, `WEBHOOK_WORKER_BACKOFF_BASE_MS` e
`WEBHOOK_WORKER_BACKOFF_MAX_MS`.

## Saude e observabilidade

O worker expoe internamente `:3001/live`, `:3001/ready` e `:3001/metrics`.
O Prometheus coleta o job `elyon-worker`. As principais series sao:

- `up{job="elyon-worker"}`;
- `elyon_webhook_inbox_events{status="MORTO"}`;
- `elyon_webhook_worker_processed_total{resultado=~"retry|morto"}`;
- `elyon_webhook_worker_last_loop_timestamp_seconds`.

Diagnostico:

```bash
docker compose ps backend worker postgres redis
docker compose logs --tail=200 worker
docker compose exec -T worker node -e "fetch('http://127.0.0.1:3001/ready').then(async r=>console.log(r.status,await r.text()))"
```

## Replay seguro

Antes do replay, identifique e corrija a causa raiz. O comando aceita somente um
UUID em estado `MORTO`, exige motivo com pelo menos oito caracteres e registra
ator, data, motivo e contador. Eventos legados sem payload nao podem ser
reexecutados.

```bash
docker compose exec -T worker node dist/scripts/replay-webhook-inbox.js \
  --id <uuid> \
  --reason "causa corrigida no provedor" \
  --actor "operador@elyon"
```

Depois, acompanhe o evento ate `CONCLUIDO` e confirme os efeitos no dominio. Nao
altere o status diretamente no banco: isso perde a trilha de auditoria.

## Reinicio e recuperacao

Parar a API nao interrompe o worker. Parar o worker preserva todos os eventos no
PostgreSQL; ao reiniciar, itens pendentes e leases expirados sao retomados. O
deploy valida `/ready` do worker e o rollback reutiliza a mesma imagem do backend.
