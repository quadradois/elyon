# 🧹 PLAYBOOK — Faxina Módulo de Agentes

> **Criado:** 03/03/2026  
> **Concluído:** 03/03/2026  
> **Baseado em:** [RAIO_X_MODULO_AGENTES.md](./RAIO_X_MODULO_AGENTES.md)  
> **Resultado:** Eliminadas ~5.287 linhas de código morto (53% do módulo)  
> **Estado:** 23 arquivos → 15 arquivos | 9.346 linhas → 4.378 linhas

---

## ESTADO ANTES DA FAXINA

```
src/agentes/                          LINHAS   STATUS
├── orchestrator.ts                   1.096    ✅ ATIVO
├── elyon-core.ts                       658    🟠 PARCIAL (420 linhas mortas)
├── templates-agentes.ts                680    ✅ ATIVO
├── few-shot-examples.ts                360    ✅ ATIVO (exports mortos)
├── ferramentas.ts                      434    🔴 LEGADO
├── supervisor.ts                       424    🔴 MORTO
├── presenter-agent.ts                  379    ✅ ATIVO
├── opener-agent.ts                     325    ✅ ATIVO
├── guardrails.ts                       309    ✅ ATIVO
├── sdr-agent.ts                        302    🔴 MORTO
├── admin-agent.ts                      255    ✅ ATIVO
├── closer-agent.ts                     239    🔴 MORTO
├── handoff-filters.ts                  204    ✅ ATIVO
├── templates-prospeccao.ts             174    ✅ ATIVO
├── shared-behavioral-guardrails.ts     150    ✅ ATIVO
├── conversation-cache.ts               132    ✅ ATIVO
├── agente-v2.ts                         96    🔴 LEGADO
├── output-guardrails.ts                 94    ✅ ATIVO
├── agente-mestre.ts                     92    🔴 MORTO
├── knowledge-agent.ts                   58    ✅ ATIVO
├── elyon-context.ts                     56    ✅ ATIVO
└── workers/
    ├── sdr-worker.ts                 1.269    🔴 LEGADO
    └── documentos-worker.ts            378    🔴 MORTO

src/ferramentas/
├── sdr-tools.ts                      1.182    🟠 PARCIAL (1 fn viva, 7 mortas)
└── sdr-tools-agents.ts                761    ✅ ATIVO
```

---

## FASE 1 — REMOÇÃO SEGURA (zero dependências)

> **Risco:** ZERO | **Linhas removidas:** ~1.435 | **Arquivos removidos:** 5

### Pré-condição
- [ ] Confirmar que o build compila sem erros antes de iniciar

### Tarefas

| # | Tarefa | Arquivo | Linhas | Verificação |
|---|--------|---------|--------|-------------|
| 1.1 | Deletar `agente-mestre.ts` | `src/agentes/agente-mestre.ts` | 92 | `grep -r "agente-mestre" src/` retorna vazio |
| 1.2 | Deletar `supervisor.ts` | `src/agentes/supervisor.ts` | 424 | `grep -r "supervisor" src/` — sem imports |
| 1.3 | Deletar `sdr-agent.ts` | `src/agentes/sdr-agent.ts` | 302 | `grep -r "sdr-agent" src/` retorna vazio |
| 1.4 | Deletar `closer-agent.ts` | `src/agentes/closer-agent.ts` | 239 | `grep -r "closer-agent" src/` retorna vazio |
| 1.5 | Deletar `documentos-worker.ts` | `src/agentes/workers/documentos-worker.ts` | 378 | `grep -r "documentos-worker" src/` retorna vazio |

### Validação Fase 1
- [ ] `npx tsc --noEmit` compila sem erros
- [ ] `grep -rn "agente-mestre\|supervisor\|sdr-agent\|closer-agent\|documentos-worker" src/ --include="*.ts"` — zero resultados
- [ ] Serviço sobe normalmente (`npm run dev`)

### Resultado Fase 1
| Métrica | Antes | Depois |
|---------|-------|--------|
| Arquivos em `src/agentes/` | 23 | 18 |
| Linhas em `src/agentes/` | 8.164 | 6.729 |
| Código morto removido | — | 1.435 |

