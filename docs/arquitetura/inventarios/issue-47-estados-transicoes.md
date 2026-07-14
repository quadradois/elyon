# Inventario tecnico: estados e transicoes da Issue #47

Data: 2026-07-14

Baseline: `origin/main@ddfe859`

Profundidade: padrao, por evidencia estatica. Confianca geral: alta para codigo
versionado; desconhecida para distribuicao dos dados de producao, reservada a
baseline #48.

## Mandato e exclusoes

Reconstruir o AS-IS de estados sem alterar runtime, schema, migrations, prompts,
tools, campanhas ou frontend. O ADR-0002 e premissa. A #48 nao e executada nem
antecipada.

## Buscas reproduziveis

```bash
rg -n -i --glob '!**/node_modules/**' --glob '!**/dist/**' \
  'StatusLead|statusProspeccao|modoAtendimento|faseSPIN|StatusAgendamento' \
  pacotes/backend/src pacotes/frontend/src pacotes/backend/prisma

rg -n -i \
  'QUALIFICADO|EM_NEGOCIACAO|MORNO_FUTURO|MEIO_CAMPO|DESCOBERTA|DIAGNOSTICO_SPIN|PITCH|AGENDAMENTO|FOLLOW_UP|RECUO|OPENER|PRESENTER|CLOSER' \
  pacotes/backend/src pacotes/frontend/src pacotes/backend/prisma
```

Snapshot de ocorrencias: `StatusLead` 33 arquivos/115 linhas;
`statusProspeccao` 40/136; `modoAtendimento` 14/50; `faseSPIN` 9/18;
`QUALIFICADO` 29/70; `EM_NEGOCIACAO` 11/18; `MORNO_FUTURO` 7/14;
fases do roteiro 86/557; agendamento 13/65.

## Registro de evidencias

| ID | Classe | Fato observado | Fonte | Confianca |
|---|---|---|---|---|
| E01 | fonte canonica atual | `StatusLead` possui nove valores, sem `QUALIFICADO` ou `EM_NEGOCIACAO` | `schema.prisma:879-889` | alta |
| E02 | divergencia bloqueante | `statusProspeccao` e String livre e o comentario omite `MORNO_FUTURO` usado no runtime | `schema.prisma:750-752`; `agendar-followup.usecase.ts` | alta |
| E03 | estado operacional | `modoAtendimento` e String livre `IA/HUMANO/PAUSADO` | `schema.prisma:759` | alta |
| E04 | estado conversacional | `Conversa.faseSPIN` e String livre e inclui `QUALIFICADO` | `schema.prisma:1283-1292` | alta |
| E05 | estado conversacional | roteiro possui sete fases e guards em Markdown | `roteiro-governanca.ts:4-181` | alta |
| E06 | divergencia bloqueante | gate comercial aceita legados, recuos livres e unknown como permitido | `mover-para-fase.usecase.ts:52-91` | alta |
| E07 | compatibilidade transitoria | `QUALIFICADO` ainda roteia agentes e qualifica prioridade | `agent-chain.ts`; `servico-priorizacao-leads.ts` | alta |
| E08 | compatibilidade transitoria | `EM_NEGOCIACAO` aparece em policy, webhook e use cases, mas nao no enum | arquivos listados abaixo | alta |
| E09 | fonte canonica atual | agendamento possui enum proprio com cinco estados | `schema.prisma:1250-1256` | alta |
| E10 | divergencia bloqueante | opt-out altera outreach e encerra conversa sem executor/idempotency key | `registrar-optout.usecase.ts` | alta |
| E11 | fato | ADR-0002 separa identidade, outreach, comercial e conversa | `ADR-0002:78-96` | alta |
| E12 | desconhecido | volumes por valor, estados impossiveis e combinacoes em producao | reservado a #48 | baixa |

## AS-IS por dimensao

| Dimensao real | Representacao atual | Owner de fato | Problema |
|---|---|---|---|
| comercial | `Lead.status: StatusLead` | CRM/tools/rotas | comentarios ligam status a agentes/fases; legados fora do enum |
| outreach | `Lead.statusProspeccao: String?` | campanhas/webhook/jobs | null e valores livres acumulam semanticas |
| qualificacao | campos SPIN, `podeQualificar`, `QUALIFICADO` legado | use cases/agente | resultado e progresso nao possuem fonte unica |
| conversa | `faseSPIN`, proximoPasso e fases de roteiro | orquestrador/LLM | vocabularios diferentes e regras em prompt |
| atendimento | `modoAtendimento: String` | webhook/operador | bloqueio concorrente distribuido |
| follow-up | `dataRecontato` + `MORNO_FUTURO` + Atividade | jobs/tools | estado misturado ao outreach |
| agendamento | `StatusAgendamento` + status comercial | agenda/tools | eventos podem alterar duas dimensoes sem policy unica |

Maturidade relevante: dados 2/5, APIs/integracoes 2/5, governanca/evolucao
2/5, entrega/qualidade 3/5. Confianca alta para a avaliacao estatica. Ha regras e
testes locais, mas falta modelo executavel central e medicao de divergencias.

## Classificacao das ocorrencias

### Fonte canonica atual

- `schema.prisma`: `StatusLead`, `StatusAgendamento`, campos do Lead/Conversa.
- `atividades` e `Conversa` sao fontes persistentes atuais de agenda e dialogo.
- ADR-0002 governa identidade e separacao de conceitos.

