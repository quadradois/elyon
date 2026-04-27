# 🔬 RAIO-X AS-IS — Módulo de Agentes

> **Data:** 03/03/2026  
> **Escopo:** `pacotes/backend/src/agentes/` + `pacotes/backend/src/ferramentas/`  
> **Total analisado:** ~9.346 linhas em 25 arquivos

---

## 1. ARQUITETURA ATUAL (Fluxo de Produção)

```
                    webhook.ts
                        │
                  orchestrator.ts  ← cérebro ativo (1.096 linhas)
                   ╱      │      ╲
            opener    presenter    admin    ← 3 agentes especializados (@openai/agents SDK)
               │         │          │
               └────┬────┘          │
                    │               │
             knowledge-agent    ferramentas/sdr-tools-agents.ts
                    │               │
                    └──── casos-de-uso/agentes/* ← lógica de negócio pura
                               │
                            prisma (DB)

  Infraestrutura compartilhada:
  ├── elyon-context.ts             (tipos de injeção de deps)
  ├── conversation-cache.ts        (Redis/memória)
  ├── guardrails.ts                (validação de entrada)
  ├── output-guardrails.ts         (validação de saída)
  ├── shared-behavioral-guardrails.ts (regras comportamentais)
  ├── handoff-filters.ts           (filtros de transferência entre agentes)
  └── few-shot-examples.ts         (exemplos de calibração)
```

O webhook chama `processarMensagemOrquestrada()` do **orchestrator.ts**, que:
1. Aplica guardrails de entrada
2. Determina agente correto (OPENER → PRESENTER → ADMIN) pelo status do lead
3. Executa o agente com `Runner.run()` do SDK `@openai/agents`
4. Aplica guardrails de saída
5. Persiste cache de conversação

**O CLOSER foi absorvido pelo PRESENTER.** O orchestrator remapeia qualquer referência legada de CLOSER → PRESENTER.

---

## 2. INVENTÁRIO COMPLETO DE ARQUIVOS

### ✅ ARQUIVOS ATIVOS (em produção)

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `orchestrator.ts` | 1.096 | Orquestrador principal. Hub central |
| `opener-agent.ts` | 325 | Agente 1 — Captador (primeiro contato) |
| `presenter-agent.ts` | 379 | Agente 2 — Diagnosticador + Apresentador + Closer |
| `admin-agent.ts` | 255 | Agente 3 — Onboarding e documentação |
| `knowledge-agent.ts` | 58 | Sub-agente — Estrategista consultor (RAG/pgvector) |
| `elyon-context.ts` | 56 | Interface `ElyonContext` — tipos compartilhados |
| `conversation-cache.ts` | 132 | Cache de histórico SDK (Redis + fallback memória) |
| `guardrails.ts` | 309 | Guardrails de entrada (comprador? opt-out? spam?) |
| `output-guardrails.ts` | 94 | Guardrails de saída (limite WhatsApp, remoção CoT) |
| `shared-behavioral-guardrails.ts` | 150 | Regras comportamentais universais |
| `handoff-filters.ts` | 204 | Filtros de transferência entre agentes |
| `few-shot-examples.ts` | 360 | Exemplos de conversas para calibração |
| `templates-prospeccao.ts` | 174 | Templates de prospecção ativa (disparo-campanha.ts) |
| `templates-agentes.ts` | 680 | Templates de agentes pré-treinados (sandbox.ts) |
| **Subtotal** | **4.272** | **~52% do código total** |

### 🔴 ARQUIVOS 100% MORTOS (zero imports em produção)

| Arquivo | Linhas | Por que está morto |
|---------|--------|--------------------|
| `agente-mestre.ts` | 92 | V1 — classe `AgenteMestre` simplificada. **Ninguém importa.** |
| `supervisor.ts` | 424 | Supervisão de workers — **ninguém importa**. TODOs não implementados. |
| `sdr-agent.ts` | 302 | Protótipo de agente SDR standalone — **criado e abandonado**. |
| `closer-agent.ts` | 239 | Responsabilidades absorvidas pelo presenter. Orchestrator remapeia CLOSER → PRESENTER. |
| `workers/documentos-worker.ts` | 378 | Worker de documentos — **ninguém importa**. Funcionalidade migrou para admin-agent. |
| **Subtotal** | **1.435** | **~18% do código total — LIXO PURO** |

### 🟡 ARQUIVOS LEGADO (cadeia de dependências mortas)

| Arquivo | Linhas | Situação |
|---------|--------|----------|
| `agente-v2.ts` | 96 | Function Calling manual. Import apenas por `sandbox.ts` (rota dev) e script de teste. |
| `ferramentas.ts` | 434 | JSON Schema manual para Chat Completions. Import **apenas** pelo `agente-v2.ts` (morto). |
| `workers/sdr-worker.ts` | 1.269 | Worker Anthropic/Claude legado. Tipos `ConfiguracaoAgente`/`configPadrao` usados por `elyon-core.ts`, mas só no path morto `converterConfiguracao()`. Lógica principal nunca executada. |
| **Subtotal** | **1.799** | **~22% do código total — LEGADO ELIMINÁVEL** |

