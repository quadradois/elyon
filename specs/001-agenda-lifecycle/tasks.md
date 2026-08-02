# Tasks: Ciclo de Vida Seguro da Agenda

**Input**: Design documents from `/specs/001-agenda-lifecycle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Obrigatórios e escritos antes da implementação das regras críticas, conforme FR-021.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode executar em paralelo por atuar em arquivos distintos e não depender de tarefa incompleta.
- **[USn]**: História de usuário rastreável na especificação.
- Todo item contém o caminho exato do arquivo principal.

## Phase 1: Setup and safety baseline

**Purpose**: Congelar o incidente real como regressão e preparar ativação reversível.

- [x] T001 Registrar a máquina de estados, corte temporal e ownership dos comandos em `docs/arquitetura/ADR-AGENDA-LIFECYCLE.md`
- [x] T002 [P] Adicionar flags `AGENDA_LIFECYCLE_POLICY_ENABLED` e `AGENDA_LIFECYCLE_COMMANDS_ENABLED` desligadas por padrão em `pacotes/backend/src/servicos/agenda-pilot-config.ts`
- [x] T003 [P] Cobrir parsing e escopo por tenant das novas flags em `pacotes/backend/src/servicos/__tests__/agenda-pilot-config.test.ts`
- [x] T004 Reproduzir em teste o cancelamento tardio do compromisso das 16:00 e exigir rejeição sem mutação em `pacotes/backend/test/baseline/agenda-commercial.integration.test.ts`
- [x] T005 [P] Criar fixture de relógio/fuso controlável para testes da Agenda em `pacotes/backend/test/helpers/agenda-clock.ts`

---

## Phase 2: Foundational policy and persistence

**Purpose**: Criar a autoridade única que bloqueia todas as histórias seguintes.

**CRITICAL**: Nenhum adaptador deve ser migrado antes deste checkpoint.

- [x] T006 Escrever testes falhos da matriz estado × fase × ator × ação, incluindo o instante exato do início, em `pacotes/backend/src/servicos/__tests__/agenda-policy.test.ts`
- [x] T007 Implementar cálculo puro de fase temporal, autorização e `allowedActions` em `pacotes/backend/src/servicos/agenda-policy.ts`
- [x] T008 [P] Definir tipos canônicos de comandos, ator, canal, códigos de motivo e rejeição em `pacotes/backend/src/servicos/agenda-command-types.ts`
- [x] T009 Escrever testes falhos de compatibilidade entre `PENDENTE` e `SOLICITADO` em `pacotes/backend/src/servicos/__tests__/agenda-state-compat.test.ts`
- [x] T010 Implementar tradução bidirecional temporária dos estados legados em `pacotes/backend/src/servicos/agenda-state-compat.ts`
- [x] T011 Criar migração Prisma expand-only para estados/índices/versão necessários em `pacotes/backend/prisma/migrations/20260801190000_agenda_lifecycle/migration.sql`
- [x] T012 Atualizar modelos e enumerações sem remover valores legados em `pacotes/backend/prisma/schema.prisma`
- [x] T013 Ampliar o ledger e a outbox para a chave idempotente e correlação canônicas em `pacotes/backend/src/servicos/coerencia-agenda-estado.ts`
- [x] T014 [P] Adicionar métricas sem PII para aceite, rejeição, conflito, replay e vencido sem desfecho em `pacotes/backend/src/observabilidade/agenda-comercial-metrics.ts`
- [x] T015 [P] Cobrir os novos contadores e rótulos permitidos em `pacotes/backend/src/observabilidade/__tests__/agenda-comercial-metrics.test.ts`

**Checkpoint**: Política pura, compatibilidade, persistência e observabilidade prontas.

---

## Phase 3: User Story 1 — Proteger ações pelo tempo (Priority: P1) — MVP

**Goal**: Nenhum canal cancela ou reagenda no instante de início ou depois.

**Independent Test**: Validar futuro, instante exato e passado via serviço, rota, agente e interface.

### Tests for User Story 1

- [x] T016 [P] [US1] Escrever testes falhos de cancelamento/reagendamento futuro, no limite e passado em `pacotes/backend/src/servicos/__tests__/coerencia-agenda-temporal.test.ts`
- [x] T017 [P] [US1] Escrever testes falhos da ferramenta do agente para `APPOINTMENT_STARTED` e conflito de versão em `pacotes/backend/src/ferramentas/__tests__/sdr-tools-agenda.test.ts`
- [x] T018 [P] [US1] Escrever testes falhos da Agenda mostrando apenas ações autorizadas em `pacotes/frontend/src/paginas/Agenda.test.tsx`

### Implementation for User Story 1

- [x] T019 [US1] Aplicar `AgendaPolicy` antes de cancelar/reagendar e retornar estado atual na rejeição em `pacotes/backend/src/servicos/coerencia-agenda-estado.ts`
- [x] T020 [US1] Substituir busca permissiva por consulta + comando central em `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- [x] T021 [US1] Expor fase, versão, ações e razões de bloqueio na leitura da Agenda em `pacotes/backend/src/rotas/agenda.ts`
- [x] T022 [US1] Atualizar cliente para consumir `allowedActions`, versão e rejeições estruturadas em `pacotes/frontend/src/servicos/apiAgenda.ts`
- [x] T023 [US1] Renderizar ações a partir de `allowedActions` e explicar bloqueios pós-início em `pacotes/frontend/src/paginas/Agenda.tsx`
- [x] T024 [US1] Executar a regressão completa da Onda 0 e documentar evidência em `specs/001-agenda-lifecycle/quickstart.md`

