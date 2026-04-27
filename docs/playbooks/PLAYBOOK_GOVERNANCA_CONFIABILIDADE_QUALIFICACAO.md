# PLAYBOOK - Governanca e Confiabilidade do Agente de Qualificacao

> Data: 2026-04-13  
> Escopo: Conversa WhatsApp -> Orquestrador -> Tools -> Persistencia no Lead/CRM  
> Objetivo: Eliminar inconsistencias de resposta, parser e preenchimento de dados.

---

## Objetivos do ciclo

- Garantir saida limpa para o cliente (sem vazamento tecnico e sem formatacao indevida).
- Garantir interpretacao correta de dados do imovel (valor != metragem).
- Garantir governanca de preenchimento (sem dados inventados no Lead).
- Garantir obediencia ao roteiro oficial (sem pulo de etapa).

---

## Ordem de prioridade

### P0 - Bloqueadores de governanca (executar primeiro)

- [x] GOV-01: Remover aspas da resposta enviada ao cliente
  - Sintoma: mensagens inteiras entre aspas (`"texto..."`).
  - Acao: ajustar camada final de renderizacao/sanitizacao para sempre enviar string limpa.
  - Criterio de aceite: 100% das mensagens de saida sem aspas wrapping.
  - Evidencia: testes `response-filters.test.ts` e `orchestrator-integration.test.ts` passando em 2026-04-13.

- [x] GOV-01B: Bloquear vazamento de raciocinio e metadados internos no texto final
  - Sintoma: resposta ao cliente vem seguida de blocos internos como `raciocinio:`, `fase:`, `pvam:` e `spin:`.
  - Acao: ampliar o sanitizador de saida para remover blocos `key: value` internos mesmo sem JSON/markdown.
  - Criterio de aceite: payload final enviado ao WhatsApp contem somente texto para o cliente.
  - Evidencia: testes `output-extraction.test.ts`, `response-filters.test.ts` e `orchestrator-integration.test.ts` passando em 2026-04-13.

- [x] GOV-01C: Blindagem de linguagem na saida final (anti-deriva conversacional)
  - Sintoma: respostas com preambulo confuso (`pergunto porque`), girias inadequadas (`putz`) e assuncoes sem evidencia (`voce esta chateado`, `imovel parado`).
  - Acao: aplicar guardrail pos-sanitizacao no `response-filters` com rewrite seguro baseado na ultima mensagem do lead.
  - Criterio de aceite: saida final evita frases proibidas e reduz suposicoes sem evidencia textual.
  - Evidencia 2026-04-13: novos casos em `response-filters.test.ts` cobrindo preambulo, giria e assuncao sem evidencia; suite passando.

- [x] GOV-02: Blindar parser de `valorPretendido` x `areaImovel` em todo pipeline
  - Sintoma: `R$ 350 mil` sendo salvo/interpretado como `350m2`.
  - Acao: reforcar normalizacao em parser, estado, tools e usecases de persistencia.
  - Criterio de aceite: entradas monetarias nunca preenchem area; quando ambiguo, fica pendente e pergunta de confirmacao e feita.
  - Evidencia: ajuste no parser de metragem (bloqueio de `m` dentro de `mil/meses`) + regressao para `350mil`, `R$ 350.000` e `3 meses` em `conversation-state.test.ts` passando em 2026-04-13.

- [x] GOV-03: Bloquear preenchimento fantasma na pagina do Lead
  - Sintoma: campos nao citados na conversa sendo preenchidos com valores padrao inferidos.
  - Acao: regra de verdade explicita por campo (somente `mensagem_usuario`, `tool_confirmada` ou `confirmacao_explicita`).
  - Criterio de aceite: campos sem evidencia ficam `nao informado`/`null`.
  - Evidencia 2026-04-13: parser `valor x area` blindado no pipeline + trilha `source_of_truth` ativa em `converter_para_lead` e `qualificar_lead` via `schemaState.fieldSources`.
  - GOV-03B concluido (2026-04-13): `temDividas` e `comCorretorAtualmente` exigem evidencia textual explicita para persistir no `qualificar_lead`; sem evidencia, o valor e ignorado (fail-safe para `null`).

