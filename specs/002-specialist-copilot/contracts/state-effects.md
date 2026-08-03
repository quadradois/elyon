# Contrato de comandos e efeitos

## Princípio

O texto do especialista produz uma intenção; somente o serviço de agenda pode produzir efeito.

## Envelope mínimo

```json
{
  "tenantId": "uuid",
  "appointmentId": "uuid",
  "specialistId": "uuid",
  "inviteId": "uuid",
  "intent": "CONFIRMAR",
  "providerMessageId": "string",
  "expectedVersion": 1,
  "occurredAt": "ISO-8601",
  "correlationId": "string"
}
```

## Garantias

- tenant e especialista são resolvidos no servidor;
- `providerMessageId` participa da idempotência;
- convite deve estar pendente e pertencer ao responsável atual;
- versão e estado são revalidados na transação;
- notificação é criada no mesmo limite transacional do comando quando aplicável;
- respostas concorrentes retornam replay ou evento obsoleto, nunca dois sucessos distintos.