**Checkpoint**: MVP demonstrável com efeitos externos ainda desligados.

---

## Phase 4: User Story 2 — Um ciclo de vida em todos os canais (Priority: P1)

**Goal**: Toda escrita usa o mesmo serviço transacional, independentemente da origem.

**Independent Test**: Repetir sequências por painel, agente, link e job e obter o mesmo fato, auditoria e efeito lógico.

### Tests for User Story 2

- [x] T025 [P] [US2] Escrever testes de contrato para visão e endpoint de comandos conforme OpenAPI em `pacotes/backend/test/contract/agenda-lifecycle.contract.test.ts`
- [x] T026 [P] [US2] Escrever testes de duas transições concorrentes e replay cinco vezes em `pacotes/backend/test/baseline/agenda-commercial.integration.test.ts`
- [x] T027 [P] [US2] Criar teste arquitetural que falha com novos updates/deletes diretos de ciclo de vida em `pacotes/backend/test/architecture/agenda-writers.test.ts`

### Implementation for User Story 2

- [x] T028 [US2] Implementar envelope idempotente e dispatcher dos comandos canônicos em `pacotes/backend/src/servicos/coerencia-agenda-estado.ts`
- [x] T029 [US2] Implementar endpoint autenticado `POST /api/agenda/:id/commands` em `pacotes/backend/src/rotas/agenda.ts`
- [x] T030 [US2] Migrar aprovação, proposta e demais mutações da rota de Agenda para comandos em `pacotes/backend/src/rotas/agenda.ts`
- [x] T031 [US2] Migrar confirmação, conclusão e remoção operacionais de Lead para comandos em `pacotes/backend/src/rotas/leads.ts`
- [x] T032 [US2] Migrar processamento automático de no-show para consultar política e emitir comando idempotente em `pacotes/backend/src/servicos/processador-no-show-agenda.ts`
- [x] T033 [US2] Garantir que efeitos de WhatsApp/Calendar só sejam consumidos da outbox após commit em `pacotes/backend/src/servicos/efeitos-agenda-outbox.ts`
- [x] T034 [US2] Atualizar `apiAgenda` para o endpoint único de comandos e chaves idempotentes em `pacotes/frontend/src/servicos/apiAgenda.ts`
- [x] T035 [US2] Remover caminhos operacionais de exclusão física e oferecer ação auditada equivalente em `pacotes/frontend/src/paginas/Agenda.tsx`
- [x] T036 [P] [US2] Escrever testes falhos do link público para estado, versão, ações permitidas e rejeições em `pacotes/frontend/src/paginas/ConfirmarAgendamento.test.tsx`
- [x] T037 [US2] Migrar o link público para a visão canônica e o endpoint único de comandos em `pacotes/frontend/src/paginas/ConfirmarAgendamento.tsx`

