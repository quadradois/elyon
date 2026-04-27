# Plano de Implementação — Aprendizado Adaptativo Elyon

Data: 26/04/2026  
Escopo: Evoluir o agente para aprender por tenant com baixo risco operacional.

## Objetivo
- Aumentar conversão e qualidade de resposta com aprendizado contínuo.
- Reduzir repetição de perguntas e uso de contexto desatualizado.
- Validar PAOL com segurança antes de tornar padrão.

## Princípios de Execução
- Primeiro ROI: memória de decisão + recompensa + fatos temporais.
- Segurança de rollout: `feature flag` + modo sombra/A-B.
- Isolamento por tenant obrigatório em toda persistência de aprendizado.
- Observabilidade antes de ativar comportamento novo em produção.

## Prioridades (ordem de execução)

## P0 — Cockpit v1 + Baseline e Instrumentação (obrigatório)
- [x] Criar Cockpit do Agente v1 (visão operacional por tenant).
- [x] Bloco de Qualidade:
  - [x] taxa de repetição de perguntas
  - [x] aderência ao fluxo/fase
  - [x] uso de contexto válido vs desatualizado
- [x] Bloco de Gargalos:
  - [x] latência p50/p95 por etapa (orquestrador, LLM, tools)
  - [x] handoffs excessivos
  - [x] abandono por etapa
- [x] Bloco de Erros:
  - [x] falha por tool
  - [x] fallback por tipo (`PROVIDER_FALLBACK`, `ANTI_REPEAT_GUARD`, `EXCEPTION`)
  - [x] opt-out por abordagem/fase
- [x] Bloco de Sugestões (regras simples):
  - [x] recomendação automática quando repetição > limiar
  - [x] recomendação quando falha de tool > limiar
  - [x] recomendação quando latência/custo sair do teto
- [x] Definir métricas baseline (últimos 14 dias): conversão, tempo até handoff, opt-out, custo/tokens por conversa.
- [x] Criar dashboard técnico de experimento por tenant (controle vs variante).
- [ ] Executar A/A test de instrumentação por 7 dias (sem mudança de comportamento).
- [x] Adicionar `feature flags`:
  - [x] `agent_cockpit_enabled`
  - [x] `learning_bank_enabled`
  - [x] `temporal_facts_enabled`
  - [x] `paol_shadow_enabled`
  - [x] `paol_ab_enabled`
  - [x] `mcp_server_enabled`
- [x] Padronizar evento de outcome por conversa (sucesso, opt-out, handoff humano, perda).

Arquivos alvo:
- `pacotes/backend/src/agentes/orchestrator-metrics.ts`
- `pacotes/backend/src/agentes/orchestrator.ts`
- `pacotes/backend/src/rotas/metricas-agentes.ts`
- `pacotes/backend/src/rotas/metricas-ia.rotas.ts`
- `pacotes/frontend/src/`

Critério de saída P0:
- [x] Cockpit v1 ativo com blocos de qualidade, gargalos, erros e sugestões.
- [x] Dashboard e métricas baseline disponíveis por tenant.
- [ ] A/A estável (diferença entre grupos dentro da tolerância definida).
- [x] Flags prontas para liberar por percentual.

---

## P1 — Reasoning Bank (alto impacto, baixo/médio risco)
- [x] Criar modelo Prisma de aprendizados por tenant (ação, contexto, outcome, recompensa, timestamp).
- [x] Criar serviço `BancoDeAprendizados` com operações:
  - [x] registrar aprendizado
  - [x] consultar top ações por contexto
  - [x] decaimento temporal (peso menor para eventos antigos)
- [x] Integrar no orquestrador:
  - [x] registrar aprendizado no pós-turno
  - [x] consultar recomendações antes da escolha de abordagem
- [x] Criar endpoint/métrica “Top padrões por tenant”.
- [x] Cobrir com testes unitários + integração.

Arquivos alvo:
- `pacotes/backend/prisma/schema.prisma`
- `pacotes/backend/src/servicos/`
- `pacotes/backend/src/agentes/orchestrator.ts`
- `pacotes/backend/src/agentes/__tests__/`

Critério de saída P1:
- [x] Aprendizado persistindo por tenant sem vazamento.
- [x] Recomendações consumidas pelo orquestrador com flag ativa.

---

## P1.5 — Fatos Temporais no Contexto (alto ROI, baixo risco)
- [x] Definir estrutura de fato temporal (`fato`, `validFrom`, `validUntil`, `confidence`, `source`).
- [x] Implementar política de expiração por tipo de fato (urgência, objeção, intenção).
- [x] Enriquecer `input-builder` para injetar apenas fatos ativos.
- [x] Logar taxa de “fato expirado removido”.
- [x] Testes de regressão para evitar re-perguntas e contexto stale.

