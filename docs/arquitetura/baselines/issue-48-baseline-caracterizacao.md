# Baseline de caracterização do fluxo outbound — Issue #48

Data: 2026-07-14

Baseline: `main@aecd650`

Decisões de entrada: ADR-0002 e ADR-0003 aceitos

Owner: backend/arquitetura

Correção de segurança associada: [#52](https://github.com/quadradois/elyon/issues/52)

## Objetivo e limites

Esta baseline congela comportamentos observáveis antes da Onda 1. Ela não corrige
identidade, estados, tools, prompts ou campanhas e não cria schema ou migrations.
Todos os dados do harness são sintéticos. PostgreSQL 15 com pgvector e Redis 7 são
reais e efêmeros; LLM, Evolution, agenda, voz e demais efeitos externos são doubles
determinísticos sem rede.

O caminho exercitado é:

`Lead → campanha → serviço real de disparo → recibo WebhookEvento → claim/lease → executor real do worker → processarEvento → handler Evolution real → resolução pela sessão confiável → agente/tool determinísticos → persistência → replay/restart`.

O executor foi extraído do `worker.ts` para um serviço reutilizável; o worker e a suíte
chamam a mesma função. O teste atravessa `processarEvento` e o handler Evolution reais.
Somente LLM/orquestrador, WhatsApp/Evolution, voz, mídia e tools são determinísticos.
O tenant é derivado de `SessaoWhatsapp.instanceName`; `tenantId` presente no payload é
ignorado como autoridade. A busca do Lead é limitada ao tenant confiável.

## Arquitetura do harness

- `test/baseline/support/outbound-baseline-harness.ts`: fixtures para dois tenants e
  eventos no formato Evolution, sem reimplementar o worker.
- `src/servicos/webhook-worker-executor.ts`: executor compartilhado pelo worker e teste.
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
| B04 | mensagens sequenciais | lote PostgreSQL tenant-safe com lease | ordem preservada, 1 execução/resposta, replay e restart cobertos | Automatizado na #54 | suportado/gate |
| B05 | histórico, briefing e fato RAG | contrato `RagFact@1.0`, fronteiras distintas e seleção tenant/Lead-safe | gate suportado | Automatizado | suportado pela Issue #55 |
| B06 | comando de qualificação | mesmo `Lead.id` | 1 Lead, 1 inbound | Automatizado | suportado/gate |
| B07 | evidência candidata suficiente | outreach `LEAD`; CRM `NOVO` | policy/evidence em `schemaState` | Automatizado | suportado/gate |
| B08 | pedido explícito de retorno | contrato → persistência → claim/fencing → gates → intenção → envio double → confirmação | gate suportado | Automatizado | suportado pela Issue #56 |
| B09 | intenção de agenda sem dia/hora/timezone | CRM inalterado | 0 atividades de avaliação | Automatizado | suportado/gate |
| B10 | opt-out seguido de seleção para disparo | `CONTATANDO → OPTOUT` | seletor real retorna 0 elegíveis | Automatizado | suportado/gate |
| B11 | modo `HUMANO` | estado preservado | 0 LLM, 0 resposta IA | Automatizado | suportado/gate |
| B12 | mesmo evento duas vezes | recibo único | contagens permanecem 1 | Automatizado | suportado/gate |
| B13 | lease expirado | `PROCESSANDO → CONCLUIDO` | tentativas = 2 | Automatizado | suportado/gate |
| B14 | tool falha após duas escritas na transação | recibo concluído com fallback | 0 observação e 0 atividade parcial | Automatizado | suportado/gate |
| B15 | tentativa cross-tenant | Lead estrangeiro inalterado | 0 efeitos estrangeiros | Automatizado | suportado/gate |
| B16 | cancelamento, reagendamento e no-show | agenda, estado atual, ledger e milestones coerentes | transação default-deny e tenant-safe | Automatizado | gate suportado pela #57 |
| B17 | policy candidata | evidência sem promoção CRM | `status=NOVO` | Automatizado | suportado/gate |

## Analisador agregado sem PII

O modo autorizado executa todas as consultas em uma transação PostgreSQL `READ ONLY`.
Sem `BASELINE_ANALYSIS_AUTHORIZED=true`, falha fechado antes de consultar o banco.
O resultado contém somente contagens de baixa cardinalidade. Valores desconhecidos são
somados em `__UNKNOWN__`; UUIDs, nomes, telefones, mensagens, endereços e valores livres
nunca são emitidos. O CI semeia agregados sintéticos, executa o SQL autorizado contra
o schema migrado, valida o contrato JSON e abre uma segunda transação read-only que
tenta um `INSERT`; sucesso do job exige que PostgreSQL rejeite essa escrita.

Métricas: distribuições de `StatusLead`, `statusProspeccao`, `modoAtendimento` e
`faseSPIN`; nulos/desconhecidos; opt-out com atividade posterior; atividade IA durante
modo humano; follow-ups/agendas inválidos; candidatos à quarentena e cobertura agregada
da policy candidata.

## Baseline agregada real

- Fonte: `approved-read-only-session`.
- Data/hora UTC: `2026-07-15T01:02:39.051Z`.
- SHA da `main` analisada: `a5d603345e98b7ad1973301cdef131769d4ebd29`.
- Contrato da fonte: `source=authorized-read-only`.
- Proteção de escrita: `readOnlyWriteRejected=true`.
- SHA-256 do artefato validado: `7c694ee3b34614209ab3bbc1891e302344a56adc60b1a437a343aee95d7e80e4`.

Distribuições agregadas observadas:

| Dimensão | Bucket | Contagem |
|---|---|---:|
| `statusLead` | nenhum registro | 0 |
| `statusProspeccao` | nenhum registro | 0 |
| `modoAtendimento` | nenhum registro | 0 |
| `faseSPIN` | `__NULL__` | 1 |

Contradições agregadas:

| Métrica | Contagem |
|---|---:|
| opt-out com atividade posterior | 0 |
| atividade de IA durante modo humano/pausado | 0 |
| follow-up inválido | 0 |
| agendamento inválido | 0 |

Candidatos à quarentena:

| Métrica | Contagem |
|---|---:|
| outreach nulo ambíguo | 0 |
| outreach desconhecido | 0 |
| qualificado legado sem evidência de policy | 0 |
| negociação sem evidência determinística | 0 |
| morno futuro sem follow-up válido | 0 |

O total estimado da quarentena nesta fonte é **0**. A soma é adequada para esta
amostra porque todos os buckets candidatos são zero; ela não demonstra sobreposição
entre categorias. A fonte possuía população candidata de qualificação igual a zero:
`hasSituation=0`, `hasMotivation=0`, `hasProblemEvidence=0`, `hasImplication=0` e
`hasCandidatePolicyEvidence=0`. Portanto, a execução valida o estado atual da fonte,
mas não permite inferir cobertura efetiva da policy em Leads existentes.

O JSON passou por validação estrutural e revisão adicional. Ele contém somente
contagens numéricas de baixa cardinalidade e metadados do contrato; não contém PII,
host, banco, usuário, credencial, URL de conexão, UUID, telefone, nome, mensagem,
endereço, resultado por tenant ou registro individual. O artefato bruto não foi
versionado.

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

- O handler Evolution real é exercitado, com somente bordas externas determinísticas.
- B16 permanece como lacuna/reclassificação; B04 passou a gate durável na #54 e B05 a gate suportado na #55.
- `schemaState` é usado apenas em fixture sintética; nenhum contrato novo é imposto.
- A análise real depende de autorização externa e papel de banco read-only.
- Cleanup por tenant usa cascata do schema e remove inbox/chaves Redis por run ID.
- Em interrupção abrupta, o banco/Redis efêmeros do job são destruídos pelo CI.

## Segurança: compatibilidade, rollout e rollback (#52)

A limitação da resolução ao tenant de `SessaoWhatsapp.instanceName` é uma mudança real
de segurança em produção, não um seam semanticamente neutro. Instâncias registradas
permanecem compatíveis com o mesmo payload. Instâncias desconhecidas passam a receber
rejeição permanente e não disparam busca global por telefone.

Rollout:

1. inventariar sessões ativas e confirmar correspondência de `instanceName` antes do deploy;
2. publicar mantendo logs estruturados de heartbeat/processamento e métricas do worker;
3. acompanhar eventos `MORTO` por instância desconhecida e validar sessões legítimas;
4. confirmar que telefone idêntico em tenants distintos nunca cruza a sessão confiável.

Rollback:

- se uma sessão legítima for rejeitada, pausar o consumidor afetado e corrigir seu
  cadastro em `SessaoWhatsapp` antes de reprocessar;
- reverter a proteção restaura compatibilidade anterior, mas reabre o risco cross-tenant
  e só deve ser usado como contenção temporária aprovada;
- `tenantId` fornecido no payload nunca deve ser usado como mitigação ou autoridade.

## Recomendações para derivação da Onda 1

Após revisão/merge da #48, derivar issues separadas, nesta ordem:

1. porta transacional/injetável para processamento Evolution e debounce durável (B04);
2. resolução canônica tenant-safe `leadId` no caminho real, protegida por B03/B15;
3. executor idempotente de comandos e operações compostas, protegido por B10–B14;
4. coerência agenda/estado comercial para cancelamento, reagendamento e no-show (B16);
5. backfill/quarentena somente depois da baseline agregada real autorizada.

Nenhuma dessas implementações faz parte da #48.