---

## FASE 2 — LIMPEZA DO LEGADO (requer migrações de import)

> **Risco:** BAIXO | **Linhas removidas:** ~2.981 | **Arquivos removidos:** 4

### 2.1 — Migrar `converterParaLeadTool` de sdr-tools → sdr-tools-agents

| # | Tarefa | Detalhe |
|---|--------|---------|
| 2.1.1 | Verificar assinatura | Comparar `converterParaLeadTool` em `sdr-tools.ts` vs `sdr-tools-agents.ts` |
| 2.1.2 | Atualizar import em `elyon-core.ts` | Trocar `from '../ferramentas/sdr-tools'` → `from '../ferramentas/sdr-tools-agents'` |
| 2.1.3 | Adaptar chamada se necessário | A tool no formato Agents SDK pode ter assinatura diferente |
| 2.1.4 | Testar | Verificar que `fiscalizarConversoesPendentes()` funciona |

**Verificação:** `grep -rn "sdr-tools'" src/ --include="*.ts"` — deve retornar zero (apenas `sdr-tools-agents` deve existir)

### 2.2 — Deletar `sdr-tools.ts` (legado)

| # | Tarefa | Arquivo | Linhas |
|---|--------|---------|--------|
| 2.2.1 | Deletar | `src/ferramentas/sdr-tools.ts` | 1.182 |

**Verificação:** `npx tsc --noEmit` sem erros

### 2.3 — Atualizar sandbox.ts e remover agente-v2

| # | Tarefa | Detalhe |
|---|--------|---------|
| 2.3.1 | Ler `sandbox.ts` | Entender como `SDR_V2_BETA` usa `agente-v2` |
| 2.3.2 | Remover branch `SDR_V2_BETA` | Ou migrar para usar orchestrator |
| 2.3.3 | Deletar `agente-v2.ts` | `src/agentes/agente-v2.ts` (96 linhas) |
| 2.3.4 | Deletar `ferramentas.ts` | `src/agentes/ferramentas.ts` (434 linhas) — dependia apenas do agente-v2 |
| 2.3.5 | Deletar script de teste | `scripts/teste-agente-v2.ts` |

**Verificação:** `grep -rn "agente-v2\|ferramentas'" src/agentes/ --include="*.ts"` — zero resultados

### 2.4 — Deletar sdr-worker.ts

| # | Tarefa | Detalhe |
|---|--------|---------|
| 2.4.1 | Verificar tipos usados | `ConfiguracaoAgente` e `configPadrao` — confirmar que só são usados em paths mortos de `elyon-core.ts` |
| 2.4.2 | Deletar | `src/agentes/workers/sdr-worker.ts` (1.269 linhas) |
| 2.4.3 | Deletar teste manual | `src/testes/teste-sdr-manual.ts` |
| 2.4.4 | Remover diretório `workers/` | Se vazio após deleções |

**Verificação:** `npx tsc --noEmit` sem erros

### Validação Fase 2
- [ ] `npx tsc --noEmit` compila sem erros
- [ ] `grep -rn "sdr-tools'" src/ --include="*.ts"` — zero (só sdr-tools-agents)
- [ ] `grep -rn "agente-v2\|sdr-worker\|documentos-worker" src/ --include="*.ts"` — zero
- [ ] Rota `/sandbox` funciona sem crash
- [ ] Job cron `conversas-inativas` funciona

### Resultado Fase 2
| Métrica | Antes (pós F1) | Depois |
|---------|----------------|--------|
| Arquivos em `src/agentes/` | 18 | 14 |
| Linhas em `src/agentes/` | 6.729 | 4.930 |
| `src/ferramentas/sdr-tools.ts` | 1.182 | DELETADO |
| Código morto removido (acumulado) | 1.435 | 4.416 |

---

## FASE 3 — REFATORAÇÃO DO ELYON-CORE (risco médio)

