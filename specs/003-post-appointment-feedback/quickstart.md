# Quickstart — Feedback Pós-Atendimento

## Automatizado

```powershell
npm --workspace @elyon/backend run build
npm --workspace @elyon/backend run test:unit -- --runInBand
npm --workspace @elyon/backend run test:integration -- --runInBand
```

## Cenário principal

1. Ative o gate para um tenant de teste.
2. Crie ligação confirmada com especialista e horário vinte minutos no passado.
3. Execute dois ciclos do job.
4. Esperado: uma solicitação e uma mensagem no outbox, sem duplicação.
5. Entregue inbound do especialista: “Conversei com ela. Quer vender no próximo mês e pediu avaliação.”
6. Esperado: atividade REALIZADO, solicitação CONCLUIDO, milestone com origem do Copilot e NOTA na ficha do lead.

## Ausência e ambiguidade

- “Ela não atendeu” registra `LEAD` ausente.
- “Eu não consegui ligar” registra `CORRETOR` ausente.
- “Depois vejo” pede esclarecimento e não muda a Agenda.

## Lembrete e escalonamento

1. Não responda à solicitação.
2. Em +2 h, execute dois ciclos: apenas um lembrete.
3. Em +24 h, execute novamente: status `PENDENCIA_GESTOR`, compromisso sem baixa automática.

## Rollback

Desative `AGENDA_POST_FEEDBACK_ENABLED`. O job e o roteamento de feedback param; convites e consultas atuais do Copilot continuam funcionando.
