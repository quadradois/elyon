# Observabilidade, health checks e SLO inicial

## Objetivo e ownership

Esta camada fornece sinais mínimos para operar o ELYON antes da próxima onda
arquitetural. O owner primário de disponibilidade é `platform-sre`; erros e
latência da aplicação pertencem a `backend`.

| Sinal | Objetivo inicial | Janela | Alerta |
|---|---:|---:|---|
| Disponibilidade do backend | 99,5% | 30 dias | scrape ou readiness falhando por 2 min |
| Respostas HTTP 5xx | < 5% | 5 min | acima do limite por 5 min |
| Latência HTTP p95 | < 2 s | 5 min | acima do limite por 10 min |
| Memória residente do Node.js | < 1,5 GB | instantâneo | acima do limite por 10 min |

Os limiares gerais continuam provisórios. Os guardrails por rota, saturação e
custo são derivados do [baseline de capacidade e FinOps](./CAPACIDADE_E_FINOPS.md)
e devem ser recalibrados com tráfego real.

## Contrato dos endpoints

- `GET /live`: verifica somente se o processo HTTP está vivo. Não consulta
  dependências e é usado pelo healthcheck do container.
- `GET /ready`: verifica PostgreSQL e Redis em paralelo, com timeout individual.
  Retorna `200` quando tudo está pronto e `503` quando o backend deve sair do
  balanceamento.
- `GET /health` e `GET /api/saude`: aliases compatíveis de `/ready`.
- `GET /metrics`: formato Prometheus. Em produção aceita apenas acesso direto
  pela rede Docker; requisições encaminhadas pelo Traefik recebem `404`.

As métricas HTTP usam a rota parametrizada completa, como
`/api/leads/:id`, sem incluir valores de IDs. O orquestrador publica
`elyon_orchestrator_turns_total`, `elyon_orchestrator_duration_seconds`,
`elyon_orchestrator_tokens_total` e `elyon_orchestrator_cost_usd_total`.

O Traefik consulta `/ready` a cada 10 segundos. O deploy também aguarda esse
endpoint antes de registrar o novo SHA; falha persistente aciona a restauração
automática das imagens anteriores.

## Coleta e retenção

O serviço `elyon_prometheus` coleta `backend:3000/metrics` a cada 15 segundos,
avalia `observability/prometheus/alerts.yml` e mantém até 15 dias ou 2 GB no
volume `prometheus_data`. Alterações de configuração são recarregadas em até 30
segundos, sem reinício manual. O Prometheus não publica porta no host.

Validações operacionais:

```bash
curl --fail https://api.elyon.ia.br/live
curl --fail https://api.elyon.ia.br/ready
docker compose exec -T prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose exec -T prometheus promtool check rules /etc/prometheus/alerts.yml
docker compose ps
```

Para listar alertas ativos sem expor o Prometheus:

```bash
docker compose exec -T prometheus \
  wget -qO- 'http://127.0.0.1:9090/api/v1/alerts'
```

## Resposta a alertas

### Backend indisponível

1. Confirmar `docker compose ps backend traefik prometheus`.
2. Consultar `docker compose logs --since=15m backend traefik`.
3. Se começou após release, comparar o SHA com
   `/var/lib/elyon-last-deployed-commit` e executar o rollback documentado no
   pipeline de produção.

### Backend não pronto

1. Consultar `/ready` e identificar `postgres` ou `redis` com status `down`.
2. Verificar saúde e logs da dependência, sem reiniciar o banco como primeira
   ação.
3. Restaurar a dependência; o Traefik recoloca o backend automaticamente após a
   próxima resposta `200`.

### Dependência indisponível

- PostgreSQL: conferir espaço, conexões, I/O e `pg_isready`.
- Redis: conferir memória, persistência, autenticação e `redis-cli ping`.
- Escalar para `platform-sre` se durar 2 minutos; comunicar Produto se durar 10.

### Taxa de erros alta

1. Correlacionar `status_code`, rota, release e `correlationId` nos logs.
2. Separar falha interna de indisponibilidade de provedor.
3. Reverter o release quando houver correlação temporal e impacto crescente.

### Latência alta

1. Comparar p95 com CPU, heap, event loop, PostgreSQL e Redis.
2. Identificar rota/integração dominante e limitar carga custosa se necessário.
3. Abrir incidente de capacidade se persistir sem mudança de release.

### Saturação de memória

1. Verificar heap, RSS, reinícios e volume de requisições.
2. Capturar evidência antes de reiniciar o processo.
3. Tratar crescimento contínuo como possível vazamento; tratar pico como
   capacidade insuficiente.

## Estados esperados e teste controlado

| Estado | `/live` | `/ready` | Traefik |
|---|---:|---:|---|
| saudável | 200 | 200 | recebe tráfego |
| Redis ou PostgreSQL indisponível | 200 | 503 | retira backend |
| processo indisponível | falha | falha | retira backend |

O teste degradado deve ser feito em ambiente isolado ou janela controlada. Não
interrompa PostgreSQL/Redis em produção apenas para validar o alerta.