**Checkpoint**: Zero escritores conhecidos fora do serviço central e contratos equivalentes por canal.

---

## Phase 5: User Story 3 — Encerrar e corrigir com verdade operacional (Priority: P2)

**Goal**: Classificar vencidos e corrigir erros sem apagar o histórico.

**Independent Test**: Registrar realizado/não compareceu e aplicar correção administrativa justificada, preservando todos os fatos.

### Tests for User Story 3

- [x] T038 [P] [US3] Escrever testes falhos de `REALIZAR`, `NAO_COMPARECEU` e terminalidade em `pacotes/backend/src/servicos/__tests__/agenda-outcome-commands.test.ts`
- [x] T039 [P] [US3] Escrever testes falhos de autorização, justificativa e preservação de correção em `pacotes/backend/src/servicos/__tests__/agenda-correction-command.test.ts`
- [x] T040 [P] [US3] Escrever teste da fila de vencidos e suas ações em `pacotes/frontend/src/paginas/Agenda.test.tsx`

### Implementation for User Story 3

- [x] T041 [US3] Implementar comandos de resultado e correção compensatória em `pacotes/backend/src/servicos/coerencia-agenda-estado.ts`
- [x] T042 [US3] Exigir papel administrativo e justificativa sanitizada no comando de correção em `pacotes/backend/src/rotas/agenda.ts`
- [x] T043 [US3] Expor consulta de compromissos vencidos sem desfecho e idade da pendência em `pacotes/backend/src/rotas/agenda.ts`
- [x] T044 [US3] Adicionar seção de classificação de vencidos e diálogo de correção administrativa em `pacotes/frontend/src/paginas/Agenda.tsx`

**Checkpoint**: Todo compromisso passado pode alcançar um desfecho verdadeiro sem cancelamento tardio.

---

## Phase 6: User Story 4 — Solicitação e confirmação coerentes (Priority: P2)

**Goal**: Mensagens refletem escolha do Lead, aceite do especialista e falta de responsável.

**Independent Test**: Exercitar escolha explícita, proposta, recusa/fallback e ausência total de especialista.

### Tests for User Story 4

- [x] T045 [P] [US4] Escrever testes falhos para manifestação explícita versus proposta do operador em `pacotes/backend/src/ferramentas/__tests__/sdr-tools-agenda.test.ts`
- [x] T046 [P] [US4] Escrever testes de responsável, fallback e fila sem especialista em `pacotes/backend/test/baseline/agenda-commercial.integration.test.ts`
- [x] T047 [P] [US4] Escrever testes de semântica das mensagens solicitada, pendente e confirmada em `pacotes/backend/src/servicos/__tests__/efeitos-agenda-outbox.test.ts`

### Implementation for User Story 4