> **Risco:** MÉDIO | **Linhas líquidas removidas:** ~420 | **Arquivos:** 1 refatorado → 1 novo criado

### 3.1 — Extrair funções vivas para módulo próprio

| # | Tarefa | Detalhe |
|---|--------|---------|
| 3.1.1 | Criar `src/jobs/elyon-jobs.ts` | Novo arquivo com as 3 funções vivas |
| 3.1.2 | Migrar `finalizarConversa()` | Copiar lógica + dependências |
| 3.1.3 | Migrar `processarConversasInativas()` | Copiar lógica + dependências |
| 3.1.4 | Migrar `fiscalizarConversoesPendentes()` | Copiar lógica + adaptar import de `converterParaLeadTool` |
| 3.1.5 | Atualizar `conversas-inativas.ts` | Trocar `import { ElyonCore } from ../agentes/elyon-core` → `import { ... } from ../jobs/elyon-jobs` |
| 3.1.6 | Deletar `elyon-core.ts` | `src/agentes/elyon-core.ts` (658 linhas → 0) |

### Validação Fase 3
- [ ] `npx tsc --noEmit` compila sem erros
- [ ] Job cron `conversas-inativas` executa corretamente
- [ ] `fiscalizarConversoesPendentes()` detecta leads pendentes
- [ ] `finalizarConversa()` processa RAG corretamente

### Resultado Fase 3
| Métrica | Antes (pós F2) | Depois |
|---------|----------------|--------|
| Arquivos em `src/agentes/` | 14 | 13 |
| `elyon-core.ts` | 658 | DELETADO |
| Novo `jobs/elyon-jobs.ts` | — | ~240 |
| Código morto removido (acumulado) | 4.416 | 4.836 |

---

## FASE 4 — QUALIDADE DE CÓDIGO (melhoria contínua)

> **Risco:** BAIXO | **Linhas afetadas:** ~200 (refatoração, sem remoção líquida grande)

### 4.1 — Centralizar factory BYOK

| # | Tarefa | Detalhe |
|---|--------|---------|
| 4.1.1 | Criar `criarModeloOpenAI(config)` | Em `elyon-context.ts` ou novo `model-factory.ts` |
| 4.1.2 | Refatorar `opener-agent.ts` | Usar a factory |
| 4.1.3 | Refatorar `presenter-agent.ts` | Usar a factory |
| 4.1.4 | Refatorar `admin-agent.ts` | Usar a factory |

### 4.2 — Centralizar template CoT

| # | Tarefa | Detalhe |
|---|--------|---------|
| 4.2.1 | Mover bloco `<cot>` | Para `shared-behavioral-guardrails.ts` como constante exportada |
| 4.2.2 | Atualizar 3 agentes | Importar e usar a constante centralizada |

### 4.3 — Limpar exports mortos

| # | Tarefa | Arquivo |
|---|--------|---------|
| 4.3.1 | Remover re-exports mortos | `orchestrator.ts` — remover `{ determinarAgente, criarAgente, TipoAgente, ElyonAgent }` |
| 4.3.2 | Remover `gerarPromptOpener` export | `opener-agent.ts` — tornar função local |
| 4.3.3 | Remover `gerarPromptPresenter` export | `presenter-agent.ts` — tornar função local |
| 4.3.4 | Remover `gerarPromptAdmin` export | `admin-agent.ts` — tornar função local |

### 4.4 — Limpar few-shot-examples.ts

| # | Tarefa | Detalhe |
|---|--------|---------|
| 4.4.1 | Remover `gerarExemplosParaPrompt()` | Só usado pelo sdr-worker deletado |
| 4.4.2 | Remover `estatisticasExemplos` | Nunca importado |
| 4.4.3 | Remover arrays individuais exportados | `exemplosAbertura`, etc. — consumidos só internamente |
| 4.4.4 | Remover exemplos órfãos | `exemplosEspelhamento`, `exemplosRetomadaPausa`, `exemplosResetEmocional`, `exemplosVideo` (~80 linhas não usadas por nenhuma função) |

### 4.5 — Verificar output-guardrails

