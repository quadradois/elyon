# Modelo de dados — Copilot de Agenda do Especialista

## ConviteEspecialistaAgenda

Representa uma tentativa individual e versionada de atribuição.

| Campo | Regra |
|---|---|
| id | UUID |
| tenantId | obrigatório; índice de isolamento |
| atividadeId | obrigatório; vínculo com compromisso |
| usuarioId | especialista destinatário |
| tentativa | inteiro crescente por atividade |
| status | PENDENTE, CONFIRMADO, RECUSADO, EXPIRADO, SUBSTITUIDO, CANCELADO |
| tokenHash | hash único do token usado no link; token puro não é persistido em nova estrutura |
| solicitadoEm / prazoEm | janela de decisão |
| respondidoEm | momento da decisão |
| origemResposta | WHATSAPP, LINK, JOB, PAINEL |
| messageIdConvite | id do provedor, quando disponível |
| criadoEm / atualizadoEm | auditoria temporal |

**Unicidade**: `(atividadeId, tentativa)` e token hash. Apenas uma tentativa pode ser acionável por atividade.

## InteracaoEspecialistaAgenda

Registro durável de mensagens e intenções operacionais, com conteúdo mínimo.

| Campo | Regra |
|---|---|
| id | UUID |
| tenantId, atividadeId, usuarioId, conviteId | escopo e contexto |
| webhookEventoId | chave idempotente do inbound |
| direcao | ENTRADA ou SAIDA |
| intencao | CONFIRMAR, RECUSAR, CONTRAPROPOR, CANCELAR_PARTICIPACAO, CONSULTAR, DESAMBIGUAR, DESCONHECIDA |
| resumoSanitizado | texto limitado, sem PII desnecessária |
| parametros | data estruturada não sensível |
| resultado | sucesso, rejeição ou pedido de desambiguação |
| criadoEm | timestamp |

## ContrapropostaAgenda

Alternativa que ainda não modifica o compromisso.

| Campo | Regra |
|---|---|
| id | UUID |
| tenantId, atividadeId | escopo |
| conviteId | convite que originou a proposta |
| propostaPorTipo / propostaPorId | especialista ou lead |
| horarioProposto | futuro e inicialmente disponível |
| status | AGUARDANDO_LEAD, ACEITA, RECUSADA, EXPIRADA, INVALIDADA |
| respondidaEm | decisão do lead |
| atividadeResultanteId | preenchido após reagendamento aceito |
| versaoAtividadeOrigem | proteção contra evento obsoleto |
| criadoEm / atualizadoEm | auditoria temporal |

**Regra**: aceite só produz reagendamento após nova verificação de disponibilidade e versão.

## Uso de estruturas existentes

- `Atividade`: permanece fonte canônica do compromisso e responsável atual.
- `ComandoAgendaLedger`: idempotência e resultado de mutações.
- `EfeitoAgendaOutbox`: entrega para lead ou usuário, inclusive convites e lembretes.
- `MilestoneAgenda`: fatos de ciclo de vida e substituição.
- `LogAuditoria`: evidência administrativa e operacional.

## Transições principais

```text
Convite: PENDENTE -> CONFIRMADO | RECUSADO | EXPIRADO | SUBSTITUIDO | CANCELADO
Proposta: AGUARDANDO_LEAD -> ACEITA | RECUSADA | EXPIRADA | INVALIDADA
```

- `CONFIRMADO` do convite executa confirmação de atribuição na atividade.
- `RECUSADO`/`EXPIRADO` encerra a tentativa e pode criar convite de fallback.
- `ACEITA` da proposta cria/substitui atividade pelo comando de reagendamento.
- Toda substituição invalida convite, proposta e lembretes da versão anterior.
