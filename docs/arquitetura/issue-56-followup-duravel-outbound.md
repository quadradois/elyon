# Issue #56 — follow-up outbound duravel

## Contrato e estados

`FollowupOutbound` e o agregado operacional ligado exclusivamente a `Tenant` e
`Lead.id`. PostgreSQL e a fonte de verdade. Estados: `PENDENTE`, `REIVINDICADO`,
`EXECUTADO`, `CANCELADO`, `EXPIRADO` e `FALHO`. O registro preserva UTC,
timezone IANA, expressao original, motivo, evidencia, origem, policy, tentativas,
corpo exato da mensagem, retry, lease, fencing, idempotencia e reason codes. Os campos legados do Lead
permanecem apenas como espelho de compatibilidade durante o rollout.

## Policy temporal

`followup-v1` aceita data local explicita ou `amanha HH:mm` somente com timezone
IANA valido. Data sem hora e recusada; nenhum horario e inventado. Horarios permitidos: 08:00 inclusive ate 20:00 exclusivo. Segundos
e milissegundos sao zerados. Datas passadas, timezone desconhecido, expressoes
insuficientes e instantes inexistentes/duplicados por DST falham fechados e
exigem confirmacao. Conversao usa `date-fns-tz`, nunca offset manual.

## Idempotencia, concorrencia e efeitos

A equivalencia e SHA-256 de tenant, Lead, UTC, motivo normalizado e policy; o
texto nao altera a identidade operacional. Em concorrencia, a primeira mensagem
persistida permanece autoritativa e a outra chamada retorna
`FOLLOWUP_EQUIVALENTE_EXISTENTE`. Um advisory lock por tenant/Lead elimina a
janela de concorrencia. Reagendamento exige `followupId` explicito na tool/API,
cancela o ativo com `REAGENDAMENTO` e cria o substituto na mesma transacao.
`DELIVERY_UNKNOWN`, `DELIVERY_RECONCILIATION_REQUIRED` ou intencao `RESERVADO`
recusam reagendamento com reason code fail-closed antes de qualquer cancelamento.

O claimer usa `FOR UPDATE SKIP LOCKED`, lease e fencing monotonicamente crescente.
Antes do envio uma transacao revalida ownership, estado, lease, opt-out, modos
HUMANO/PAUSADO, campanha, telefone, expiracao e resposta recente, e reserva a
intencao. O provider executa fora da transacao com chave idempotente. Apenas a
confirmacao fenced grava mensagem e `EXECUTADO`. Intencao `RESERVADO` apos crash
fica fail-closed para reconciliacao, sem reenvio automatico.

Falha comprovadamente anterior ao envio remove a reserva e agenda retry com
backoff exponencial deterministico baseado em `tentativas`. O limite default e
3, configuravel por `FOLLOWUP_MAX_ATTEMPTS` entre 1 e 10; o esgotamento usa
`RETRY_EXHAUSTED` sem novo claim. Falha ambigua usa `DELIVERY_UNKNOWN`, sem retry automatico.
O worker e o cron legado compartilham o mesmo claimer duravel.

## Observabilidade e seguranca

`elyon_followup_outbound_events_total{resultado}` cobre criado, deduplicado,
reagendado, cancelado, reivindicado, executado, retry, expirado, falho, takeover
e bloqueios. `elyon_followup_outbound_schedule_lag_seconds` mede atraso. Labels e
logs nao carregam UUID, tenant, Lead, telefone, nome, evidencia ou mensagem.

## Rollout, limpeza e rollback

1. aplicar migration expand-only e subir worker/backend;
2. observar claims, bloqueios, retries, lag e intencoes reservadas;
3. comparar ativos do agregado com `dataRecontato` legado;
4. apos estabilidade, criar issue separada para limpar campos legados.

Rollback: parar o claimer novo e reverter binarios, preservando tabelas e dados.
Nao reativar o job antigo de scan por Lead, pois ele nao possui fencing/outbox.
Registros pendentes permanecem recuperaveis para roll-forward. A migration nao
remove nem transforma dados existentes.

## Evidencias de regressao

A validacao local reproduzivel usou PostgreSQL 15 com pgvector 0.8 e Redis 7.4,
aplicou as quatro migrations desde banco vazio e executou o caminho real do
agregado sem chamadas externas. O gate direcionado e composto por 34 cenarios automatizados:

- 15 cenarios de baseline real: criacao concorrente com mensagens diferentes,
  payload real do
  ChatPanel pela API ate a persistencia, restart e takeover,
  gates HUMANO, PAUSADO e opt-out, reagendamento atomico, retry comprovadamente
  anterior ao envio com limite, falha ambigua fail-closed, takeover entre envio
  e confirmacao, reagendamento real pela API e pelo use case da tool, tres gates
  fail-closed de reagendamento ambiguo e isolamento de dois tenants;
- 7 cenarios temporais: data relativa com timezone IANA, timezone invalido, tres
  expressoes ambiguas, passado, horario proibido e instantes DST inexistente ou
  duplicado, incluindo recusa explicita de `DD/MM/YYYY` sem hora;
- 9 cenarios de contrato/governanca do use case e da tool, incluindo identidade
  canonica, policy/evidencia obrigatorias e ausencia de promocao de texto livre;
- 1 cenario de scrape das metricas, verificando ausencia de PII em nomes e labels.
- 2 cenarios frontend que provam o payload de criacao e o `followupId` explicito.

Comandos: `npm run build`, testes unitarios direcionados e
`npm run test:baseline -- followup-outbound.integration.test.ts`. Resultado:
builds backend/frontend verdes, 17 testes backend direcionados, 2 testes frontend
e 15 testes de baseline verdes. O deploy de migrations foi executado duas vezes
e `prisma migrate diff --exit-code` confirmou drift zero.