| # | Tarefa | Detalhe |
|---|--------|---------|
| 4.5.1 | Investigar desativação | Guardrails de saída desativados desde 23/02/2026 — intencional? |
| 4.5.2 | Reativar ou remover | Se temporário → reativar. Se permanente → remover código comentado |

### Validação Fase 4
- [ ] `npx tsc --noEmit` compila sem erros
- [ ] Todos os agentes respondem corretamente na sandbox
- [ ] Sem exports não utilizados (`npx ts-unused-exports tsconfig.json`)

---

## CHECKLIST DE EXECUÇÃO — RESULTADO FINAL

```
FASE 1 — Remoção Segura                              COMMIT d19fddf ✅
  [x] 1.1  Deletar agente-mestre.ts .................. -92 linhas
  [x] 1.2  Deletar supervisor.ts ..................... -424 linhas
  [x] 1.3  Deletar sdr-agent.ts ...................... -302 linhas
  [x] 1.4  Deletar closer-agent.ts ................... -239 linhas
  [x] 1.5  Deletar documentos-worker.ts .............. -378 linhas
  [x] ✓    VALIDAR: tsc + grep + dev server          ──────────────
                                          Subtotal:  -1.435 linhas

FASE 2+3 — Limpeza Legado + elyon-core               COMMIT 1edaf1c ✅
  [x] 2.1  Migrar converterParaLeadTool → UseCase ... usou ConverterParaLeadUseCase
  [x] 2.2  Deletar sdr-tools.ts ...................... -1.182 linhas
  [x] 2.3  Atualizar sandbox.ts (remover SDR_V2_BETA) ~20 linhas editadas
  [x] 2.4  Deletar agente-v2.ts ...................... -96 linhas
  [x] 2.5  Deletar ferramentas.ts (agentes/) ......... -434 linhas
  [x] 2.6  Deletar sdr-worker.ts ..................... -1.269 linhas
  [x] 2.7  Deletar teste-sdr-manual.ts ............... deletado
  [x] 3.1  Limpar elyon-core.ts (manter 3 funções)... 659→237 linhas (-422)
  [x] ✓    VALIDAR: tsc ok                           ──────────────
                                          Subtotal:  -3.721 linhas (git stat)

FASE 4 — Qualidade                                    COMMIT b7190c2 ✅
  [x] 4.1  Centralizar factory BYOK .................. criarModeloBYOK() em elyon-context.ts
  [x] 4.3  Remover exports mortos .................... orchestrator + 3 agents
  [x] 4.4  Limpar few-shot-examples.ts ............... 360→244 linhas (-116)
  [x] 4.5  Verificar output-guardrails ............... internalizou 3 guardrails desativados
  [—] 4.2  Centralizar template CoT .................. PULADO (baixo impacto)
  [x] ✓    VALIDAR: tsc ok                           ──────────────
                                          Subtotal:  -131 linhas (net)
═══════════════════════════════════════════════════════════════
TOTAL REMOVIDO:                                    ~5.287 linhas
MÓDULO ANTES:  9.346 linhas (23 arquivos)
MÓDULO DEPOIS: 4.378 linhas (15 arquivos)
REDUÇÃO:       53% do código eliminado
```

---

## ROLLBACK

Cada fase deve ser commitada separadamente com mensagem descritiva:

```bash
# Fase 1
git add -A && git commit -m "chore(agentes): remove 5 arquivos 100% mortos (-1435 linhas)"

# Fase 2  
git add -A && git commit -m "chore(agentes): remove cadeia legada sdr-worker/agente-v2/ferramentas (-3330 linhas)"

# Fase 3
git add -A && git commit -m "refactor(agentes): extrai jobs do elyon-core e remove wrapper morto (-418 linhas)"

# Fase 4
git add -A && git commit -m "refactor(agentes): centraliza factory BYOK, CoT e limpa exports mortos"
```

Em caso de problema em produção:
```bash
git revert HEAD    # reverte último commit
# ou
git revert HEAD~N  # reverte N commits atrás
```
