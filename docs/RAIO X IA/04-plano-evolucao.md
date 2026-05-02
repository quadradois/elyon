# 04 - Plano De Evolução E TO-BE

## TO-BE Recomendado

O agente deve evoluir de “LLM com tools operacionais” para “orquestrador governado com LLM conversacional”.

### Princípios

1. O LLM conversa e sugere.
2. O backend autoriza e executa.
3. Toda tool sensível valida tenant, fase, evidência e idempotência.
4. Opt-out e handoff humano são determinísticos, não dependentes de prompt.
5. Ações irreversíveis exigem approval ou policy engine.
6. Métricas e evals bloqueiam regressões.

## Arquitetura TO-BE

| Camada | Responsabilidade |
|---|---|
| Conversational Agent | Responder com tom certo, extrair intenção e sugerir próxima ação. |
| State Resolver | Resolver contato/lead, tenant, fase e memória confiável. |
| Tool Policy Engine | Autorizar/bloquear ações com base em regras determinísticas. |
| Action Executor | Executar side effects idempotentes e auditáveis. |
| Human Handoff Service | Criar tarefa, notificar humano, pausar IA e controlar SLA. |
| Evaluation Layer | Rodar testes/evals e monitorar produção. |

## Fases De Evolução

### Fase 0 - Hardening P0

Objetivo: eliminar riscos críticos.

Entregas:

- Contratos de ID corrigidos.
- Opt-out transacional.
- Tenant ownership em tools.
- Approval/policy para CRM, contrato e CAPTADO.

Critério de saída:

- Todos os testes P0 passando.
- Nenhuma tool sensível executa sem tenant validado.
- Opt-out validado em teste E2E.

### Fase 1 - Handoff E Operação Humana

Objetivo: garantir que promessas ao lead reflitam ações reais.

Entregas:

- Handoff humano cria tarefa e notificação.
- IA pausa quando `modoAtendimento=HUMANO`.
- SLA ou status de atendimento disponível.
- Agendamento local comunicado corretamente.

Critério de saída:

- Comprador/humano gera registro operacional rastreável.
- Sem mensagem prometendo ação que não ocorreu.

### Fase 2 - Qualidade Conversacional E Testes

Objetivo: reduzir regressões em multi-turno.

Entregas:

- Evals multi-turno.
- Rubricas: continuidade, não repetição, uma pergunta, não invenção, uso correto de tool.
- Testes adversariais de prompt injection, IDs e opt-out.

Critério de saída:

- Baseline de qualidade documentado.
- Regressões bloqueadas em CI.

### Fase 3 - Memória E Estado

Objetivo: reduzir confusão e repetição.

Entregas:

- Schema state com source-of-truth claro.
- Resolução única de entidade.
- Menos dependência de histórico bruto.

Critério de saída:

- Queda de repetição e falha de tool por ID.

### Fase 4 - Aprendizado Controlado

Objetivo: usar Learning Bank/PAOL sem desestabilizar.

Entregas:

- PAOL em shadow.
- A/B limitado por tenant/campanha.
- Bloqueio de ações críticas por policy.

Critério de saída:

- Ganho medido sem aumento de opt-out/fallback/tool failure.

### Fase 5 - Piloto Ampliado

Objetivo: liberar autonomia progressiva.

Entregas:

- Rollout por tenant.
- Monitoramento por fase do funil.
- Rollback rápido por feature flag.

Critério de saída:

- Go para produção ampliada com métricas estáveis.

## Go / No-Go Por Fase

| Fase | Go se | No-Go se |
|---|---|---|
| 0 | P0 resolvidos e testados. | IDs/opt-out/tenant ainda frágeis. |
| 1 | Handoff humano rastreável. | IA promete humano sem tarefa. |
| 2 | Evals passam no baseline. | Só há testes unitários isolados. |
| 3 | Estado reduz repetição. | Schema/history continuam divergentes. |
| 4 | PAOL shadow positivo. | PAOL influencia ação crítica sem policy. |
| 5 | Métricas estáveis. | Aumento de opt-out, falha de tools ou reclamações. |
