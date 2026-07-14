# Matriz de transicoes e mapa posterior da Issue #47

Data: 2026-07-14

ADR: [ADR-0003](../decisions/0003-estados-canonicos-agente.md)

Inventario: [Issue #47](../inventarios/issue-47-estados-transicoes.md)

## Convencoes normativas

Cada linha segue `from -> comando -> guard -> to -> side effects -> reasonCode`.
Tudo que nao estiver permitido e proibido por default. `*` significa qualquer
estado nao terminal da dimensao. Todo comando exige tenant confiavel, ator
autorizado, estado esperado e idempotency key.

## Estagio comercial: permitidas

| From | Comando/evento | Guard | To | Side effects permitidos | Reason code |
|---|---|---|---|---|---|
| `NOVO` | `INICIAR_TENTATIVA_AGENDAMENTO` | qualificacao adequada ao canal | `TENTATIVA_AGENDAMENTO` | atividade auditavel | `COMMERCIAL_SCHEDULING_STARTED` |
| `TENTATIVA_AGENDAMENTO` | `CONFIRMAR_VISITA` | agendamento valido/confirmado | `VISITA_AGENDADA` | vincular agenda | `COMMERCIAL_VISIT_SCHEDULED` |
| `VISITA_AGENDADA` | `INICIAR_AVALIACAO` | visita vigente, ator autorizado | `AVALIACAO_EM_ANDAMENTO` | atividade | `COMMERCIAL_EVALUATION_STARTED` |
| `VISITA_AGENDADA` | `CANCELAR_VISITA` | agenda cancelada, sem substituta | `TENTATIVA_AGENDAMENTO` | preservar milestone no log | `COMMERCIAL_VISIT_CANCELLED` |
| `VISITA_AGENDADA` | `REAGENDAR_VISITA` | antiga cancelada e nova agenda valida | `VISITA_AGENDADA` | vincular nova agenda e preservar anterior | `COMMERCIAL_VISIT_RESCHEDULED` |
| `VISITA_AGENDADA` | `REGISTRAR_NO_SHOW` | tolerancia expirada e presenca ausente | `TENTATIVA_AGENDAMENTO` | registrar no-show; perda e comando separado | `COMMERCIAL_VISIT_NO_SHOW` |
| `AVALIACAO_EM_ANDAMENTO` | `INICIAR_DOCUMENTACAO` | avaliacao registrada | `DOCUMENTACAO` | checklist | `COMMERCIAL_DOCUMENTATION_STARTED` |
| `DOCUMENTACAO` | `INICIAR_ONBOARDING` | aceite/autorizacao evidenciados | `ONBOARDING` | atividade | `COMMERCIAL_ONBOARDING_STARTED` |
| `ONBOARDING` | `CONFIRMAR_CAPTACAO` | CRM synced e requisitos completos | `CAPTADO` | criar cliente idempotente | `COMMERCIAL_CAPTURED` |
| `*` | `MARCAR_PERDIDO` | motivo obrigatorio | `PERDIDO` | cancelar tarefas futuras permitidas | `COMMERCIAL_LOST` |
| `*` | `ARQUIVAR` | permissao administrativa e motivo | `ARQUIVADO` | retirar de filas | `COMMERCIAL_ARCHIVED` |
| `PERDIDO` | `REABRIR_OPORTUNIDADE` | humano autorizado, nova evidencia | `NOVO` | evento de reabertura | `COMMERCIAL_REOPENED` |
| `ARQUIVADO` | `DESARQUIVAR` | humano autorizado, motivo | estado anterior auditado | restaurar visibilidade | `COMMERCIAL_UNARCHIVED` |

O estagio comercial representa a situacao atual, nao o maior milestone
historico. Milestones permanecem no log append-only. Cancelamento e no-show
retornam explicitamente a `TENTATIVA_AGENDAMENTO`; reagendamento permanece em
`VISITA_AGENDADA` somente quando a nova agenda e valida e criada atomicamente.
Outros recuos exigem `CORRIGIR_ESTAGIO`, permissao humana, motivo e destino
adjacente; automacao nao regride comercial fora das linhas normativas.

## Outreach: permitidas

| From | Comando/evento | Guard | To | Side effects | Reason code |
|---|---|---|---|---|---|
| `NAO_APLICAVEL` | `INCLUIR_OUTBOUND` | consentimento/base legal e campanha | `AGUARDANDO` | vincular campanha | `OUTREACH_ENROLLED` |
| `AGUARDANDO` | `REGISTRAR_TENTATIVA` | elegivel, limite, canal disponivel | `CONTATANDO` | mensagem uma vez | `OUTREACH_ATTEMPTED` |
| `CONTATANDO` | `REGISTRAR_TENTATIVA` | janela/limite respeitados | `CONTATANDO` | retry uma vez | `OUTREACH_RETRIED` |
| `CONTATANDO` | `REGISTRAR_RESPOSTA` | inbound correlacionado | `RESPONDEU` | persistir mensagem | `OUTREACH_REPLIED` |
| `RESPONDEU` | `REGISTRAR_INTERESSE` | evidencia explicita | `INTERESSADO` | iniciar qualificacao por comando separado | `OUTREACH_INTERESTED` |
| `AGUARDANDO/CONTATANDO/RESPONDEU` | `REGISTRAR_SEM_INTERESSE` | evidencia/motivo | `SEM_INTERESSE` | parar envios | `OUTREACH_NOT_INTERESTED` |
| qualquer estado exceto `OPT_OUT` | `REGISTRAR_OPT_OUT` | pedido explicito/policy | `OPT_OUT` | somente registrar revogacao no outreach | `OUTREACH_OPTED_OUT` |
| `OPT_OUT` | `REGISTRAR_OPT_OUT` | pedido repetido correlacionado | `OPT_OUT` | no-op auditavel, sem repetir efeitos | `OUTREACH_OPT_OUT_ALREADY_SET` |
| `AGUARDANDO/CONTATANDO` | `ESGOTAR_RETRIES` | limite comprovado | `FALHA` | parar envios | `OUTREACH_FAILED` |
| `RESPONDEU/INTERESSADO` | `ENCERRAR_OUTBOUND` | motivo | `ENCERRADO` | retirar da fila | `OUTREACH_CLOSED` |
| `SEM_INTERESSE/FALHA/ENCERRADO` | `REATIVAR_OUTBOUND` | comando humano, base legal, motivo | `AGUARDANDO` | novo ciclo auditado | `OUTREACH_REACTIVATED` |
| `OPT_OUT` | `REGISTRAR_OPT_IN` | opt-in explicito e comprovado | `AGUARDANDO` | remover bloqueio conforme politica | `OUTREACH_OPTED_IN` |

### Operacao composta de opt-out

`PROCESSAR_OPT_OUT` e uma operacao atomica que declara subcomandos independentes:

1. outreach: `REGISTRAR_OPT_OUT`;
2. atendimento: `PAUSAR_ATENDIMENTO` com motivo `OPT_OUT`;
3. conversa: `ENCERRAR_CONVERSA` com motivo `OPT_OUT`;
4. jobs/follow-ups: `CANCELAR_JOBS_OUTBOUND` e `CANCELAR_FOLLOW_UP` aplicaveis.

Cada subcomando passa pela propria policy e grava resultado. A operacao usa uma
transacao quando os recursos forem locais e outbox/idempotencia quando houver
fronteira assincrona; falha parcial nao pode deixar IA/jobs ativos. Nenhuma
dimensao e alterada como side effect implicito da linha de outreach.

## Qualificacao: permitidas

| From | Comando | Guard | To | Side effects | Reason code |
|---|---|---|---|---|---|
| `NAO_INICIADA` | `INICIAR_DESCOBERTA` | interacao valida | `DESCOBERTA` | registrar fontes | `QUALIFICATION_DISCOVERY_STARTED` |
| `DESCOBERTA` | `INICIAR_DIAGNOSTICO` | intencao e dados basicos | `DIAGNOSTICO` | snapshot evidencia | `QUALIFICATION_DIAGNOSIS_STARTED` |
| `DESCOBERTA/DIAGNOSTICO` | `QUALIFICAR` | contrato de evidencia aprovado pela `qualificationPolicyVersion` | `QUALIFICADA` | registrar policy/evidencias; sem mudar comercial | `QUALIFICATION_APPROVED` |
| `DESCOBERTA/DIAGNOSTICO` | `DESQUALIFICAR` | criterio e evidencia | `DESQUALIFICADA` | motivo | `QUALIFICATION_REJECTED` |
| `DESQUALIFICADA` | `REABRIR_QUALIFICACAO` | nova evidencia, humano/policy autorizada | `DESCOBERTA` | preservar historico | `QUALIFICATION_REOPENED` |
| `QUALIFICADA` | `INVALIDAR_QUALIFICACAO` | evidencia corrigida, humano | `DIAGNOSTICO` | auditoria | `QUALIFICATION_INVALIDATED` |

## Conversa: permitidas

| From | Comando | Guard | To | Side effects | Reason code |
|---|---|---|---|---|---|
| `ABERTURA` | `AVANCAR_DESCOBERTA` | interesse proprio | `DESCOBERTA` | nenhum comercial | `CONVERSATION_DISCOVERY` |
| `DESCOBERTA` | `AVANCAR_DIAGNOSTICO` | descoberta minima | `DIAGNOSTICO_SPIN` | pode comandar qualificacao separada | `CONVERSATION_DIAGNOSIS` |
| `DIAGNOSTICO_SPIN` | `AVANCAR_APRESENTACAO` | duas dores explicitas | `APRESENTACAO` | nenhum comercial | `CONVERSATION_PRESENTATION` |
| `APRESENTACAO` | `AVANCAR_AGENDAMENTO` | aceite explicito | `AGENDAMENTO` | nenhum agendamento sem comando | `CONVERSATION_SCHEDULING` |
| `*` | `PEDIR_RECONTATO` | data valida ou coleta pendente | `FOLLOW_UP` | criar follow-up por comando separado | `CONVERSATION_FOLLOW_UP` |
| `*` | `RECUAR` | hostilidade/negativa | `RECUO` | pode comandar opt-out separado | `CONVERSATION_RETREAT` |
| `*` | `ENCERRAR_CONVERSA` | motivo | `ENCERRADA` | finalizar conversa | `CONVERSATION_CLOSED` |
| `FOLLOW_UP/RECUO` | `RETOMAR_CONVERSA` | nova mensagem ou comando autorizado | fase anterior auditada | nova interacao | `CONVERSATION_RESUMED` |

## Atendimento: permitidas

| From | Comando | Guard | To | Side effects | Reason code |
|---|---|---|---|---|---|
| `IA` | `ASSUMIR_HUMANO` | operador autorizado | `HUMANO` | cancelar resposta IA pendente | `SERVICE_HUMAN_TAKEOVER` |
| `IA/HUMANO` | `PAUSAR_ATENDIMENTO` | motivo | `PAUSADO` | bloquear respostas | `SERVICE_PAUSED` |
| `HUMANO/PAUSADO` | `DEVOLVER_PARA_IA` | humano autorizado e sem opt-out | `IA` | resumo/handoff | `SERVICE_AI_RESUMED` |
| `PAUSADO` | `RETOMAR_HUMANO` | operador autorizado | `HUMANO` | atividade | `SERVICE_HUMAN_RESUMED` |

## Follow-up: permitidas

| From | Comando | Guard | To | Side effects | Reason code |
|---|---|---|---|---|---|
| inexistente | `AGENDAR_FOLLOW_UP` | data futura/timezone/motivo | `PENDENTE` | job idempotente | `FOLLOW_UP_SCHEDULED` |
| `PENDENTE` | `CONCLUIR_FOLLOW_UP` | execucao correlacionada | `CONCLUIDO` | registrar tentativa | `FOLLOW_UP_COMPLETED` |
| `PENDENTE` | `CANCELAR_FOLLOW_UP` | motivo | `CANCELADO` | cancelar job | `FOLLOW_UP_CANCELLED` |
| `PENDENTE` | `REPROGRAMAR_FOLLOW_UP` | nova data valida | `REPROGRAMADO` | criar novo PENDENTE correlacionado | `FOLLOW_UP_RESCHEDULED` |

`VENCIDO` e view derivada: `PENDENTE && scheduledAt < now`; nao e mutacao.

## Agendamento: permitidas

| From | Comando | Guard | To | Side effects | Reason code |
|---|---|---|---|---|---|
| inexistente | `CRIAR_AGENDAMENTO` | data/hora/timezone/owner validos | `PENDENTE` | reserva idempotente | `SCHEDULE_CREATED` |
| `PENDENTE` | `CONFIRMAR_AGENDAMENTO` | token/ator valido | `CONFIRMADO` | notificacoes uma vez | `SCHEDULE_CONFIRMED` |
| `PENDENTE/CONFIRMADO` | `CANCELAR_AGENDAMENTO` | motivo/ator | `CANCELADO` | liberar agenda | `SCHEDULE_CANCELLED` |
| `PENDENTE/CONFIRMADO` | `REAGENDAR` | nova data valida | `CANCELADO` | reason `RESCHEDULED`; criar novo PENDENTE | `SCHEDULE_RESCHEDULED` |
| `CONFIRMADO` | `CONCLUIR_AGENDAMENTO` | horario ocorrido/ator | `REALIZADO` | atividade | `SCHEDULE_COMPLETED` |
| `CONFIRMADO` | `REGISTRAR_NO_SHOW` | tolerancia expirada | `NAO_COMPARECEU` | follow-up opcional separado | `SCHEDULE_NO_SHOW` |

As operacoes `CANCELAR_AGENDAMENTO`, `REAGENDAR` e `REGISTRAR_NO_SHOW` devem
compor atomicamente o comando comercial correspondente quando o Lead estiver em
`VISITA_AGENDADA`. Agenda e comercial continuam fontes distintas; a composicao
torna ambas consistentes sem side effect oculto.

## Proibicoes explicitas

| Cenario proibido | Resultado | Reason code |
|---|---|---|
| qualquer comando com Lead de outro tenant | rejeitar, sem side effect | `TENANT_MISMATCH` |
| transicao nao listada | rejeitar | `TRANSITION_NOT_ALLOWED` |
| replay da mesma idempotency key | retornar resultado anterior | `IDEMPOTENT_REPLAY` |
| `OPT_OUT -> outreach ativo` sem opt-in | rejeitar | `OPT_OUT_REQUIRES_EXPLICIT_OPT_IN` |
| IA responder em `HUMANO` ou `PAUSADO` | rejeitar/cancelar pendencia | `HUMAN_MODE_BLOCKS_AI` |
| criar/reagendar sem data/hora/timezone | rejeitar | `INVALID_SCHEDULE` |
| qualificar sem contrato de evidencia/policy versionada aprovada | rejeitar | `MISSING_QUALIFICATION_EVIDENCE` |
| fase de conversa alterar comercial diretamente | rejeitar | `TRANSITION_NOT_ALLOWED` |
| reabrir `CAPTADO/PERDIDO/ARQUIVADO` automaticamente | rejeitar | `TERMINAL_STATE_REQUIRES_REOPEN` |
| estado esperado divergir do persistido | rejeitar/reler | `STALE_STATE` |
| `CAPTADO` sem CRM synced | rejeitar | `CRM_SYNC_REQUIRED` |
| valor legado ambiguo sem evidencia | quarentena/revisao | `LEGACY_STATE_REVIEW_REQUIRED` |

`CAPTADO` nao retorna automaticamente. Correcao administrativa exige comando
excepcional separado, dupla autorizacao e plano de compensacao; nao faz parte da
matriz operacional comum.

## Mapa de implementacao posterior

Ordem obrigatoria:

```text
#47 ADR aceito -> #48 baseline de caracterizacao -> Onda 1
```

Nenhuma iniciativa abaixo pode iniciar antes da conclusao da #48.

| Ordem | Issue recomendada | Resultado | Dependencias | Exit criteria |
|---:|---|---|---|---|
| 1 | Modelo/schema e plano de dados | campos tipados, log de transicao, mapping | #48 | migration testada em vazio/upgrade; zero perda |
| 2 | Motor de policies | executor default-deny tenant-safe | 1 | matriz convertida em testes |
| 3 | Tools e executor idempotente | comandos usam policy unica | 2 | replay sem side effect; reason codes |
| 4 | Orquestrador e conversa | fase tatica separada de comercial | 2-3 | shadow sem divergencia critica |
| 5 | Campanhas/follow-up/agenda | maquinas operacionais separadas | 2-3 | opt-out, retry e agenda caracterizados |
| 6 | REST e frontend | contratos canonicos com compatibilidade | 1-5 | consumidores migrados e telemetria zero legado |
| 7 | Testes e fitness gates | impedir strings/transicoes diretas | 1-6 | CI default-deny e allowlist temporaria |
| 8 | Contract legado | remover valores/aliases antigos | 1-7 | janela zero uso, backup e reconciliacao |

## Expand/contract, rollout e telemetria

Expand: adicionar campos/log sem remover atuais; backfill a partir da #48 apenas
para mappings determinísticos; valores ambiguos preservam original e entram em
quarentena auditavel. Usar dual read/write; motor em shadow calcula decisao sem bloquear. Comparar estado
esperado, guard e reason code por dimensao, tenant e origem, sem IDs/PII como
labels.

Promocao: exigir zero transicao cross-tenant, zero side effect duplicado, 100% de
valores mapeados ou em quarentena e divergencia shadow dentro do limite aprovado
na issue de rollout. Depois, policy canonica passa a escrever; legado vira
facade. Contract somente apos zero uso observado e rollback ensaiado.

Sinais: `state_transition_total`, `state_transition_rejected_total`,
`state_shadow_divergence_total`, `legacy_state_seen_total`,
`idempotent_replay_total`, `cross_tenant_transition_rejected_total`, idade de
follow-up e inconsistencias de agenda. Labels de baixa cardinalidade apenas.

Rollback: desligar enforcement e manter dual-write; nunca apagar log/backfill.
Se houver alteracao de dados, restaurar por mapping auditavel, nao por inferencia.
Schema contract exige backup e plano proprio; rollback de app nao reverte schema.

## Recomendacao objetiva para a #48

Caracterizar, sem mutar dados: distribuicao e combinacoes por dimensao; valores
livres/desconhecidos; sequencias reais; nulos; terminais reabertos; opt-out com
atividade posterior; IA durante modo humano; follow-ups vencidos; agendas
invalidas; cancelamento/reagendamento/no-show apos `VISITA_AGENDADA`;
duplicidade por replay; policies de qualificacao por canal/perfil; e volume de
cada mapping legado e da quarentena. A baseline deve produzir criterios
numericos de backfill, shadow e abortagem para as issues da Onda 1.
