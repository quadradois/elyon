# Plano de Implementação — Correções do RAIO-X AS-IS

Data: 2026-04-29  
Origem: `docs/raio-x/RAIO-X AS-IS — Fluxo Completo do Agente IA/RAIO-X AS-IS — Fluxo Completo do Agente IA.md`  
Base de boas práticas: `docs/skills/skills-guia-dev.md`

---

## 1) Objetivo

Eliminar as falhas críticas do fluxo IA/Humano/CRM, reduzir riscos altos de inconsistência de estado e garantir um fluxo confiável de ponta a ponta com observabilidade e validação contínua.

---

## 2) Princípios de implementação (boas práticas)

- Progressive disclosure no contexto do agente: carregar somente contexto necessário por etapa.
- Fonte de verdade explícita: dados negociados em fase humana devem ser persistidos em campos estruturados.
- Idempotência e controle de concorrência: operações críticas com trava e chave idempotente.
- Fail-safe sobre fail-open: nunca inferir cidade/estado com default hardcoded quando dado está ausente.
- Ordem transacional clara: status final (ex.: `CAPTADO`) deve ser consequência de sucesso operacional (ex.: CRM sync).
- Observabilidade primeiro: toda transição crítica deve ter log/telemetria e motivo.
- Rollout gradual: feature flags + validação por cenário antes de liberar 100%.

---

## 3) Escopo priorizado

### P0 — Crítico (bloqueia operação confiável)

1. Retorno automático Humano → IA.
2. Contradição `enviar_para_crm` vs `CAPTADO`.
3. Cidade/estado hardcoded no CRM.
4. Corrida entre conversão por tool e fallback pós-orquestrador.
5. Admin Agent sem contexto estruturado do que foi negociado no humano.

### P1 — Alto

1. Divergência entre histórico DB e histórico SDK/Redis.
2. Perda de `schemaState` durante modo humano.
3. Retry automático no envio ao CRM.
4. Invalidação de cache de agent-chain com briefing atualizado.

### P2 — Médio

1. Garantia de `modoAtendimento = HUMANO` ao encaminhar corretor.

---

## 4) Plano por épicos

## Épico A — Reativação IA e continuidade de contexto

**Objetivo:** IA retomar automaticamente após fase humana com contexto consistente.

- Implementar mecanismo de devolução automática Humano → IA (timer/job/evento) com critérios explícitos.
- Persistir resumo estruturado da fase humana (tipo autorização, comissão, prazo, pendências, source_of_truth).
- Reidratar `schemaState` e contexto do agente na retomada.
- Adicionar trilha de auditoria: quando entrou em humano, quando voltou para IA, por qual gatilho.

**Critérios de aceite:**
- Contato em `HUMANO` retorna a `IA` sem ação manual após condição de retorno.
- Admin Agent recebe campos estruturados negociados na fase humana.

## Épico B — Integridade de conversão e concorrência

**Objetivo:** impedir duplicidade e corridas de conversão.

- Unificar caminho de conversão: definir uma única autoridade por turno (tool ou fallback, não ambos).
- Aplicar trava por contato + chave idempotente por mensagem/evento.
- Registrar motivo de “conversão ignorada” quando já convertido.

**Critérios de aceite:**
- Sem criação duplicada de lead em carga concorrente.
- Logs mostram decisão determinística de conversão por turno.

## Épico C — Fluxo CRM consistente

**Objetivo:** sincronização CRM confiável e sem corrupção de endereço.

- Remover fallback hardcoded `Goiânia/GO`.
- Ajustar parsing de endereço para retornar `null` quando incompleto e tratar no payload.
- Reordenar regra de negócio: `CAPTADO` apenas após sucesso de `enviar_para_crm`.
- Implementar retry com backoff + estado de reprocessamento para erros transitórios.

**Critérios de aceite:**
- Endereço nunca preenchido com cidade/estado incorretos por default.
- Lead só entra em `CAPTADO` após CRM sincronizado com sucesso.

## Épico D — Coerência de memória e cache

**Objetivo:** reduzir perda de contexto por expiração de Redis e cache stale.

- Definir política de fallback de histórico: DB + reconstrução de tool history mínima.
- Persistir checkpoints essenciais fora do cache volátil.
- Invalidar `agent-chain` quando briefing/config do tenant mudar (event-driven ou versionamento).

**Critérios de aceite:**
- Reinício/expiração de Redis não causa reexecução indevida de tools críticas.
- Mudança de briefing refletida no agente sem janela longa de defasagem.

## Épico E — Observabilidade, testes e rollout

**Objetivo:** garantir segurança de deploy e diagnóstico rápido.

- Instrumentar métricas: retomada IA, erros CRM, retries, conflitos de conversão, tempo por etapa.
- Criar suíte de regressão E2E (IA → Humano → IA → Admin → CRM).
- Adotar feature flags por correção crítica.
- Definir runbook de rollback e operação assistida.

**Critérios de aceite:**
- Dashboard com indicadores de saúde por etapa.
- Regressão crítica coberta por testes automatizados.

---

## 5) Sequência de execução sugerida

1. Sprint 1 (P0): Épicos A + C (retorno IA, contexto humano, CRM/CAPTADO, endereço).
2. Sprint 2 (P0/P1): Épico B + retry CRM.
3. Sprint 3 (P1): Épico D (histórico/state/cache).
4. Sprint 4 (P1/P2): observabilidade final, hardening e rollout completo.

---

## 6) Riscos e mitigação

- Risco: retorno automático reativar IA cedo demais.  
  Mitigação: janela mínima de inatividade + regras de elegibilidade + flag por tenant.

- Risco: mudança de ordem CRM/CAPTADO impactar funil atual.  
  Mitigação: migração assistida e script de reconciliação de status.

- Risco: retries causarem duplicidade externa no CRM.  
  Mitigação: idempotency key no payload + deduplicação por lead externo.

---

## 7) Definition of Done

- Falhas críticas 1 a 5 sem reprodução em cenários de teste.
- Riscos altos 1 a 4 com mitigação validada.
- Logs e métricas cobrindo decisões críticas de fluxo.
- Execução E2E validada em ambiente de homologação com evidências.