Arquivos alvo:
- `pacotes/backend/src/agentes/input-builder.ts`
- `pacotes/backend/src/agentes/conversation-state.ts`
- `pacotes/backend/src/agentes/context-builder.ts`

Critério de saída P1.5:
- [ ] Queda mensurável de perguntas repetidas (pendente de janela mínima de observação).
- [x] Zero regressão em guardrails críticos.

---

## P2 — Experience Replay em Job (médio impacto, risco controlado)
- [x] Criar rotina de replay diário por tenant:
  - [x] lote recente (24h)
  - [x] amostra histórica aleatória
- [x] Aplicar atualização de peso com taxa diferente (recente > histórico).
- [x] Registrar auditoria do replay (quantos exemplos, quais outcomes).
- [x] Criar proteção contra “drift” (limite máximo de ajuste por execução).

Arquivos alvo:
- `pacotes/backend/src/jobs/conversas-inativas.ts`
- `pacotes/backend/src/agentes/elyon-core.ts`
- `pacotes/backend/src/servicos/`

Critério de saída P2:
- [ ] Replay rodando estável por 7 dias (janela de observação em andamento).
- [x] Sem aumento de erro operacional em jobs.

---

## P3 — PAOL em Modo Sombra e A/B (não ativar direto como padrão)
- [x] Implementar `Plan` (2-3 ações candidatas por turno).
- [x] Implementar `Act` (escolha por score histórico + regras de governança).
- [x] Implementar `Observe` (outcome estruturado por turno/conversa).
- [x] Implementar `Learn` (EMA da política).
- [x] Modo sombra:
  - [x] calcular decisão PAOL sem executar (apenas logar divergência vs atual)
  - [x] medir ganho potencial e custo
- [x] A/B controlado:
  - [x] 10% tráfego variante (suportado por flag)
  - [x] 25% se manter KPIs (suportado por flag)
  - [x] 50% se manter KPIs (suportado por flag)
  - [x] 100% após estabilidade (ativado no tenant único de testes)

KPIs mínimos para promoção:
- [ ] Conversão não inferior ao controle (pendente de amostra real).
- [ ] Opt-out não piora (pendente de amostra real).
- [ ] Latência p95 dentro do limite aceito (pendente de amostra real).
- [ ] Custo por conversa dentro do teto definido (pendente de amostra real).

Arquivos alvo:
- `pacotes/backend/src/agentes/orchestrator.ts`
- `pacotes/backend/src/agentes/orchestrator-metrics.ts`
- `pacotes/backend/src/agentes/roteiro-governanca.ts`

---

## Trilha Paralela — MCP (plataforma/integrações)
- [ ] Definir escopo v1 de ferramentas expostas.
- [ ] Implementar servidor MCP com autenticação por tenant.
- [ ] Publicar contrato de ferramentas e limites.
- [ ] Observabilidade de uso e rate limit.

Observação:
- [ ] Não bloquear entregas de conversão por causa do MCP.
- [ ] Ativar para parceiros/clientes piloto após estabilizar P1-P3.

---

## Checklist de Qualidade (Definition of Done)
- [x] Testes unitários para serviços novos.
- [x] Testes de integração no orquestrador.
- [x] Testes de regressão de guardrails críticos.
- [ ] Migração Prisma revisada + rollback documentado.
- [ ] Feature flag com rollout gradual documentado.
- [ ] Dashboard com comparação controle vs variante.
- [ ] Log de auditoria com trilha por tenant.

## Sequência Recomendada de Execução (resumo rápido)
1. [ ] P0 Cockpit v1 + baseline + A/A + flags.
2. [x] P1 Reasoning Bank.
3. [x] P1.5 Fatos temporais.
4. [x] P2 Experience Replay.
5. [x] P3 PAOL em sombra -> A/B -> promoção (promoção final pendente de amostra real).
6. [ ] MCP como trilha paralela de plataforma.

## Riscos e Mitigações
- [ ] Risco: recompensa mal definida enviesar política.  
Mitigação: tabela de outcome padronizada + revisão semanal.
- [ ] Risco: aumento de latência/tokens no PAOL.  
Mitigação: limite de candidatos e budget por turno.
- [ ] Risco: vazamento entre tenants.  
Mitigação: chave composta por `tenantId` e testes de isolamento.
- [ ] Risco: regressão silenciosa de conversão.  
Mitigação: rollout progressivo com gate de KPI.
