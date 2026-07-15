# Issue #57 — coerência entre agenda e estado comercial

## Baseline e decisão

Implementação baseada em `main@5d840494`, ADR-0002 e ADR-0003. `Lead.id` é a
identidade canônica e o backend é a autoridade das transições. Estado comercial
atual permanece em `Lead.status`; fatos históricos são append-only em
`milestones_agenda`.

## Contrato dos comandos

`CancelarAgendaCommand`, `ReagendarAgendaCommand` e `MarcarNoShowCommand`
transportam tenant, Lead, atividade, identidade confiável da requisição, ator,
origem, motivo estruturado, policy `agenda-commercial-v1`, instante efetivo e
versão esperada. Parâmetros livres do modelo não substituem tenant, identidade
idempotente ou controle de concorrência.

Cada requisição aceita persiste fingerprint, operação, resultado e atividade
resultante em `comandos_agenda_ledger`. Mesma chave e fingerprint retorna replay;
payload divergente retorna `REQUEST_ID_CONFLICT` antes de mutações.

Após ownership válido, rejeições determinísticas como `STALE_EVENT`,
`STATE_TRANSITION_DENIED`, `NO_SHOW_NOT_DUE` e atividade já substituída também
são decisões terminais persistidas. Seu replay nunca é reavaliado contra um
estado posterior. Tentativas cross-tenant ou sem ownership confiável são a
exceção deliberada: são recusadas sem ledger para não confirmar a existência do
recurso.

## Matriz de transições

| Estado atual | Operação | Precondição | Agenda resultante | Estado comercial | Milestone |
|---|---|---|---|---|---|
| `VISITA_AGENDADA` | cancelar | atividade vigente e versão atual | `CANCELADO` | `TENTATIVA_AGENDAMENTO` | `VISITA_CANCELADA` |
| `VISITA_AGENDADA` | reagendar | substituta futura válida | original `CANCELADO`, substituta `PENDENTE` | `VISITA_AGENDADA` | `VISITA_REAGENDADA` |
| `VISITA_AGENDADA` | no-show do Lead | atividade vigente e versão atual | `NAO_COMPARECEU` | `TENTATIVA_AGENDAMENTO` | `VISITA_NAO_COMPARECEU` |
| qualquer outra combinação | qualquer | não prevista | sem alteração | sem alteração | nenhum |

No-show do Lead ou do corretor deve ser informado explicitamente em
`parteAusente`; não é inferido de texto livre e fica registrado no milestone. A
policy v1 aplica a mesma volta para `TENTATIVA_AGENDAMENTO` nos dois casos, pois
não há visita vigente sem uma das partes, mas preserva a causa para políticas e
ações posteriores. A operação permanece default-deny quando as precondições da
visita vigente não estiverem presentes.

## Ordenação e concorrência

Os comandos usam transação serializável, advisory lock por `tenantId + leadId`,
versão da atividade e updates condicionais. Não há last-write-wins silencioso.
Atividade já substituída retorna `ACTIVITY_ALREADY_REPLACED`; versão obsoleta ou
evento sobre estado comercial mais avançado retorna `STALE_EVENT`. Em disputa,
somente o primeiro comando compatível grava agenda, estado, milestone e ledger.

`estadoAgendaAtualizadoEm` cerca também a ordem temporal: evento anterior à
última confirmação, aprovação ou mutação autoritativa é stale mesmo com versão
aparentemente atual. Essas mutações incrementam `versao`. No-show é aceito
somente após `agendadoPara + AGENDA_NO_SHOW_GRACE_MINUTES` (30 minutos por
default, limitado entre 1 minuto e 24 horas).

O reagendamento cria a substituta, encerra a original, mantém o Lead e grava
histórico na mesma transação. Quando `avisarCliente=true`, essa transação cria
uma única linha em `efeitos_agenda_outbox`, associada à chave do comando. O
worker é o único dispatcher. Apenas `NOVA` pode ser reservada; `CONCLUIDA` não é
reenviada e `RESERVADA` abandonada ou confirmação perdida vira
`RECONCILIACAO/DELIVERY_UNKNOWN`, sem retry automático.

O claimer de no-show usa PostgreSQL, `FOR UPDATE SKIP LOCKED`, lease e fencing
token. A identidade `atividade + horário + policy` é durável. Depois de restart,
o novo owner chama o mesmo `MarcarNoShowCommand`; replay do ledger finaliza o
claim sem duplicar milestone ou regressão comercial.

## Tenant safety e observabilidade

Toda atividade é resolvida conjuntamente por `tenantId + leadId + atividadeId`.
Falhas de ownership retornam `TENANT_OWNERSHIP_DENIED` sem indicar qual identidade
existe. A métrica `elyon_agenda_commercial_commands_total{resultado}` agrega
cancelamento, reagendamento, no-show, replay, conflito, stale event, negação e
rollback. `elyon_agenda_commercial_effects_total` e
`elyon_agenda_no_show_worker_total` observam dispatcher e claimer. Nenhuma usa
tenant, Lead, atividade, nomes, telefones ou texto livre como labels.

## Evidências

- PostgreSQL/pgvector real: cancelamento, reagendamento, falha da substituta,
  no-show, replay, conflito, stale event, cross-tenant, outro Lead, default-deny,
  rollback e concorrência.
- Caminho humano real: API de agenda → comando → PostgreSQL.
- Replays de cancelamento e reagendamento com aviso: uma intenção e no máximo um
  envio confirmado; reserva abandonada permanece em reconciliação.
- Caminho worker real: claimer concorrente → `MarcarNoShowCommand` → PostgreSQL,
  incluindo takeover após restart sem duplicação.
- Caminho da tool: execução durável confiável → comando de reagendamento.
- Frontend: versão esperada e identidade da tentativa atravessam o contrato API.
- XF-B16 foi removido dos expected-failures e substituído por gate suportado.

## Rollout

1. aplicar migration expand-only;
2. publicar backend e worker mantendo `AGENDA_EFFECTS_ENABLED=false` e
   `AGENDA_NO_SHOW_ENABLED=false` até todas as réplicas estarem no schema novo;
3. habilitar primeiro `AGENDA_EFFECTS_ENABLED=true` e observar reconciliações;
4. habilitar `AGENDA_NO_SHOW_ENABLED=true` em ambiente piloto com grace period
   explícito;
5. observar `state_transition_denied`, `stale_event`, `no_show_not_due`,
   reconciliações, rollback e conflitos;
6. expandir somente após confirmar ausência de mutações parciais e PII.

Dados legados não são apagados. Atividades inconsistentes anteriores devem ser
inventariadas e tratadas por limpeza explícita posterior, nunca por default de
migration.

## Rollback

Desabilitar claimer e dispatcher antes de reverter a aplicação, mantendo outbox,
ledger e colunas novas para auditoria. Não reativar envio direto nos handlers:
intenções `NOVA` ficam pendentes e `RESERVADA` fica fail-closed para reconciliação.
A migration é expand-only e não exige drop. Comandos já confirmados permanecem
no ledger e milestones não são apagados.

## Riscos residuais

- registros históricos anteriores à migration podem continuar sem milestone;
- o Evolution não oferece confirmação transacional com PostgreSQL; quedas após
  envio exigem reconciliação operacional e nunca reenvio automático;
- eventos sem versão confiável são recusados e precisam ser reenviados pelo
  produtor com a versão vigente.