- [x] GOV-04: Politica global de `UNKNOWN`/`null` para dados nao coletados
  - Sintoma: inferencia silenciosa em campos sensiveis (dividas, prazo, urgencia, corretor etc).
  - Acao: aplicar contrato unico de ausencia de dado em todos os mapeamentos para CRM/UI.
  - Criterio de aceite: nenhum campo sensivel recebe valor default sem evidencia textual.
  - Evidencia 2026-04-13: `timeline` deixou de ser obrigatorio nas tools de qualificacao/conversao; `prazoDesejado/urgencia` so persistem com marcador temporal confiavel; sem marcador, permanecem `null/undefined` (sem default `BAIXA`).
  - GOV-04B concluido (2026-04-13): `pressaoTempo` e `interesseAvaliacao` exigem evidencia textual explicita no `qualificar_lead`; sem evidencia, os campos nao sao persistidos.
  - Governanca centralizada (2026-04-13): regras comuns extraidas para `governanca-campos.ts` com regressao dedicada (`governanca-campos.test.ts`).

- [x] GOV-05: Regressao E2E com caso real (Ivonet)
  - Sintoma: comportamento inconsistente em conversa real.
  - Acao: criar teste de regressao com transcript real cobrindo os defeitos reportados.
  - Criterio de aceite: fluxo aprovado com saida limpa, sem troca valor/area e sem campos inventados.
  - Evidencia 2026-04-13: teste `gov-05-ivonet-regression.e2e.test.ts` cobrindo limpeza de resposta, correcao `valor x area` e bloqueio de campos fantasmas.

### P1 - Controle de fluxo e fonte da verdade

- [x] GOV-06: Definir e consolidar a fonte unica de verdade do roteiro
  - Acao: centralizar etapas, perguntas obrigatorias, criterios de avancar/nao avancar em um unico artefato.
  - Criterio de aceite: todo componente consulta o mesmo contrato de roteiro.
  - Progresso 2026-04-13 (GOV-06A):
    - Removidas instrucoes conflitantes de tool/checklist no `input-builder` que forçavam fluxo fora da fase.
    - Alinhado `shared-behavioral-guardrails` para matriz de prioridade sem override de fase/handoff.
    - Skill `presenter/escalation-trigger-matrix` atualizada para agendamento governado (sem salto automatico de fase).
    - Corrigida instrucao de IDs no `sdr-agent` (`mover_para_fase` agora orienta `leadId`, nao `contatoId`).
    - Ajustado gatilho regex de escalation no classificador para reduzir falsos positivos ("pode ser").
    - Evidencia: testes `input-builder.test.ts`, `shared-behavioral-guardrails.test.ts`, `skills-system.test.ts` e `gov-05-ivonet-regression.e2e.test.ts` passando em 2026-04-13 com heap 4GB.
  - Progresso 2026-04-13 (GOV-06B):
    - Contrato unico de fases centralizado em `src/agentes/roteiro-governanca.ts` (`ROTEIRO_SDR_FASES_V1@2026-04-13-GOV06B`).
    - `sdr-agent.ts` passou a consumir o mesmo contrato para:
      - bloco de regras de progressao exibido no prompt;
      - enum de fases do structured output (`z.enum`).
    - `input-builder.ts` e `shared-behavioral-guardrails.ts` passaram a referenciar a mesma instrucao de governanca (fonte unica).
    - Evidencia: testes `input-builder.test.ts`, `shared-behavioral-guardrails.test.ts`, `agent-factories.test.ts`, `skills-system.test.ts` e `gov-05-ivonet-regression.e2e.test.ts` passando em 2026-04-13.
  - Progresso 2026-04-13 (GOV-06C):
    - Fonte unica expandida com contrato de perguntas obrigatorias por fase em `src/agentes/roteiro-governanca.ts` (`renderPerguntasObrigatoriasMarkdown`).
    - Prompt do SDR atualizado para consumir contrato de perguntas por fase e remover exemplos legados que induziam comportamento inadequado.
    - Gatilho automatico `opener/tratativa-varios-corretores` restringido para reduzir ativacao fora de contexto (nao dispara mais apenas por `poucas visitas`).
    - Skill `presenter/spin-diagnostico` ajustada para pergunta curta direta (sem regra fixa de `pergunto porque`).
    - Skill `presenter/pitch-rede-parceiros` reforcada com contorno da objecao: "isso toda imobiliaria faz".
    - Evidencia: `test:governanca:release` (11 suites / 202 testes) + build TypeScript passando em 2026-04-13.
  - Status: CONCLUIDO (GOV-06A, GOV-06B e GOV-06C consolidados na fonte unica de governanca).

