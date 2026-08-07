# Data Model — Feedback Pós-Atendimento

## FeedbackPosAtendimentoAgenda

Representa o ciclo pós-compromisso, com uma linha por atividade.

| Campo | Regra |
|---|---|
| id | UUID |
| tenantId | obrigatório e indexado |
| atividadeId | único; vínculo com o compromisso |
| usuarioId | especialista responsável no momento da criação |
| versaoAtividade | versão usada para impedir resposta obsoleta |
| status | AGUARDANDO_ENVIO, AGUARDANDO_RESPOSTA, CONCLUIDO, PENDENCIA_GESTOR, INVALIDADO |
| elegivelEm | instante de criação/disparo |
| enviadoEm | primeiro envio efetivamente confirmado pelo provedor |
| lembreteEm | lembrete único |
| expiraEm | prazo para escalar |
| respondidoEm | resposta válida |
| desfecho | REALIZADO, LEAD_AUSENTE, ESPECIALISTA_AUSENTE, REAGENDAR, OUTRO |
| resumoSanitizado | texto limitado sem tokens/documentos desnecessários |
| sugestoes | JSON não sensível para futura validação humana |
| providerMessageId | mensagem de saída quando disponível |
| criadoEm / atualizadoEm | auditoria |

**Unicidade**: `atividadeId`.

**Índices**: `(status, elegivelEm)`, `(tenantId, usuarioId, status, expiraEm)`.

## Uso de entidades existentes

- `Atividade`: compromisso e status canônico; também recebe NOTA de timeline.
- `MilestoneAgenda`: desfecho auditável criado pelo comando canônico.
- `InteracaoEspecialistaAgenda`: inbound idempotente e resposta produzida pelo Copilot.
- `EfeitoAgendaOutbox`: envio inicial, lembrete e resposta ao especialista.
- `Usuario` e `Tenant`: identidade e isolamento.

## Transições

```text
AGUARDANDO_ENVIO -> AGUARDANDO_RESPOSTA
AGUARDANDO_RESPOSTA -> CONCLUIDO | PENDENCIA_GESTOR | INVALIDADO
PENDENCIA_GESTOR -> CONCLUIDO | INVALIDADO
```

- Cancelamento, substituição, mudança de responsável ou desfecho prévio invalida a solicitação.
- Resposta válida conclui a solicitação e o compromisso na mesma transação lógica.
- Resposta ambígua mantém `AGUARDANDO_RESPOSTA`.
