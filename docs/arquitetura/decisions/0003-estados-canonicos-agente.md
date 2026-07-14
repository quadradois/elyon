# ADR-0003: estados canonicos e transicoes da jornada do Lead

Data: 2026-07-14

Estado: proposta

Issue: [#47](https://github.com/quadradois/elyon/issues/47)

Decisao precedente: [ADR-0002](0002-lead-entidade-canonica.md)

## Contexto

O ADR-0002 ratificou `Lead` e `leadId` como identidade unica. O estado atual,
entretanto, mistura progresso comercial, outreach, qualificacao, conversa,
atendimento e agenda. O schema persiste `StatusLead`, strings livres em
`statusProspeccao`, `modoAtendimento` e `Conversa.faseSPIN`; codigo e testes ainda
usam valores que nao pertencem ao enum vigente, como `QUALIFICADO`,
`EM_NEGOCIACAO` e `MORNO_FUTURO`.

Regras importantes existem em `roteiro-governanca.ts`, mas sao renderizadas para
o prompt. O `MoverParaFaseUseCase` possui um gate parcial, aceita estados legados
e permite recuos sem politica explicita. Nao ha um executor unico, idempotente e
tenant-safe para transicoes.

O [inventario da #47](../inventarios/issue-47-estados-transicoes.md) registra o
AS-IS. O [mapa posterior](../migracoes/issue-47-maquina-estados.md) organiza a
implementacao, obrigatoriamente depois da baseline #48.

## Drivers

- preservar `Lead.id` e historico durante toda a jornada;
- impedir que fase do LLM altere estado comercial implicitamente;
- tornar opt-out, handoff humano, perda e captacao auditaveis;
- rejeitar transicoes cross-tenant e replay de efeitos;
- permitir migracao incremental e reversivel dos valores existentes;
- manter termos do dominio em portugues, usando nomes tecnicos ja consolidados
  (`status`, `reasonCode`) apenas nos contratos.

## Alternativas consideradas

### 1. Manter enums atuais e documentar convencoes

Menor custo inicial, mas mantem strings livres, sobreposicoes e regras em
prompts. Nao oferece default-deny nem uma fonte executavel. Rejeitada.

### 2. Um enum unico para toda a jornada

Simplifica visualizacao, mas cria produto cartesiano entre outreach, comercial,
conversa, atendimento e agenda. Um handoff humano ou follow-up passaria a mudar
artificialmente o funil comercial. Rejeitada.

### 3. Dimensoes ortogonais com policies executaveis

Cada dimensao tem owner, fonte de verdade, eventos, guards e terminais. Um
executor atomico aplica comandos idempotentes e produz auditoria. Escolhida por
separar responsabilidades sem exigir reescrita total.

### 4. Event sourcing completo

Oferece reconstrucao temporal forte, mas exige event store, projections,
versionamento e operacao que nao sao proporcionais ao estagio atual. Adiada. O
registro de transicoes deve ser append-only e pode servir de ponte futura.

## Decisao

O estado do Lead sera composto por seis dimensoes independentes. Nenhuma pode
alterar outra sem comando explicito autorizado.

### 1. Estagio comercial (`estagioComercial`)

Owner: operacao comercial. Fonte de verdade: `Lead`. Persistido.

Valores canonicos, preservando o enum vigente:

| Valor | Definicao |
|---|---|
| `NOVO` | Lead sem compromisso comercial posterior confirmado |
| `TENTATIVA_AGENDAMENTO` | tentativa comercial de obter visita/avaliacao |
| `VISITA_AGENDADA` | visita valida agendada |
| `AVALIACAO_EM_ANDAMENTO` | avaliacao iniciada e ainda nao concluida |
| `DOCUMENTACAO` | negociacao/documentacao para formalizar captacao |
| `ONBOARDING` | captacao aceita, com onboarding pendente |
| `CAPTADO` | cliente/imovel captado; terminal de sucesso |
| `PERDIDO` | oportunidade encerrada sem captacao; terminal reversivel por comando humano |
| `ARQUIVADO` | registro fora da operacao ativa; terminal administrativo |

`QUALIFICADO` nao e estagio comercial: migra para `etapaQualificacao=QUALIFICADA`
e o estagio comercial e calculado pela evidencia existente, default `NOVO`.
`EM_NEGOCIACAO` migra para `DOCUMENTACAO` somente quando houver evidencia de
negociacao/documentacao; sem evidencia permanece no estagio anterior e gera
pendencia de revisao.

### 2. Estado de outreach (`estadoOutreach`)

Owner: campanhas/prospeccao. Fonte de verdade: futuro campo tipado no `Lead`.
Persistido; `NAO_APLICAVEL` substitui `null` como semantica explicita.

| Valor | Definicao |
|---|---|
| `NAO_APLICAVEL` | Lead fora de campanha outbound |
| `AGUARDANDO` | elegivel, ainda sem tentativa |
| `CONTATANDO` | tentativa ativa ou follow-up de outreach |
| `RESPONDEU` | houve resposta valida |
| `INTERESSADO` | sinal explicito de interesse no outbound |
| `SEM_INTERESSE` | outreach encerrado sem interesse, reativavel por comando |
| `OPT_OUT` | consentimento revogado; terminal ate opt-in explicito |
| `FALHA` | entrega inviavel apos politica de retry |
| `ENCERRADO` | outreach concluido por entrada em outro fluxo, sem implicar qualificacao |

`statusProspeccao=null` migra para `NAO_APLICAVEL`; `LEAD` migra para
`ENCERRADO`; `MORNO_FUTURO` nao e outreach e migra para follow-up pendente,
mantendo o outreach anterior ou `ENCERRADO` conforme evidencia.

### 3. Etapa de qualificacao (`etapaQualificacao`)

Owner: dominio de qualificacao. Fonte de verdade: `Lead`. Persistida para
atravessar conversas e canais.

| Valor | Definicao |
|---|---|
| `NAO_INICIADA` | nenhuma descoberta confiavel |
| `DESCOBERTA` | intencao e dados basicos em coleta |
| `DIAGNOSTICO` | problemas, implicacoes e necessidade em coleta |
| `QUALIFICADA` | evidencia minima aprovada pela policy |
| `DESQUALIFICADA` | criterio impeditivo registrado; terminal reversivel por nova evidencia |

Guard minimo para `QUALIFICADA`: intencao explicita; `situacaoAtual`;
`motivacaoVenda`; ao menos duas dores confirmadas; e ao menos uma implicacao em
`consequencias` ou `custosAtuais`. Dados inferidos pelo LLM sem fonte nao contam.

### 4. Fase conversacional (`faseConversa`)

Owner: orquestrador. Fonte de verdade: conversa ativa. Persistida por conversa,
nunca no status comercial.

Valores: `ABERTURA`, `DESCOBERTA`, `DIAGNOSTICO_SPIN`, `APRESENTACAO`,
`AGENDAMENTO`, `FOLLOW_UP`, `RECUO`, `ENCERRADA`.

Mapeamentos: `MEIO_CAMPO -> ABERTURA`, `PITCH -> APRESENTACAO`; `OPENER` e
`PRESENTER` identificam papeis/agentes legados, nao estados; `CLOSER` e papel
legado mapeado ao agente/skill responsavel, nunca a uma fase comercial.

### 5. Modo de atendimento (`modoAtendimento`)

Owner: operacao de atendimento. Fonte de verdade: `Lead`. Persistido.

Valores: `IA`, `HUMANO`, `PAUSADO`. `HUMANO` bloqueia qualquer resposta
concorrente da IA. Retorno a `IA` exige comando explicito e auditado; `PAUSADO`
nao implica perda, opt-out ou encerramento comercial.

### 6. Follow-up e agendamento

Owner: agenda/operacao. Fonte de verdade: entidades operacionais, nunca
`StatusLead` ou `statusProspeccao`.

Follow-up persistido: `PENDENTE`, `CONCLUIDO`, `CANCELADO`, `REPROGRAMADO`;
`VENCIDO` e derivado de `PENDENTE` + horario. Agendamento preserva
`PENDENTE`, `CONFIRMADO`, `CANCELADO`, `REALIZADO`, `NAO_COMPARECEU`; uma
reprogramacao encerra o item anterior como `CANCELADO` com reason code e cria
novo item correlacionado, evitando sobrescrever historico.

## Executor e contrato de transicao

Toda mutacao futura deve passar por um executor com:

```text
leadId + tenantConfiavel + dimensao + estadoEsperado + comando + payload
+ idempotencyKey + ator + correlationId
```

O executor valida ownership do tenant, estado esperado, guard, autorizacao e
idempotencia; aplica estado e side effects atomicamente; e grava evento de
auditoria sem PII. Retry retorna o resultado anterior e nao repete efeitos.

Reason codes minimos:

```text
TRANSITION_APPLIED
TRANSITION_NOT_ALLOWED
STALE_STATE
TENANT_MISMATCH
UNAUTHORIZED_ACTOR
MISSING_QUALIFICATION_EVIDENCE
INVALID_SCHEDULE
OPT_OUT_REQUIRES_EXPLICIT_OPT_IN
HUMAN_MODE_BLOCKS_AI
TERMINAL_STATE_REQUIRES_REOPEN
IDEMPOTENT_REPLAY
LEGACY_STATE_REVIEW_REQUIRED
```

## Invariantes

1. Tenant vem da autenticacao/contexto interno confiavel; payload nunca amplia
   escopo. Cross-tenant e rejeitado e auditado sem PII.
2. Transicoes sao default-deny: apenas as listadas na matriz sao validas.
3. Fase conversacional nao muda automaticamente estagio comercial.
4. `OPT_OUT` bloqueia outreach e IA outbound ate opt-in explicito e auditado.
5. `HUMANO` bloqueia resposta da IA, inclusive em retry concorrente.
6. Agendamento exige data/hora valida, timezone e owner.
7. Qualificacao exige evidencia com origem; inferencia isolada nao avanca.
8. `CAPTADO`, `PERDIDO`, `ARQUIVADO` e terminais; reabertura exige comando,
   permissao, motivo e evento de auditoria.
9. Side effects ocorrem no maximo uma vez por `idempotencyKey`.
10. Mudanca de uma dimensao nao produz mudanca implicita em outra.

## Matriz normativa

A matriz completa, incluindo proibicoes, esta no
[mapa de implementacao](../migracoes/issue-47-maquina-estados.md). Ela e parte
normativa deste ADR e deve ser convertida em policy/testes sem alterar semantica.

## Consequencias

Positivas: estados deixam de competir; regras tornam-se testaveis; historico e
tenant ganham invariantes; fases do agente podem evoluir sem quebrar CRM.

Negativas: mais campos e policies; migracao exige caracterizacao da #48;
consumidores precisam coexistir no expand/contract; transicoes multi-dimensao
exigem orquestracao atomica, nao atalhos.

## Rollout e rollback

Este PR nao tem rollout funcional. Depois da #48, implementar em expand/contract:
campos novos, backfill auditado, shadow mode, comparacao de decisoes, escrita
canonica e somente entao contract de strings legadas. Rollback antes do contract
desativa o executor novo e mantem dual-write; depois de migracao exige plano de
dados especifico, backup e reconciliacao. Nenhum drop ocorre sem zero divergencia
e janela aprovada.

## Estado da decisao

O ADR permanece `proposta` enquanto a PR estiver em draft. A revisao deve
alterar ADR e indice para `aceita` antes do merge que fecha a #47.
