# Baseline de caracterização do fluxo outbound — Issue #48

Data: 2026-07-14  
Baseline: `main@aecd650`  
Decisões de entrada: ADR-0002 e ADR-0003 aceitos  
Owner: backend/arquitetura

## Objetivo e limites

Esta baseline congela comportamentos observáveis antes da Onda 1. Ela não corrige
identidade, estados, tools, prompts ou campanhas e não cria schema ou migrations.
Todos os dados do harness são sintéticos. PostgreSQL 15 com pgvector e Redis 7 são
reais e efêmeros; LLM, Evolution, agenda, voz e demais efeitos externos são doubles
determinísticos sem rede.

O caminho exercitado é:

`Lead → campanha → disparo determinístico → recibo WebhookEvento → claim/lease do worker → resolução tenant-safe → agente determinístico → comando transacional → persistência → replay/restart`.

O handler Evolution de produção permanece acoplado a um grafo amplo de serviços.
Para não introduzir uma alteração comportamental na #48, o harness reutiliza a inbox,
o lease, o retry e os modelos reais, mas injeta o agente/comandos dentro do teste.
Essa fronteira é uma evidência, não um mock permissivo: os cenários que dependem do
debounce ou da coerência agenda/CRM atuais aparecem como probes de falha conhecida.

## Arquitetura do harness

- `test/baseline/support/outbound-baseline-harness.ts`: relógio controlado, fixtures
  para dois tenants, doubles e orquestração determinística.
- `test/baseline/outbound-baseline.integration.test.ts`: comportamentos suportados;
  falha do teste bloqueia regressão.
- `test/baseline/known-defects.integration.test.ts`: probes verdes que demonstram
  explicitamente o comportamento indesejado atual, sem corrigi-lo.
- `src/scripts/analisar-baseline-estados.ts`: analisador agregado read-only e modo
  sintético para CI.
- job `Baseline outbound - caracterizacao`: infraestrutura dedicada e timeout de 12 min.

Proteções: `NODE_ENV=test`, banco chamado `elyon_integration`, Redis database `/15`,
fixtures com prefixo/run UUID, deleção por tenant/evento e chaves Redis registradas.

## Matriz de cobertura

| ID | Precondição/estímulo | Antes → depois | Efeitos e contagens | Observado | Classificação |
|---|---|---|---|---|---|
| B01 | Lead elegível; dois disparos/claims | `AGUARDANDO → CONTATANDO` | 1 envio, 1 mensagem, 1 claim | Automatizado | suportado/gate |
| B02 | webhook aceito | sem efeito antes do worker | 1 recibo `PENDENTE` | Automatizado | suportado/gate |
| B03 | mesmo telefone em dois tenants | apenas Lead do tenant do evento | 0 mensagens no outro tenant | Automatizado | suportado/gate |
| B04 | duas mensagens sequenciais | dois eventos independentes | 2 chamadas, sem consolidação durável | Automatizado | expected-failure/probe |
| B05 | histórico e evidência sintéticos | contexto determinístico | decisão reproduzível | Automatizado | suportado/gate |
| B06 | comando de qualificação | mesmo `Lead.id` | 1 Lead, 1 inbound | Automatizado | suportado/gate |
| B07 | evidência candidata suficiente | outreach `LEAD`; CRM `NOVO` | policy/evidence em `schemaState` | Automatizado | suportado/gate |
| B08 | pedido explícito de retorno | `AGUARDANDO → MORNO_FUTURO` | data UTC e motivo presentes | Automatizado | suportado/gate |
| B09 | texto sem dia/hora | CRM inalterado | 0 atividades de avaliação | Automatizado | suportado/gate |
| B10 | opt-out e replay | qualquer → `OPTOUT` | 1 recibo, 1 inbound | Automatizado | suportado/gate |
| B11 | modo `HUMANO` | estado preservado | 0 LLM, 0 resposta IA | Automatizado | suportado/gate |
| B12 | mesmo evento duas vezes | recibo único | contagens permanecem 1 | Automatizado | suportado/gate |
| B13 | lease expirado | `PROCESSANDO → CONCLUIDO` | tentativas = 2 | Automatizado | suportado/gate |
| B14 | comando falha | `PENDENTE → RETRY` | 0 inbound, 0 mutação Lead | Automatizado | suportado/gate |
| B15 | tentativa cross-tenant | Lead estrangeiro inalterado | 0 efeitos estrangeiros | Automatizado | suportado/gate |
| B16 | visita cancelada | CRM permanece `VISITA_AGENDADA` | agenda `CANCELADO` | Automatizado | expected-failure/probe |
| B17 | policy candidata | evidência sem promoção CRM | `status=NOVO` | Automatizado | suportado/gate |

## Analisador agregado sem PII

O modo autorizado executa todas as consultas em uma transação PostgreSQL `READ ONLY`.
Sem `BASELINE_ANALYSIS_AUTHORIZED=true`, falha fechado antes de consultar o banco.
O resultado contém somente contagens de baixa cardinalidade. Valores desconhecidos são
somados em `__UNKNOWN__`; UUIDs, nomes, telefones, mensagens, endereços e valores livres
nunca são emitidos.

Métricas: distribuições de `StatusLead`, `statusProspeccao`, `modoAtendimento` e
`faseSPIN`; nulos/desconhecidos; opt-out com atividade posterior; atividade IA durante
modo humano; follow-ups/agendas inválidos; candidatos à quarentena e cobertura agregada
da policy candidata.

### Resultado disponível nesta PR

Somente o dataset sintético foi executado. Ele prova o formato e as proteções, mas seus
números não representam produção. Não houve sessão read-only aprovada nem cópia
anonimizada disponibilizada ao agente; portanto, o tamanho real da quarentena permanece
**não medido** e a PR deve continuar draft até decisão do reviewer sobre essa evidência.

## Comandos e timeouts

```bash
# baseline completa; requer PostgreSQL/pgvector e Redis dedicados
npm run test:baseline                         # timeout CI: 8 min

# contrato seguro do analisador no CI
npm run baseline:analyze:synthetic --workspace @elyon/backend  # 1 min

# somente em sessão explicitamente aprovada e read-only
BASELINE_ANALYSIS_AUTHORIZED=true npm run baseline:analyze:readonly --workspace @elyon/backend
```

O job completo tem timeout de 12 minutos. Não há sleeps longos: tempo funcional usa
relógio controlado; lease expirado é preparado por timestamp explícito.

## Riscos, lacunas e limpeza

- O executor determinístico é uma porta de teste, não o handler Evolution completo.
- B04 e B16 demonstram lacunas atuais e não devem ser reinterpretados como sucesso.
- `schemaState` é usado apenas em fixture sintética; nenhum contrato novo é imposto.
- A análise real depende de autorização externa e papel de banco read-only.
- Cleanup por tenant usa cascata do schema e remove inbox/chaves Redis por run ID.
- Em interrupção abrupta, o banco/Redis efêmeros do job são destruídos pelo CI.

## Recomendações para derivação da Onda 1

Após revisão/merge da #48, derivar issues separadas, nesta ordem:

1. porta transacional/injetável para processamento Evolution e debounce durável (B04);
2. resolução canônica tenant-safe `leadId` no caminho real, protegida por B03/B15;
3. executor idempotente de comandos e operações compostas, protegido por B10–B14;
4. coerência agenda/estado comercial para cancelamento, reagendamento e no-show (B16);
5. backfill/quarentena somente depois da baseline agregada real autorizada.

Nenhuma dessas implementações faz parte da #48.
