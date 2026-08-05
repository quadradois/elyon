# Contrato conversacional — Feedback do especialista

## Mensagem inicial

Deve conter nome do especialista, lead, horário, modalidade, imóvel quando disponível e a pergunta sobre o resultado. Opções mínimas:

1. Atendimento realizado
2. Lead não atendeu/não compareceu
3. Preciso reagendar
4. Não aconteceu por outro motivo

O especialista pode responder em linguagem natural e acrescentar o resumo na mesma mensagem.

## Intenções

| Intenção | Efeito |
|---|---|
| FEEDBACK_REALIZADO | conclui como realizado e adiciona resumo à ficha |
| FEEDBACK_LEAD_AUSENTE | registra no-show do lead |
| FEEDBACK_ESPECIALISTA_AUSENTE | registra no-show do especialista |
| FEEDBACK_REAGENDAR | preserva histórico e orienta o especialista a informar novo horário/acionar fluxo existente |
| FEEDBACK_OUTRO | exige descrição suficiente antes de encerrar |
| FEEDBACK_AMBIGUO | não altera estado e pede esclarecimento |

## Regras de segurança

- Apenas o telefone do especialista atribuído pode responder.
- Com múltiplas solicitações, listar opções mínimas para desambiguação.
- Evento duplicado devolve o resultado já processado.
- Resposta para compromisso substituído ou concluído informa o estado real sem reabrir.
- O resumo completo não aparece em logs ou métricas.
