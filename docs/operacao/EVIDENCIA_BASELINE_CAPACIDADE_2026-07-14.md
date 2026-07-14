# Evidencia do baseline de capacidade - 2026-07-14

## Rastreabilidade

- Issue: [#19](https://github.com/quadradois/elyon/issues/19)
- Pull request: [#39](https://github.com/quadradois/elyon/pull/39)
- Execucao: [CI/CD ELYON #29350528566](https://github.com/quadradois/elyon/actions/runs/29350528566)
- Artefato: `capacity-baseline`, retencao de 30 dias
- Data UTC: `2026-07-14T16:40:30.324Z`
- Ambiente: Linux Azure runner, Node 20.20.2, 4 vCPU
- Trafego de producao: nao
- Provedor de IA: deterministico, sem rede e sem faturamento

## Resultados observados

| Cenario | Requisicoes | Concorrencia | req/s | p50 ms | p95 ms | p99 ms | Erros |
|---|---:|---:|---:|---:|---:|---:|---:|
| Login | 40 | 4 | 46,53 | 79,25 | 90,74 | 135,09 | 0% |
| Leads | 150 | 12 | 123,72 | 95,62 | 140,51 | 149,36 | 0% |
| Webhook | 120 | 12 | 702,94 | 16,42 | 19,45 | 24,88 | 0% |
| Orquestrador | 30 | 3 | 136,52 | 21,69 | 27,18 | 31,84 | 0% |

Todos os cenarios passaram os gates vigentes na execucao de referencia.

## Saturacao e dependencias

| Cenario | CPU agregada | RSS pico | Event loop p95 | PostgreSQL | Redis |
|---|---:|---:|---:|---|---|
| Login | 340,54% | 215,53 MB | 12,11 ms | 41 commits; 0 rollbacks | 41 comandos; 0 rejeicoes |
| Leads | 244,87% | 230,72 MB | 32,13 ms | 696 commits; 0 rollbacks; 2 blocos lidos | 150 cache hits; 0 misses |
| Webhook | 180,78% | 231,05 MB | 16,27 ms | 120 respostas 202; assercao explicita adicionada ao gate seguinte | 0 rejeicoes |
| Orquestrador | 207,21% | 232,18 MB | 10,94 ms | 125 commits; 0 rollbacks | 241 comandos; 0 rejeicoes |

A CPU e percentual agregado entre os quatro vCPUs do runner, portanto pode
ultrapassar 100%. O pico de RSS do processo permaneceu abaixo de 233 MB.

O coletor de estatisticas do PostgreSQL nao publicou deltas do cenario webhook
dentro da janela subsegundo. Para remover essa ambiguidade, o harness passou a
validar diretamente a quantidade de eventos persistidos no inbox, alem do status
HTTP e da ausencia de erros.

## Limites seguros iniciais

Aplicando 70% do throughput observado:

| Cenario | Limite seguro inicial |
|---|---:|
| Login | 32,57 req/s |
| Leads | 86,60 req/s |
| Webhook | 492,06 req/s |
| Orquestrador sem provedor | 95,56 req/s |

Esses limites valem apenas para uma instancia equivalente ao runner. A VPS deve
ser calibrada em homologacao ou janela aprovada antes de usar os numeros como
capacidade contratual.

## Gates derivados

Foi aplicada margem proxima de 5 vezes o p95 observado, com arredondamento e
piso por classe de operacao:

| Cenario | p95 observado | Novo gate p95 | Margem aproximada |
|---|---:|---:|---:|
| Login | 90,74 ms | 500 ms | 5,5x |
| Leads | 140,51 ms | 750 ms | 5,3x |
| Webhook | 19,45 ms | 100 ms | 5,1x |
| Orquestrador sem provedor | 27,18 ms | 250 ms | 9,2x |

A taxa maxima de erros permanece em 1%. O alerta de producao global p95 de 2 s
nao foi reduzido porque inclui rede, proxy, payloads reais e provedores externos
que o benchmark controlado deliberadamente exclui.

## FinOps de IA

Hipotese: 750 tokens de entrada e 120 de saida por turno; US$ 0,002/1k tokens de
entrada e US$ 0,008/1k de saida.

| Volume mensal | Custo estimado |
|---:|---:|
| 1 turno | US$ 0,00246 |
| 1.000 turnos | US$ 2,46 |
| 10.000 turnos | US$ 24,60 |
| 100.000 turnos | US$ 246,00 |
| 1.000.000 turnos | US$ 2.460,00 |

Os valores nao sao faturamento. Tarifas e distribuicao de tokens devem ser
substituidas pelos dados do modelo real antes de decisao financeira.

## Decisoes

- Nao extrair microservicos com base nesta evidencia; nao ha gargalo estrutural demonstrado.
- Escalar CPU/replicas primeiro no caminho de login, mantendo a seguranca do bcrypt.
- Preservar paginacao de leads, cache Redis e inbox/worker duravel.
- Somar a latencia real do LLM ao overhead medido do orquestrador.
- Reexecutar o baseline em toda alteracao relevante e antes de ampliar carga sustentada.
