# Contrato de estado e efeitos

## Elegibilidade

Compromisso confirmado, responsável definido, sem desfecho e dentro do tenant/cutoff habilitado.

## Garantias

- criação da solicitação e efeito de saída compartilham chave idempotente;
- webhook participa da idempotência por `providerEventId`;
- tenant, responsável, versão e status são revalidados antes da mutação;
- desfecho usa `executarComandoAgenda`;
- NOTA da ficha possui chave reconhecível e não é duplicada;
- silêncio nunca chama `NO_SHOW`;
- cancelamento/reagendamento invalida a solicitação;
- falha transitória permite retry sem mensagem duplicada.

## Prazos padrão

| Evento | Prazo |
|---|---|
| ligação | início +20 min |
| reunião/visita | término +15 min |
| lembrete | envio +2 h |
| pendência de gestor | envio +24 h |