- [x] GOV-07: Implementar gate de etapa (state machine)
  - Acao: impedir pulo de fase sem requisitos minimos da fase atual.
  - Criterio de aceite: avancos de fase so acontecem com pre-condicoes satisfeitas.
  - Evidencia 2026-04-13:
    - Gate de transicao sequencial implementado em `mover-para-fase.usecase.ts` (bloqueia salto para frente > 1 etapa).
    - Gate retorna `reasonCode=PHASE_TRANSITION_BLOCKED` com `gateDetalhes` para orientar proxima acao do agente.
    - `tool-wrapper.ts` atualizado para enriquecer bloqueio de fase com instrucao objetiva ao agente.
    - Testes: `mover-para-fase.usecase.test.ts` (novo cenario `NOVO -> FASE3` bloqueado), `orchestrator-integration.test.ts` e `gov-05-ivonet-regression.e2e.test.ts` passando.

- [x] GOV-08: Registrar proveniencia por campo salvo
  - Acao: armazenar `source_of_truth` por campo (`mensagem_usuario`, `inferido`, `manual`, `tool`).
  - Criterio de aceite: auditoria consegue explicar origem de cada valor no Lead.
  - Evidencia 2026-04-13:
    - Persistencia da trilha por campo em `schemaState.fieldSources` e `lastSourceUpdateAt` no fluxo SDR (`converter_para_lead` e `qualificar_lead`).
    - Endpoint `GET /api/leads/:id` passou a expor bloco `governanca.sourceOfTruth` com trilha por campo, evidencia e timestamp.
    - Helper unico em `agentes/governanca-qualificacao.ts` para faltantes criticos e leitura da trilha.
    - Testes: `governanca-qualificacao.test.ts` passando.

### P2 - Observabilidade e operacao continua

- [x] GOV-09: Observabilidade de decisao do agente
  - Acao: logs estruturados para decisao de pergunta, mudanca de fase e escrita de campo.
  - Criterio de aceite: trilha de decisao consultavel por conversa.
  - Evidencia 2026-04-13:
    - Logs estruturados no `mover-para-fase.usecase.ts` para inicio, bloqueio por gate de transicao, bloqueio por gate SPIN, sucesso e erro (`[GOV-09]`).
    - Endpoint `GET /api/metricas-agentes/governanca/trilha` implementado com timeline consolidada por lead (`tool_exec`, fase/status, mensagens e `source_of_truth_update`).
    - Testes: `metricas-agentes.test.ts` (rota de trilha) e `mover-para-fase.usecase.test.ts` passando.
  - Status: CONCLUIDO.

- [x] GOV-10: Checklist de release de governanca
  - Acao: gate pre-deploy com testes criticos, validacao manual amostral e rollback definido.
  - Criterio de aceite: deploy so acontece com checklist completo.
  - Evidencia 2026-04-13:
    - Script de gate criado em `pacotes/backend/scripts/gov-release-gate.sh` (modo `quick` e `--full`).
    - Atalhos de execucao adicionados no `package.json`: `test:governanca:release` e `test:governanca:release:full`.
    - Gate inclui: suite critica de governanca + build TypeScript + checklist manual obrigatorio (amostra real, trilha endpoint e rollback).
    - Execucao validada: `npm -C /root/elyon/pacotes/backend run test:governanca:release` -> 11 suites / 202 testes passando + build OK.
    - Validacoes tecnicas adicionais:
      - `GET /api/leads/:id` validado com teste dedicado `leads.governanca.test.ts` (bloco `governanca` com `sourceOfTruth` e faltantes).
      - `GET /api/metricas-agentes/governanca/trilha` validado em `metricas-agentes.test.ts`.
    - Rollback referencia (repo atual):
      - Branch: `master`
      - HEAD: `5f583bb`
    - Comando de retorno rapido (sem push): `git checkout d4c7f09` (modo diagnostico)
    - Comando de retorno de branch (somente com aprovacao): `git reset --hard d4c7f09`