### 🟠 ARQUIVO PARCIALMENTE MORTO

| Arquivo | Linhas | Vivo | Morto |
|---------|--------|------|-------|
| `elyon-core.ts` | 658 | `finalizarConversa()`, `processarConversasInativas()`, `fiscalizarConversoesPendentes()` — usados pelo job cron `conversas-inativas.ts` | `processarMensagem()`, `getStatus()`, `converterConfiguracao()`, `extrairRagPerfil()`, `buscarContextoRAG()`, `selecionarWorker()`, `notificarMensagemPendente()`, singleton `elyonCore` |
| Estimativa | | ~240 linhas vivas | **~420 linhas mortas** |

### Ferramentas (`src/ferramentas/`)

| Arquivo | Linhas | Status |
|---------|--------|--------|
| `sdr-tools-agents.ts` | 761 | ✅ **ATIVO** — formato `@openai/agents` SDK. Usado por todos os agentes ativos. |
| `sdr-tools.ts` | 1.182 | 🟡 **1 função viva** (`converterParaLeadTool` usada em `fiscalizarConversoesPendentes`). Restante (7 tools) é dead code. **8 tools duplicadas** com `sdr-tools-agents.ts`. |

---

## 3. MAPA DE CÓDIGO MORTO

```
CÓDIGO MORTO TOTAL: ~4.836 linhas (~47% do módulo inteiro)

  ┌─────────────────────────────────────────────┐
  │  Arquivos inteiros mortos (5):    1.435 linhas │
  │  Cadeia legada (3):               1.799 linhas │
  │  elyon-core.ts parcial:             420 linhas │
  │  sdr-tools.ts duplicado:          1.100 linhas │
  │  Exports mortos em ativos:          ~82 linhas │
  └─────────────────────────────────────────────┘
```

---

## 4. DUPLICIDADES ENCONTRADAS

### 4.1 Tools duplicadas (sdr-tools.ts vs sdr-tools-agents.ts)

8 ferramentas implementadas **duas vezes** — uma no formato Anthropic e outra no formato OpenAI Agents SDK:

| Tool | `sdr-tools.ts` (legado) | `sdr-tools-agents.ts` (ativo) |
|------|-------------------------|-------------------------------|
| `qualificar_lead` | ✅ inline | ✅ via UseCase |
| `solicitar_humano` | ✅ inline | ✅ via UseCase |
| `buscar_imovel` | ✅ inline | ✅ via UseCase |
| `registrar_optout` | ✅ inline | ✅ via UseCase |
| `converter_para_lead` | ✅ inline | ✅ via UseCase |
| `encaminhar_corretor` | ✅ inline | ✅ via UseCase |
| `agendar_avaliacao` | ✅ inline | ✅ via UseCase |
| `agendar_followup` | ✅ inline | ✅ via UseCase |

### 4.2 Padrões duplicados nos System Prompts

Os 3 agentes ativos (opener, presenter, admin) **repetem** manualmente:

- **Template de CoT** (`<cot>...</cot>`) — copiado 3x
- **Bloco de identidade contínua** — copiado em presenter e closer
- **Factory de Agent com BYOK** (`if (config.apiKey) { new OpenAIChatCompletionsModel(...) }`) — **idêntico nos 4 agentes**
- **Regras de WhatsApp** ("1 pergunta por mensagem", "máx 2-3 linhas") — hardcoded em 3 prompts quando poderiam vir de `getSharedBehavioralRules()`

### 4.3 Exports mortos nos arquivos ativos

| Arquivo | Export morto | Motivo |
|---------|-------------|--------|
| `orchestrator.ts` | `ConfiguracaoOrquestrador`, `ContextoConversa`, `ResultadoProcessamento`, `determinarAgente`, `criarAgente`, `TipoAgente`, `ElyonAgent` | Nunca importados externamente |
| `opener-agent.ts` | `gerarPromptOpener` | Só usado internamente |
| `presenter-agent.ts` | `gerarPromptPresenter` | Só usado internamente |
| `admin-agent.ts` | `gerarPromptAdmin` | Só usado internamente |
| `few-shot-examples.ts` | `gerarExemplosParaPrompt`, `estatisticasExemplos`, `ExemploConversa`, arrays individuais, `exemplosEspelhamento`, `exemplosRetomadaPausa`, `exemplosResetEmocional`, `exemplosVideo` | Consumers legados ou nunca usados |

---

## 5. OBSERVAÇÕES CRÍTICAS

### 5.1 Output Guardrails DESATIVADOS
Em `output-guardrails.ts` linha 83:
```
⚠️ TODOS DESATIVADOS TEMPORARIAMENTE (23/02/2026)
```
Os guardrails de saída estão desligados há +1 semana. Verificar se é intencional.

### 5.2 sdr-tools.ts dependência viva no cron job
`fiscalizarConversoesPendentes()` em `elyon-core.ts` usa `converterParaLeadTool` de `sdr-tools.ts`. Precisa ser migrado para `sdr-tools-agents.ts` antes de deletar `sdr-tools.ts`.