### Divergencia bloqueante

- `mover-para-fase.usecase.ts`: mapa contem `QUALIFICADO`, `CONTATANDO` e
  `EM_NEGOCIACAO`; estado desconhecido nao bloqueia; recuo e sempre aceito.
- `qualificar-lead.usecase.ts`: calcula `QUALIFICADO`/`EM_NEGOCIACAO` apesar do
  enum vigente.
- `agendar-followup.usecase.ts`: grava `MORNO_FUTURO` em string livre.
- `registrar-optout.usecase.ts`: side effects multi-entidade sem idempotencia.
- `roteiro-governanca.ts`: regras criticas chegam ao modelo como Markdown, nao
  como policy backend.

### Compatibilidade transitoria

- `agent-chain.ts`, `orchestrator.ts`, `orchestrator-queries.ts` roteiam por
  `StatusLead` e nomes de agentes legados.
- `sensitive-action-policy.ts`, `webhook-resilience.ts` usam
  `EM_NEGOCIACAO` como se vigente.
- `lead-ui.ts` traduz `QUALIFICADO` e `EM_NEGOCIACAO` para apresentacao.
- aliases `OPENER`, `PRESENTER`, `CLOSER` permanecem em agente, cache, skills e
  testes; sao papeis, nao estados de dominio.

### Estado derivado

- temperatura, score, prontidao SPIN e `VENCIDO` podem ser calculados a partir
  de evidencia/tempo; nao devem duplicar fonte persistida sem necessidade.
- agente ativo e resolvido por status/contexto/cache, mas nao e estagio
  comercial.

### Estado conversacional

- `FASES_ROTEIRO_SDR`: `MEIO_CAMPO`, `DESCOBERTA`, `DIAGNOSTICO_SPIN`, `PITCH`,
  `AGENDAMENTO`, `FOLLOW_UP`, `RECUO`.
- `faseSPIN`: `SAUDACAO`, `SITUACAO`, `PROBLEMA`, `IMPLICACAO`, `NECESSIDADE`,
  `SOLUCAO`, `QUALIFICADO`.
- structured outputs ainda distinguem Opener/Presenter e nomes como
  `PITCH_APRESENTACAO` e `AGENDAMENTO_FINAL`.

### Estado operacional

- `modoAtendimento`, `dataRecontato`, `StatusAgendamento`,
  `StatusConfirmacaoCorretor`, locks/idempotencia do webhook.
- estados de campanha e WhatsApp nao pertencem a maquina do Lead; sao maquinas
  adjacentes e apenas emitem comandos/eventos.

### Teste desatualizado

- `orchestrator-integration.test.ts`, `orchestrator-queries.test.ts`,
  `agent-chain.test.ts`, `servico-priorizacao-leads.test.ts` congelam
  `QUALIFICADO`.
- testes de use cases congelam `EM_NEGOCIACAO` e `MORNO_FUTURO`.
- testes de structured output congelam vocabularios Opener/Presenter.

### Registro historico

- `migrations_legacy_pre_20260714/20251126221416_inicial` e
  `20260427184000_cleanup_statuslead_deprecated` explicam valores antigos.
- `schema.prisma.backup`, relatorios e planos preservam contexto, mas nao sao
  fonte normativa e nao devem ser reescritos.

## Destino explicito dos divergentes

| Legado | Classificacao | Destino canonico | Regra de migracao |
|---|---|---|---|
| `QUALIFICADO` comercial | semantica sobreposta | `etapaQualificacao=QUALIFICADA` | comercial default `NOVO`, salvo evidencia de estagio posterior |
| `QUALIFICADO` em `faseSPIN` | conversa/resultado misturados | `faseConversa=ENCERRADA` + qualificacao | nao promover comercial automaticamente |
| `EM_NEGOCIACAO` | comercial legado | `DOCUMENTACAO` condicional | exigir evidencia; senao pendencia manual |
| `CONTATANDO` em mapa comercial | outreach deslocado | `estadoOutreach=CONTATANDO` | preservar comercial anterior |
| `MORNO_FUTURO` | follow-up deslocado | follow-up `PENDENTE` | preservar outreach anterior/encerrado |
| `LEAD` em outreach | identidade como estado | `ENCERRADO` | qualificacao/comercial avaliados separadamente |
| `null` em outreach | ausencia ambigua | `NAO_APLICAVEL` | nao inferir qualificacao |
| `OPENER/PRESENTER/CLOSER` | papel/agente | alias de role/skill | nunca persistir como dominio |

## Riscos priorizados

1. Alto: transicao para valor ausente do enum pode falhar ou divergir por
   ambiente.
2. Alto: opt-out/handoff concorrente pode produzir resposta indevida da IA.
3. Alto: fase do prompt pode promover CRM sem evidencia ou autorizacao.
4. Medio: recuos irrestritos destroem semantica/historico do funil.
5. Medio: migrations/testes historicos podem ser confundidos com fonte atual.

## Lacunas para #48

A baseline deve medir, sem mudar dados: distribuicao de valores, combinacoes
impossiveis, nulos, transicoes observadas, duplicidade de side effects, idade de
follow-ups, agendamentos inconsistentes e uso de aliases por consumidor. Este
inventario nao presume esses numeros.
