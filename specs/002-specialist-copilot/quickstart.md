# Guia de validação — Copilot de Agenda do Especialista

## Pré-requisitos

- banco de teste migrado;
- tenant, sessão WhatsApp conectada, campanha, lead e dois usuários ativos com telefones distintos;
- responsável principal e fallback configurados na campanha;
- gates de lifecycle/effects e do Copilot ativos para o tenant de teste.

## Verificações automatizadas

```powershell
npm --workspace @elyon/backend run build
npm --workspace @elyon/backend run test:unit -- --runInBand
npm --workspace @elyon/backend run test:integration -- --runInBand
```

## Cenário 1 — Confirmação no WhatsApp

1. Lead solicita um horário futuro.
2. Verificar convite contextual no WhatsApp do principal.
3. Responder “Pode confirmar”.
4. Esperado: convite confirmado, atividade atribuída/confirmada, lead notificado uma vez e auditoria correlacionada.

## Cenário 2 — Concorrência com link

1. Enviar resposta “confirmo” e acionar o link quase simultaneamente.
2. Esperado: uma única transição e uma única notificação final; segunda ação é replay ou obsoleta.

## Cenário 3 — Recusa e fallback

1. Principal responde “Não consigo”.
2. Esperado: convite do principal recusado, novo convite para fallback e nenhuma mensagem de cancelamento ao lead.
3. Fallback confirma.
4. Esperado: lead recebe confirmação com o especialista correto.

## Cenário 4 — Contraproposta

1. Especialista responde “Posso amanhã às 10h”.
2. Esperado: horário original permanece; lead recebe proposta.
3. Lead aceita.
4. Esperado: disponibilidade revalidada, reagendamento único e convites antigos invalidados.

## Cenário 5 — Segurança

1. Repetir o webhook com telefone não cadastrado e com sessão de outro tenant.
2. Esperado: nenhuma informação exposta, nenhuma mutação e evento de rejeição sem PII.

## Cenário 6 — Lembrete

1. Criar atendimento confirmado dentro da janela T-60.
2. Executar dois ciclos do scheduler.
3. Esperado: um lembrete para cada parte no primeiro ciclo e nenhum duplicado no segundo.

## Rollback do teste

Desativar `AGENDA_SPECIALIST_COPILOT_ENABLED`; novos inbound de especialista deixam de ser roteados ao Copilot e o link permanece utilizável.
