# Baseline de capacidade e FinOps

## Status, escopo e segurança

- **Owners:** `platform-sre` e `backend`
- **Baseline:** 14/07/2026, máquina local com 8 CPUs lógicas, 15,9 GiB de RAM,
  Node.js 24.15 e Docker 29.6.1
- **Status:** guardrail inicial proposto; a aprovação ocorre pelo merge da issue #19
- **Evidência reproduzível:**
  [`CAPACITY_BASELINE_2026-07-14.json`](./CAPACITY_BASELINE_2026-07-14.json)

O ensaio usa PostgreSQL e Redis efêmeros, banco vazio migrado e fixture própria.
O executor recusa os hosts de produção mesmo quando a execução remota é
habilitada. Nenhuma carga foi enviada à produção e nenhum provedor externo de IA
foi chamado.

## Como reproduzir

Com backend, PostgreSQL e Redis isolados e as variáveis usuais configuradas:

```bash
npm run capacity:prepare --workspace @elyon/backend
CAPACITY_BASELINE_TARGET=http://127.0.0.1:3109 \
CAPACITY_BASELINE_OUTPUT=../../../docs/operacao/capacity-baseline-local.json \
npm run capacity:run --workspace @elyon/backend
npm run capacity:cleanup --workspace @elyon/backend
```

O nome do banco deve conter `baseline`, `integration` ou `test`. Um alvo remoto
exige `CAPACITY_BASELINE_ALLOW_REMOTE=true`, mas os domínios e o IP de produção
continuam bloqueados. A limpeza preserva dados que não pertençam à fixture.

## Resultado

Cada cenário foi aquecido por 500 ms e medido por 5 s. Os limites seguros usam
60% do throughput observado; os alertas de latência reservam aproximadamente 2x
o p95 medido.

| Cenário | Concorrência | Throughput | Erros | p50 | p95 | p99 | Limite seguro |
|---|---:|---:|---:|---:|---:|---:|---:|
| Login | 2 | 16,13 req/s | 0% | 114 ms | 210 ms | 331 ms | 9,68 req/s |
| Lista de leads (100 itens) | 8 | 32,59 req/s | 0% | 234 ms | 362 ms | 461 ms | 19,55 req/s |
| Entrada de webhook | 4 | 17,97 req/s | 0% | 36 ms | 1.649 ms | 3.562 ms | 10,78 req/s |
| Control plane do orquestrador | 4 | 88,30 turnos/s | 0% | 46 ms | 50 ms | 53 ms | 52,98 turnos/s |

O cenário do orquestrador inclui 40 ms de latência simulada e mede apenas o
control plane. A capacidade ponta a ponta depende do provedor e deve ser aferida
com telemetria real antes de qualquer decisão de escala.

## Saturação e gargalos

- O webhook é o gargalo prioritário: a mediana é baixa, mas a cauda chega a
  3,56 s. Antes de elevar seu limite, perfilar autenticação, consulta da instância
  e inserção na inbox.
- A listagem de leads atingiu o maior atraso de event loop, 121 ms no p99. Manter
  paginação máxima de 100 e revisar plano/índices com volume representativo.
- Login é limitado pelo custo de hash de senha; preservar rate limit e não usar
  o throughput local como licença para remover proteção contra abuso.
- O pico do processo foi 298 MB de RSS e 152 MB de heap. PostgreSQL teve zero
  rollback, temporários ou deadlocks; Redis teve zero conexões rejeitadas e
  aumentou cerca de 55 KB de memória.

## Plano de capacidade aprovado pelo merge

1. Manter o monólito: este baseline não apresenta evidência para extrair
   microsserviços.
2. Aplicar os limites seguros como guardrails iniciais por instância e alertar
   nos p95 de 500 ms para login, 750 ms para leads e 3,5 s para webhook.
3. Alertar quando o event loop p99 superar 200 ms por 10 minutos.
4. Repetir em staging equivalente à produção, por pelo menos 15 minutos, antes
   de aumentar réplicas, pool de banco ou concorrência do worker.
5. Toda decisão de escala deve anexar o relatório JSON, a série temporal real e
   a comparação com este baseline.

## FinOps do orquestrador

A projeção usa 1.200 tokens de entrada e 300 de saída por turno, com coeficientes
configuráveis de US$ 0,002 e US$ 0,008 por mil tokens, respectivamente.

| Volume | Custo projetado |
|---:|---:|
| 1 turno | US$ 0,0048 |
| 1.000 turnos | US$ 4,80 |
| 100.000 turnos | US$ 480,00 |
| 1.000.000 turnos | US$ 4.800,00 |

O backend expõe contadores de turnos, duração, tokens e custo estimado. O alerta
horário de US$ 5 é um detector inicial de anomalia, não um orçamento mensal. Os
coeficientes devem acompanhar o modelo efetivamente contratado, e cache, retries
e falhas precisam permanecer visíveis na análise.

## Resposta aos novos alertas

### Limite de cenário excedido

1. Confirmar a rota, taxa de erro, volume e release no mesmo intervalo.
2. Comparar CPU, event loop, PostgreSQL e Redis com os picos deste documento.
3. Reduzir concorrência/carga custosa; reverter se a regressão começou no release.
4. Não elevar o limite sem novo ensaio reproduzível e evidência anexada.

### Event loop saturado

1. Correlacionar com rota, CPU, GC, heap e tamanho das respostas.
2. Capturar perfil antes de reiniciar; procurar trabalho síncrono no caminho quente.
3. Escalar para `backend` se persistir por 10 minutos.

### Custo horário anormal

1. Verificar volume de turnos, tokens por direção, retries e modelo utilizado.
2. Comparar custo por tenant/campanha e interromper loops ou abuso identificados.
3. Atualizar os coeficientes quando houver troca de modelo ou contrato.
