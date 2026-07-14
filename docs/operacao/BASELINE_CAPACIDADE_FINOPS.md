# Baseline de capacidade e FinOps

## Objetivo e escopo

O baseline transforma desempenho, saturacao e custo em um gate reproduzivel do
CI. Ele cobre quatro caminhos prioritarios:

| Cenario | Caminho exercitado | Dependencias reais |
|---|---|---|
| Login | validacao, bcrypt, JWT, refresh token e auditoria | PostgreSQL e Redis |
| Leads | autenticacao, cache de usuario e consulta paginada de 1.000 leads | PostgreSQL e Redis |
| Webhook | autenticacao Asaas, hash, idempotencia e persistencia no inbox | PostgreSQL |
| Orquestrador | guardrails, selecao de agente, contexto, cache, persistencia e telemetria | PostgreSQL e Redis |

O job nunca envia carga para producao. O servidor HTTP, banco e cache existem
somente dentro do runner do GitHub Actions.

## Provedor de IA controlado

O teste injeta um executor deterministico no ponto de chamada do SDK. Todo o
fluxo do orquestrador antes e depois do provedor continua real, mas nao ha chamada
externa, consumo de chave ou faturamento. Por isso:

- a latencia medida para o orquestrador representa o overhead do ELYON;
- a latencia de rede e inferencia do modelo deve ser somada a partir da telemetria do provedor;
- tokens e custos sao hipoteses configuraveis, nao uma fatura;
- nenhuma rota ou flag de teste e adicionada ao servidor de producao.

## Execucao e evidencias

O job `Capacidade - baseline efemero` aplica as migrations oficiais em banco
vazio e executa:

```bash
npm run test:capacity --workspace @elyon/backend
```

O comando recusa qualquer PostgreSQL cujo nome nao comece com
`elyon_capacity` e qualquer Redis diferente do database `/14`. Nao existe bypass
para apontar esta suite a producao.

O perfil de CI gera dois arquivos no artefato `capacity-baseline`:

- `baseline.json`: evidencia estruturada para comparacao automatica;
- `baseline.md`: resumo humano com throughput, p50, p95, p99, erros,
  saturacao, limites seguros e projecoes FinOps.

As evidencias ficam retidas por 30 dias. O relatorio registra sistema operacional,
versao do Node e quantidade de vCPUs para impedir comparacoes sem contexto.

## Gates iniciais

| Cenario | p95 maximo | Erros maximos | Concorrencia CI |
|---|---:|---:|---:|
| Login | 1.500 ms | 1% | 4 |
| Leads | 1.000 ms | 1% | 12 |
| Webhook | 750 ms | 1% | 12 |
| Orquestrador sem provedor | 2.000 ms | 1% | 3 |

Os tetos sao gates de regressao, nao SLOs de produto. O limite seguro inicial
de vazao e calculado como 70% do throughput observado no mesmo runner. Escalar
vertical ou horizontalmente antes de sustentar carga acima desse limite.

## Saturacao e gargalos

Cada cenario coleta CPU do processo, RSS, heap, atraso do event loop, transacoes
e blocos do PostgreSQL, comandos e memoria do Redis. Para diagnosticar falha:

1. erro alto com baixa saturacao indica contrato, autenticacao ou dependencia;
2. p95 alto com CPU alta indica limite de processo ou bcrypt/orquestracao;
3. p95 alto com blocos lidos crescentes indica consulta/indice do PostgreSQL;
4. event loop alto com CPU moderada indica operacao sincrona ou callback bloqueante;
5. memoria crescente entre execucoes exige perfil de heap antes de ampliar a VPS.

## Modelo FinOps

As variaveis `CAPACITY_AI_INPUT_TOKENS`, `CAPACITY_AI_OUTPUT_TOKENS`,
`TOKEN_CUSTO_INPUT_1K` e `TOKEN_CUSTO_OUTPUT_1K` controlam a simulacao. Antes de
aprovar capacidade ou orcamento:

1. selecionar o modelo realmente usado pelo tenant;
2. atualizar precos por mil tokens;
3. substituir a hipotese de tokens pela mediana/p95 da telemetria real;
4. projetar turnos mensais e margem de 30% para picos/retries;
5. separar custo do provedor de custo fixo da VPS, PostgreSQL, Redis e storage.

## Recalibracao e teste em ambiente compartilhado

Recalibrar depois de mudanca relevante em consulta, bcrypt, middleware,
orquestrador, tamanho medio de payload ou infraestrutura. Comparar apenas
execucoes do mesmo perfil e classe de runner.

Teste em homologacao ou producao exige janela aprovada, owner de operacao,
limite de requisicoes, dados anonimizados, rollback e observacao de SLO. A suite
do CI nao possui endereco nem credenciais de producao e nao deve ser adaptada
para recebe-los.
