# Feedback pós-atendimento

## Objetivo

Coletar pelo WhatsApp do especialista o resultado real de cada atendimento e
registrá-lo na agenda e na ficha do lead. A ausência de resposta nunca é
interpretada como ausência do lead ou do especialista.

## Linha do tempo

- Ligação: primeira pergunta 20 minutos após o início agendado.
- Visita ou avaliação: primeira pergunta 15 minutos após o fim estimado.
- Sem resposta: um lembrete duas horas após o primeiro envio.
- Sem resposta em 24 horas: o item vira `PENDENCIA_GESTOR` na Agenda.

As respostas aceitas são atendimento realizado, lead ausente, especialista
ausente, necessidade de reagendamento ou outro motivo. Reagendamento e outro
motivo permanecem para revisão operacional; nenhum horário é inventado.

## Ativação segura

Aplicar primeiro a migration `20260805180000_post_appointment_feedback`. Depois,
manter `AGENDA_POST_FEEDBACK_ENABLED=false` durante o deploy. A ativação exige,
no mesmo tenant piloto e cutoff:

```env
AGENDA_LIFECYCLE_POLICY_ENABLED=true
AGENDA_LIFECYCLE_COMMANDS_ENABLED=true
AGENDA_EFFECTS_ENABLED=true
AGENDA_SPECIALIST_COPILOT_ENABLED=true
AGENDA_POST_FEEDBACK_ENABLED=true
```

O worker antigo de no-show automático deixa de atuar quando esse gate está
ligado, evitando duas fontes concorrentes para o desfecho.

## Validação do piloto

1. Criar e confirmar uma ligação com especialista.
2. Após 20 minutos, conferir o convite no WhatsApp do especialista.
3. Responder `realizado` com uma observação curta.
4. Conferir o status da atividade e a nova nota `Feedback pós-atendimento` na
   ficha do lead.
5. Repetir com `o lead não atendeu`, `eu não consegui atender` e `reagendar`.
6. Confirmar na Agenda que uma resposta ausente há 24 horas aparece como
   `Especialista não respondeu ao feedback`.

## Rollback

Definir `AGENDA_POST_FEEDBACK_ENABLED=false` e reiniciar backend e worker. Os
registros já coletados são preservados; novos convites deixam de ser criados.
