# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.3.0] - 2026-04-14

### Adicionado
- **SDR Agent unificado** (`sdr-agent.ts`) — fusão do Opener + Presenter em um único agente com fases internas progressivas (MEIO_CAMPO → DESCOBERTA → DIAGNOSTICO_SPIN → PITCH → AGENDAMENTO → FOLLOW_UP / RECUO).
- **Roteiro de governança centralizado** (`roteiro-governanca.ts`) — contrato único de fases (`ROTEIRO_SDR_FASES_V1`), regras de avanço, tools permitidas por fase e perguntas obrigatórias. Fonte única de verdade consumida pelo SDR, input-builder e guardrails.
- **Governança de qualificação** (`governanca-qualificacao.ts`) — validação de campos críticos faltantes e rastreio de `fieldSources` (evidência textual obrigatória para persistir dados sensíveis).
- **Sanitizador de resposta** (`client-response-sanitizer.ts`) — remove aspas envolventes, vazamento de metadados internos e blocos técnicos da saída final enviada ao WhatsApp.
- **Tool Wrapper com pré-validação e auditoria** (`tool-wrapper.ts`) — wrapper genérico para tools do OpenAI Agents SDK com pré-validação de args, enriquecimento de resultado e log JSON estruturado.
- **Sanitização centralizada de inputs LLM** (`tool-sanitize.ts`) — normalização de tipos vindos de tool calls (string→number, ""→undefined, "true"→boolean).
- **Integração Google Calendar + Meet** (`google-calendar.ts`) — serviço via Service Account para consultar slots livres, criar eventos reais com Google Meet automático e gerar link público de agendamento.
- **Sistema de auditoria** (`servico-auditoria.ts` + `admin-auditoria.ts`) — registro assíncrono de ações em `LogAuditoria` com rota paginada para SUPER_ADMIN.
- **Gate de transição de fase** (GOV-07) — `mover-para-fase.usecase.ts` bloqueia salto de fase >1 etapa, retornando `PHASE_TRANSITION_BLOCKED`.
- **Migration** para tabela `LogAuditoria`, índice de rastreamento proprietário-imóvel e índice composto `leads_tenant_statusAtualizado`.
- **Testes de regressão** — suítes de governança (GOV-01 a GOV-07), classificador de objeções, BYOK resolver, sentiment analyzer, skills system, structured output E2E.
- **Tela de auditoria** no frontend admin (`AdminAuditoria.tsx`).

### Melhorado
- Blindagem valor × área (GOV-02) — parser de metragem bloqueia `m` dentro de `mil/meses`; entradas monetárias nunca preenchem `areaImovel`.
- Blindagem de linguagem na saída final (GOV-01C) — guardrail pós-sanitização reescreve frases proibidas.
- Skills SDR atualizadas — `spin-diagnostico` com pergunta curta direta; `pitch-rede-parceiros` com contorno de objeção; nova skill `tratativa-sem-aceite-agendamento`.

### Alterado
- **Cadeia de agentes** de `OPENER → PRESENTER → ADMIN` (3 agentes, 8 gates) para **`SDR → ADMIN`** (2 agentes, 1 handoff). `TipoAgente` agora é `'SDR' | 'ADMIN'`.
- **Structured Output unificado** — 2 schemas separados (PVAM + SPIN) consolidados em 1 (`SdrOutputSchema`).
- **Prompt em 5 camadas** — merge dos prompts Opener + Presenter em prompt unificado (~500 linhas).

### Corrigido
- GOV-01: Aspas envolventes removidas na camada final de renderização.
- GOV-01B: Blocos `raciocinio:`, `fase:`, `pvam:`, `spin:` não vazam mais no WhatsApp.
- GOV-03: Campos não citados na conversa não são mais preenchidos com valores default inferidos (`source_of_truth` + `fieldSources`).
- GOV-03B: `temDividas` e `comCorretorAtualmente` exigem evidência textual explícita; sem evidência → `null`.
- GOV-04: Política global de `UNKNOWN`/`null` para dados não coletados; `timeline` não mais obrigatório.
- GOV-06A: Removidas instruções conflitantes de tool/checklist no `input-builder`; regex de escalation ajustado.

### Removido
- `opener-agent.ts` — substituído por `sdr-agent.ts`.
- `presenter-agent.ts` — substituído por `sdr-agent.ts`.
- `templates-agentes.ts` — templates legados removidos (prompt gerado inline no SDR).
- `few-shot-examples.ts` — exemplos few-shot legados substituídos por CoT unificado + skills.
- `output-guardrails.ts` — substituído por `client-response-sanitizer.ts` + `response-filters.ts`.
- `agendar-avaliacao.usecase.ts` e `buscar-imovel.usecase.ts` — use cases legados removidos.
- Arquivos de workflow `.agent/tasks/` e `.agent/workflows/` removidos.

### Refatorado
- Eliminação de ~600 linhas de cola de handoff Opener↔Presenter. Latência de handoff (~200-400ms por transição) eliminada.
- Governança centralizada em `governanca-campos.ts` com regressão dedicada. `shared-behavioral-guardrails.ts` e `input-builder.ts` referenciam fonte única.

## [0.2.3] - 2026-04-14

### Melhorado
- Cadência de follow-up de prospecção ativa refinada para maior velocidade comercial:
  - 1º follow-up em **2 horas** após a primeira mensagem sem resposta.
  - 2º follow-up em **24 horas** após o primeiro follow-up.
  - Tentativas adicionais mantidas com janela em dias (configurável).