- [x] T048 [US4] Registrar manifestação estruturada do Lead nos comandos de solicitar/aceitar em `pacotes/backend/src/servicos/coerencia-agenda-estado.ts`
- [x] T049 [US4] Adaptar ferramentas para não pedir segundo aceite quando o Lead escolheu o horário em `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- [x] T050 [US4] Criar pendência operacional quando não houver responsável/fallback e impedir estado confirmado em `pacotes/backend/src/servicos/coerencia-agenda-estado.ts`
- [x] T051 [US4] Gerar mensagens por fato canônico, modalidade e especialista efetivo em `pacotes/backend/src/servicos/efeitos-agenda-outbox.ts`
- [x] T052 [US4] Exibir pendências sem especialista e idade/SLA na Agenda em `pacotes/frontend/src/paginas/Agenda.tsx`

**Checkpoint**: Nenhuma mensagem promete confirmação sem os aceites e a atribuição exigidos.

---

## Phase 7: Pilot hardening and rollout

**Purpose**: Validar as Ondas 0/1 e preparar ativação segura, sem implementar a Onda 2.

- [x] T053 [P] Cobrir isolamento entre dois tenants em comandos, auditoria e outbox em `pacotes/backend/test/baseline/agenda-commercial.integration.test.ts`
- [x] T054 [P] Completar a matriz automatizada dos 40 cenários da auditoria em `pacotes/backend/test/baseline/agenda-lifecycle-matrix.integration.test.ts`
- [x] T055 [P] Validar que logs e métricas não incluem nome, telefone ou conversa em `pacotes/backend/src/observabilidade/__tests__/agenda-commercial-privacy.test.ts`
- [x] T056 [P] Criar benchmark reproduzível do comando central e registrar p50/p95/p99 em `pacotes/backend/test/performance/agenda-command.performance.test.ts`
- [x] T057 Criar dashboard/alertas para rejeições, conflitos, replay, vencidos e idade da fila em `docs/runbooks/agenda-lifecycle-observability.md`
- [x] T058 Documentar ativação por tenant, critérios de parada e rollback sem perda em `docs/runbooks/agenda-lifecycle-rollout.md`
- [ ] T059 Executar ensaio cronometrado de classificação com cinco operadores e registrar resultados em `specs/001-agenda-lifecycle/quickstart.md`
- [x] T060 Executar lint, typecheck, builds, benchmark e suítes completas e anexar comandos/resultados em `specs/001-agenda-lifecycle/quickstart.md`
- [x] T061 Auditar zero escritores diretos restantes e registrar exceções justificadas em `docs/arquitetura/ADR-AGENDA-LIFECYCLE.md`
- [ ] T062 Habilitar somente a política da Onda 0 no tenant piloto e observar a janela aprovada conforme `docs/runbooks/agenda-lifecycle-rollout.md`
- [ ] T063 Após aprovação do checkpoint, habilitar os comandos da Onda 1 no tenant piloto conforme `docs/runbooks/agenda-lifecycle-rollout.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 inicia imediatamente.
- Phase 2 depende das fixtures/flags de Phase 1 e bloqueia todas as histórias.
- US1 entrega o MVP de contenção e deve concluir antes de qualquer ativação.
- US2 depende da política de US1 e centraliza todos os escritores.
- US3 e US4 dependem do dispatcher de US2, mas seus testes e partes de UI podem avançar em paralelo.
- Phase 7 depende das histórias escolhidas para o piloto e nunca antecede os 40 cenários verdes.

### User Story Dependencies

- **US1 (P1)**: independente após a fundação; MVP obrigatório.
- **US2 (P1)**: usa a política da US1 e transforma os canais em adaptadores.
- **US3 (P2)**: usa o dispatcher da US2 para novos desfechos.
- **US4 (P2)**: usa o dispatcher da US2; pode evoluir em paralelo à US3.

### Parallel Opportunities

- T002/T003/T005 podem avançar em paralelo após T001.
- T008, T009 e T014/T015 podem avançar enquanto T006/T007 definem a política, coordenando os tipos.
- Testes marcados [P] em cada história devem ser escritos primeiro e podem avançar em paralelo.
- Após T035, US3 e US4 podem ser executadas por frentes separadas.
- T053, T054, T055 e T056 podem rodar em paralelo antes da documentação final do rollout.

## Parallel Example: User Story 3 and User Story 4

```text
Frente A: T038 -> T041 -> T042 -> T043 -> T044
Frente B: T045 + T046 + T047 -> T048 -> T049 -> T050 -> T051 -> T052
Integração: T053 -> T054 -> T060 -> T061
```

## Implementation Strategy

### MVP — Wave 0

1. T001–T015: fundação.
2. T016–T023: regra temporal em serviço, agente e tela.
3. T024: ensaio do incidente e fronteiras.
4. Parar e validar antes de ativar qualquer efeito.

### Incremental — Wave 1

1. T025–T037: centralizar todos os escritores, incluindo o link público.
2. T038–T044: desfechos e correções.
3. T045–T052: aceite e comunicação coerentes.
4. T053–T063: evidência, desempenho, piloto e expansão controlada.

## Notes

- Testes críticos devem falhar antes da implementação correspondente.
- Tarefas de produção T062/T063 exigem autorização operacional no momento da execução; não são implícitas neste plano.
- Calendar por tenant/especialista será uma feature posterior; esta entrega apenas estabelece eventos e semântica seguros.
- Não executar migrações ou testes contra produção/base compartilhada.
