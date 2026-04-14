# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
[0.2.3]: https://github.com/quadradois/elyon/compare/v0.2.2...v0.2.3
[0.1.0]: https://github.com/quadradois/elyon/releases/tag/v0.1.0