- Motor de disparo atualizado com parâmetros configuráveis por campanha para janelas de follow-up:
  - `horasEntrePrimeiroFollowup`
  - `horasEntreSegundoFollowup`
  - `diasEntreTentativas`

### Alterado
- Templates de follow-up ajustados para mensagens mais curtas e objetivas no WhatsApp.

### Adicionado
- Teste dedicado da cadência de follow-up em `disparo-campanha.followup.test.ts` para evitar regressões.

## [0.2.2] - 2026-03-04

### Refatorado
- Conclusão da refatoração incremental do `orchestrator` com extração de responsabilidades para módulos dedicados:
  - `response-filters`, `history-persistence`, `output-extraction`
  - `input-builder`, `context-builder`, `agent-runner`
  - `post-handoff`, `orchestrator-metrics`, `agent-resolution`
  - `entry-guardrail`, `persisted-agent`
- `orchestrator.ts` ficou mais enxuto, com delegação explícita por etapa (guardrail, roteamento, execução, pós-processamento, métricas).

### Adicionado
- Novas suítes de testes unitários para os módulos extraídos:
  - `response-filters`, `history-persistence`, `output-extraction`
  - `input-builder`, `context-builder`, `agent-runner`
  - `post-handoff`, `orchestrator-metrics`, `agent-resolution`
  - `entry-guardrail`, `persisted-agent`

### Validado
- Execução consolidada de testes em `src/agentes/__tests__` com **27 suítes aprovadas** e **361 testes passando** ao final da refatoração.

## [0.2.1] - 2026-03-04

### Adicionado
- **11 novas suítes de testes** para casos de uso críticos dos agentes e para o módulo de manutenção `elyon-core`.
- Cobertura de cenários de sucesso, validação, fallback e erro para os fluxos:
  - `qualificar-lead`, `converter-para-lead`, `mover-para-fase`, `salvar-dados-imovel`
  - `atualizar-dados-lead`, `agendar-avaliacao`, `agendar-followup`, `encaminhar-corretor`
  - `registrar-optout`, `buscar-imovel`, `elyon-core`

### Melhorado
- Cobertura consolidada de módulos `agentes` + `casos-de-uso/agentes` para:
  - **92.5%** statements
  - **81.43%** branches
  - **86.61%** functions
  - **93.36%** lines
- `elyon-core.ts` evoluiu de **0%** para **96.82% statements** e **96.77% lines**.

## [0.2.0] - 2026-03-04

### Adicionado
- **317 testes automatizados** cobrindo 15 suítes (86.2% de cobertura)
  - Testes unitários: conversation-state, agent-chain, guardrails, output-guardrails, handoff-filters, few-shot-examples, knowledge-agent, conversation-cache, orchestrator-queries, templates-agentes, templates-prospeccao, agent-factories
  - Testes de integração: orchestrator-integration (fluxo conversacional multi-turn)
  - Testes de cascade-delete e tenant isolation
- **Pipeline CI** com GitHub Actions (`ci-backend.yml`)
  - Build TypeScript, testes automatizados, cobertura mínima 80%
  - Disparo automático em push/PR para `main`
- **Gate de cobertura** no jest.config.js (80% statements/lines, 65% branches, 70% funções)

### Corrigido
- **12 pontos de fricção** no sistema de agentes IA (F1-F12):
  - F1+F12: Handoff bidirecional Presenter↔Opener + Admin suporte FASE 3
  - F2+F10: Reativação de guardrails recalibrados, knowledge agent BYOK
  - F3: Prompt do Closer alinhado com fluxo real
  - F4: Exemplos few-shot atualizados com formato correto
  - F5: Output guardrail sem bloquear respostas legítimas
  - F6: Remoção de buscarTaticaCaptacaoTool redundante (dead code)
  - F7+F8: Handoff Qualifier→Presenter com contexto imóvel
  - F9: Handoff bidirecional Opener↔Admin
  - F11: Filtro de handoff mais restritivo
- Bug no `handoff-filters.ts`: condição de filtro invertida corrigida

### Removido
- **~9.124 linhas de código morto** eliminadas em 10 commits de limpeza:
  - Agentes duplicados e funções obsoletas em `src/agentes/`
  - Rotas mortas e serviços sem uso em `src/rotas/` e `src/servicos/`
  - Ferramentas e scripts não referenciados
  - Deduplicação de lógica repetida entre módulos

### Refatorado
- Orchestrator extraído em 3 módulos SRP: conversation-state, agent-chain, orchestrator-queries
- Templates de agentes reorganizados por responsabilidade

## [0.1.0] - 2025-12-01

### Adicionado
- Estrutura inicial do monorepo (npm workspaces + Turbo)
- Sistema multi-agente com OpenAI Agents SDK (Opener, Closer, Presenter, Qualifier, Admin, Knowledge)
- Integração WhatsApp via Evolution API
- Sistema RAG com embeddings e busca vetorial
- Gestão de campanhas e captação de imóveis
- Sistema de upload e gestão de documentos
- Mineração de leads e interface de captação
- Cache de conversas com Redis
- Prisma ORM com PostgreSQL
- Autenticação multi-tenant

[0.2.0]: https://github.com/quadradois/elyon/compare/v0.1.0...v0.2.0
[0.2.1]: https://github.com/quadradois/elyon/compare/v0.2.0...v0.2.1
[0.2.2]: https://github.com/quadradois/elyon/compare/v0.2.1...v0.2.2
[0.3.0]: https://github.com/quadradois/elyon/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/quadradois/elyon/compare/v0.2.2...v0.2.3
[0.1.0]: https://github.com/quadradois/elyon/releases/tag/v0.1.0
