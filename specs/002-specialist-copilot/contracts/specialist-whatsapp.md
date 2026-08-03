# Contrato conversacional — WhatsApp do especialista

## Convite de saída

Campos obrigatórios visíveis:

- saudação com nome do especialista;
- lead;
- data e horário em `America/Sao_Paulo`;
- modalidade;
- imóvel, quando conhecido;
- resumo sanitizado, quando conhecido;
- prazo de resposta;
- pergunta “Posso confirmar este horário ou prefere sugerir outro?”;
- link identificado como alternativa.

## Intenções de entrada

| Intenção | Parâmetros | Resultado esperado |
|---|---|---|
| CONFIRMAR | referência opcional da solicitação | confirma tentativa válida |
| RECUSAR | motivo opcional | encerra tentativa e aciona fallback |
| CONTRAPROPOR | data e hora obrigatórias | cria proposta para aceite do lead |
| CANCELAR_PARTICIPACAO | referência opcional | busca substituto; não cancela automaticamente o lead |
| CONSULTAR | período ou referência | retorna apenas agenda do próprio especialista |
| DESAMBIGUAR | referência de lead/data/hora | seleciona uma solicitação sem efeito adicional |

## Respostas de segurança

- Sem especialista identificado: não revelar existência de solicitações.
- Sem contexto único: listar no máximo opções mínimas (lead, data, hora).
- Evento terminal/tardio: informar estado real, sem reabrir.
- Falha transitória: não afirmar sucesso; informar que não foi possível registrar.
- Replay: devolver o mesmo resultado sem repetir efeitos.