- [x] GOV-11: Plano de follow-up fim a fim (prospeccao + atendimento)
  - Acao:
    - Cadencia de prospeccao ativa refinada no motor de disparo:
      - 1o follow-up: 2 horas apos primeira mensagem sem resposta
      - 2o follow-up: 24 horas apos o primeiro follow-up
      - tentativas adicionais: janela padrao por dias (configuravel)
    - Mensagens de follow-up mais curtas e profissionais nos templates.
    - Governanca de atendimento conversacional mantida com `agendar_followup` (recontato com data combinada).
  - Criterio de aceite:
    - follow-up inicial rapido sem depender do agente;
    - sem spam (janelas controladas por tentativa);
    - mensagens objetivas e humanizadas.
  - Evidencia 2026-04-14:
    - `servicos/disparo-campanha.ts` com janelas por tentativa + parametros configuraveis;
    - `agentes/templates-prospeccao.ts` atualizado com textos curtos de follow-up.

---

## Checklist de implementacao por frentes

### Frente A - Resposta ao cliente

- [x] Revisar serializacao final de resposta.
- [x] Garantir remove de wrappers (`"..."`, blocos JSON, metadados internos).
- [x] Garantir remocao de sufixos textuais internos (`raciocinio:`, `fase:`, `pvam:`, `spin:`) em qualquer formato.
- [x] Adicionar teste unitario para formato final de mensagem.

### Frente B - Extracao e normalizacao de dados

- [x] Revisar extratores de valor, area e unidades (`m2`, `mil`, `R$`).
- [ ] Reforcar validacao semantica antes de persistir.
- [x] Adicionar casos de teste para ambiguidades comuns.

### Frente C - Persistencia e CRM

- [ ] Revisar mapeamento contato/lead para impedir defaults silenciosos.
- [ ] Aplicar politica `null/nao informado` em campos sem evidencia.
- [ ] Validar exibicao na UI com dados realmente coletados.

### Frente D - Roteiro e governanca de fase

- [x] Mapear roteiro oficial vigente e comparar com comportamento atual.
- [x] Consolidar contrato unico de fases e instrucao de governanca compartilhada (GOV-06B).
- [x] Implementar travas de progresso por etapa.
- [x] Criar testes de contrato do roteiro (nao pular etapas obrigatorias).

---

## Criterios de aceite global

- [x] Nenhuma resposta enviada ao cliente chega com aspas wrapping.
- [x] Nenhuma resposta enviada ao cliente vaza `raciocinio`, `fase`, `pvam` ou `spin`.
- [x] Nenhum valor monetario e salvo como metragem.
- [x] Nenhum campo de Lead e preenchido sem evidencia explicita.
- [x] Fluxo respeita ordem de etapa definida no roteiro oficial.
- [x] Suite de regressao com conversa real passa em ambiente de CI.

---

## Evidencias minimas de validacao

- [x] Testes unitarios atualizados para filtro de resposta e parser.
- [x] Testes de usecase cobrindo persistencia sem dados fantasmas.
- [x] Teste de integracao/orquestrador cobrindo gate de fase.
- [ ] Capturas de tela comparativas antes/depois na pagina do Lead.

### Comando padrao de regressao (release)

```bash
npm -C /root/elyon/pacotes/backend run test:governanca:release
```

- Full gate (opcional pré-produção):

```bash
npm -C /root/elyon/pacotes/backend run test:governanca:release:full
```

---

## Status de execucao

- [x] P0 concluido
- [x] P1 concluido
- [x] P2 concluido
- [ ] Pronto para deploy
