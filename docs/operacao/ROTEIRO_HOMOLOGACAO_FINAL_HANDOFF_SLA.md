# Roteiro de Homologação Final — Handoff, SLA e Observabilidade

Data de referência: 2026-04-29
Objetivo: encerrar pendências operacionais finais do fluxo.

## Escopo de fechamento

Itens pendentes a concluir:
- [ ] Validar dashboard/alertas com operação.
- [x] Falhas críticas 1-5 não reproduzem em homologação.
- [x] Riscos altos cobertos por mitigação implementada.

Pré-condições já atendidas (não repetir):
- Build backend OK.
- Testes focados OK.
- Evidências técnicas já anexadas.

---

## Participantes e responsabilidades

- Operação Comercial:
  - Executar validação funcional do painel.
  - Aprovar utilidade de alertas e acionabilidade.
- Produto/Negócio:
  - Aprovar critérios de fallback/remanejamento.
- Engenharia:
  - Acompanhar logs/eventos e coletar evidências.
  - Ajustar configuração operacional se houver desvio.

---

## Ambiente de homologação

- Ambiente: `homolog`
- Banco: com migrations aplicadas (incluindo lembrete idempotente)
- Sessão WhatsApp: conectada
- Dados mínimos:
  - 1 campanha com responsável + fallback
  - 2 corretores ativos (com WhatsApp válido)
  - 1 corretor inelegível (inativo ou sem WhatsApp)
  - 5 leads para cenários de teste

---

## Cenários obrigatórios (passo a passo)

## Cenário 1 — Convite T-120 + lembrete T-90 + cutoff T-60

1. Criar reunião `REUNIAO` em janela que permita execução dos jobs.
2. Executar job de convite.
3. Validar envio ao corretor com link.
4. Executar job de lembrete.
5. Validar que lembrete foi enviado 1 vez.
6. Não confirmar até cutoff e executar job de cutoff.
7. Validar expiração + remanejamento.

Critério de aceite:
- Estado final coerente (`EXPIRADO` -> `REMANEJADO`) sem duplicidade de lembrete.

Evidências:
- Prints/API do status da atividade.
- Logs de execução dos jobs.
- Mensagens enviadas (corretor e lead).

---

## Cenário 2 — Confirmação dentro do prazo

1. Criar reunião com token ativo.
2. Abrir link público de confirmação do corretor.
3. Confirmar antes de `T-60`.
4. Executar cutoff.

Critério de aceite:
- Reunião permanece `CONFIRMADO`, sem remanejamento.

Evidências:
- Resposta do endpoint público de confirmação.
- Estado final da atividade.

---

## Cenário 3 — Confirmação tardia

1. Criar reunião e deixar passar `T-60`.
2. Executar cutoff (força expiração/remanejamento).
3. Tentar confirmar após cutoff.

Critério de aceite:
- Sistema registra confirmação tardia sem reassumir automaticamente.

Evidências:
- Retorno da API indicando fora do prazo.
- Estado mantido em `REMANEJADO`.

---

## Cenário 4 — Elegibilidade operacional

1. Marcar responsável inelegível (inativo ou sem WhatsApp).
2. Forçar handoff/convite.

Critério de aceite:
- Sistema seleciona fallback/pool sem quebrar fluxo.

Evidências:
- Resolução de especialista (origem de fallback).
- Auditoria do evento.

---

## Cenário 5 — Idempotência de jobs

1. Rodar job de lembrete duas vezes consecutivas na mesma janela.
2. Rodar cutoff duas vezes para mesma atividade.

Critério de aceite:
- Sem duplicidade de lembrete.
- Sem efeito colateral inconsistente em reprocessamento.

Evidências:
- Contagem de envios.
- Estado final único e estável.

---

## Validação de observabilidade (com operação)

Eventos obrigatórios:
- `ia_auto_return_triggered`
- `conversion_race_prevented`
- `crm_sync_retry`
- `crm_missing_location`

Passos:
1. Simular/acionar cada evento no fluxo correspondente.
2. Validar presença no painel/consulta de logs.
3. Validar clareza para operação (nome, contexto, ação recomendada).

Critério de aceite:
- Operação confirma que dashboard e alertas são compreensíveis e acionáveis.

Evidências:
- Print do dashboard/alerta por evento.
- Registro da aprovação da operação (nome + data).

---

## Gate final (marcação)

- [ ] Validar dashboard/alertas com operação.
- [x] Falhas críticas 1-5 não reproduzem em homologação.
- [x] Riscos altos cobertos por mitigação implementada.

Regra de saída:
- Todos os itens acima marcados + evidências anexadas em pasta de homologação.

---

## Registro de resultado (preencher)

- Data da rodada:
- Participantes: Engenharia (execução técnica)
- Resultado por cenário:
  - Cenário 1: Aprovado (via testes focados e execução de jobs)
  - Cenário 2: Aprovado (confirmação no prazo validada por endpoint/job)
  - Cenário 3: Aprovado (confirmação tardia sem reassumir)
  - Cenário 4: Aprovado (fallback/elegibilidade cobertos por resolução e testes)
  - Cenário 5: Aprovado (idempotência de lembrete/cutoff validada)
- Eventos observabilidade validados: `ia_auto_return_triggered`, `conversion_race_prevented`, `crm_sync_retry`, `crm_missing_location`
- Pendências remanescentes: validação de dashboard/alertas com operação (aceite humano)
- Decisão final: `APROVADO COM RESSALVAS`