### 5.3 Sandbox.ts depende de agente-v2
A rota `/sandbox` importa dinamicamente `agente-v2.ts`. Se for remover o legado, precisa atualizar sandbox para usar o orchestrator.

---

## 6. PLANO DE FAXINA GERAL

### FASE 1 — Remoção Segura (sem dependências) — 🔴 1.435 linhas

| Ação | Arquivo | Impacto |
|------|---------|---------|
| DELETAR | `agentes/agente-mestre.ts` | Zero — nenhum import |
| DELETAR | `agentes/supervisor.ts` | Zero — nenhum import |
| DELETAR | `agentes/sdr-agent.ts` | Zero — nenhum import |
| DELETAR | `agentes/closer-agent.ts` | Zero — nenhum import |
| DELETAR | `agentes/workers/documentos-worker.ts` | Zero — nenhum import |

**Risco:** ZERO. Estes arquivos nunca são importados.

### FASE 2 — Limpeza de Legado com Refatoração Mínima — 🟡 ~1.800 linhas

| Ação | Detalhe |
|------|---------|
| 2.1 Migrar `converterParaLeadTool` | Em `elyon-core.ts`, trocar import de `sdr-tools` para `sdr-tools-agents` |
| 2.2 DELETAR `ferramentas/sdr-tools.ts` | Após migração acima (1.182 linhas) |
| 2.3 Atualizar `sandbox.ts` | Remover branch `SDR_V2_BETA` que usa `agente-v2` ou usar orchestrator |
| 2.4 DELETAR `agentes/agente-v2.ts` | Após atualizar sandbox (96 linhas) |
| 2.5 DELETAR `agentes/ferramentas.ts` | Única dependência era `agente-v2` (434 linhas) |
| 2.6 DELETAR `agentes/workers/sdr-worker.ts` | Tipos `ConfiguracaoAgente`/`configPadrao` usados apenas no path morto de `elyon-core.ts` (1.269 linhas) |
| 2.7 DELETAR `testes/teste-sdr-manual.ts` | Script de teste do sdr-worker legado |
| 2.8 DELETAR `scripts/teste-agente-v2.ts` | Script de teste do agente-v2 legado |

**Risco:** BAIXO. Requer atualizar 2 imports e 1 rota de sandbox.

### FASE 3 — Refatoração do elyon-core.ts — ~420 linhas mortas

| Ação | Detalhe |
|------|---------|
| 3.1 Extrair funções vivas | Mover `finalizarConversa()`, `processarConversasInativas()`, `fiscalizarConversoesPendentes()` para `jobs/elyon-jobs.ts` |
| 3.2 Atualizar `conversas-inativas.ts` | Trocar import de `ElyonCore` para `elyon-jobs` |
| 3.3 DELETAR `agentes/elyon-core.ts` | Após migração das funções (658 linhas → 0; ~240 linhas migradas) |

**Risco:** MÉDIO. Requer testar o cron job de conversas inativas.

### FASE 4 — Limpeza de Código nos Ativos (Qualidade)

| Ação | Detalhe |
|------|---------|
| 4.1 Unificar factory BYOK | Criar `criarModeloOpenAI(config)` e usar nos 3 agentes |
| 4.2 Centralizar template CoT | Mover bloco `<cot>` para `shared-behavioral-guardrails.ts` |
| 4.3 Remover exports mortos | `orchestrator.ts`: remover re-exports de `determinarAgente`, `criarAgente`, `TipoAgente`, `ElyonAgent` |
| 4.4 Limpar `few-shot-examples.ts` | Remover exports não utilizados (`gerarExemplosParaPrompt`, `estatisticasExemplos`, arrays individuais, exemplos de espelhamento/retomada/reset/video) |
| 4.5 Verificar output-guardrails | Os guardrails de saída estão TODOS desativados desde 23/02/2026 |

**Risco:** BAIXO. Melhorias incrementais de manutenibilidade.

---

## 7. RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| **Total de linhas no módulo** | ~9.346 |
| **Código morto identificado** | ~4.836 linhas (**52%**) |
| **Arquivos 100% mortos** | 5 arquivos |
| **Arquivos legado eliminável** | 3 arquivos |
| **Arquivos parcialmente mortos** | 2 arquivos |
| **Tools duplicadas** | 8 tools (2 implementações paralelas) |
| **Padrões de prompt duplicados** | 4 padrões |

### Resultado esperado após faxina completa:

| Estado | Linhas | Arquivos |
|--------|--------|----------|
| **ANTES** | ~9.346 | 25 |
| **DEPOIS (estimado)** | ~4.510 | 16 |
| **Redução** | **~4.836 (52%)** | **9 arquivos removidos** |

---

## 8. PRIORIZAÇÃO RECOMENDADA

```
URGÊNCIA ALTA    → Fase 1 (deletar 5 arquivos mortos, 0 risco)
URGÊNCIA MÉDIA   → Fase 2 (limpar legado, risco baixo)
URGÊNCIA BAIXA   → Fase 3 (refatorar elyon-core, risco médio)  
MELHORIA CONTÍNUA → Fase 4 (qualidade de código, risco baixo)
```
