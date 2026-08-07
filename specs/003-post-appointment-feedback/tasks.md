# Tasks: Feedback Pós-Atendimento

## Phase 1 — Setup

- [x] T001 Add additive Prisma model and migration in `pacotes/backend/prisma/schema.prisma` and `pacotes/backend/prisma/migrations/*_post_appointment_feedback/migration.sql`
- [x] T002 Add rollout configuration and metrics in `pacotes/backend/src/servicos/agenda-lifecycle-rollout.ts`, `pacotes/backend/src/servicos/agenda-pilot-config.ts`, and `pacotes/backend/src/observabilidade/agenda-comercial-metrics.ts`

## Phase 2 — Foundational

- [x] T003 Implement feedback timing, message template, and deterministic intent parser with unit tests in `pacotes/backend/src/servicos/post-appointment-feedback.ts` and `pacotes/backend/src/servicos/__tests__/post-appointment-feedback.test.ts`
- [x] T004 Implement idempotent feedback job and scheduler integration with tests in `pacotes/backend/src/jobs/job-post-appointment-feedback.ts`, `pacotes/backend/src/jobs/__tests__/job-post-appointment-feedback.test.ts`, and `pacotes/backend/src/servicos/scheduler-confirmacao-corretor.ts`

## Phase 3 — User Story 1: WhatsApp outcome

- [x] T005 [US1] Extend specialist context resolution for actionable feedback in `pacotes/backend/src/servicos/specialist-copilot-context.ts`
- [x] T006 [US1] Implement transactional feedback response application in `pacotes/backend/src/servicos/post-appointment-feedback-response.ts`
- [x] T007 [US1] Route feedback before invitation intents with replay and ambiguity handling in `pacotes/backend/src/servicos/specialist-copilot.ts`
- [x] T008 [US1] Add inbound, concurrency, tenant, and replay tests in `pacotes/backend/src/rotas/__tests__/webhook-specialist-copilot.integration.test.ts` and `pacotes/backend/test/contract/agenda-lifecycle.contract.test.ts`

## Phase 4 — User Story 2: Lead record

- [x] T009 [US2] Persist an append-only sanitized lead note with outcome metadata in `pacotes/backend/src/servicos/post-appointment-feedback-response.ts`
- [x] T010 [US2] Verify note visibility and no overwrite in lead detail contract tests in `pacotes/backend/test/contract/agenda-lifecycle.contract.test.ts`

## Phase 5 — User Story 3: No response

- [x] T011 [US3] Implement one reminder and manager-pending transition in `pacotes/backend/src/jobs/job-post-appointment-feedback.ts`
- [x] T012 [US3] Prevent automatic no-show in feedback-enabled scope in `pacotes/backend/src/worker.ts` and `pacotes/backend/src/servicos/processador-no-show-agenda.ts`
- [x] T013 [US3] Expose feedback pending items in the existing Agenda operational queue in `pacotes/backend/src/rotas/agenda.ts` and `pacotes/frontend/src/servicos/apiAgenda.ts`
- [x] T014 [US3] Add job timing, invalidation, reminder, and silence regression tests in `pacotes/backend/src/jobs/__tests__/job-post-appointment-feedback.test.ts`

## Phase 6 — Polish

- [x] T015 Document environment flags and rollout in `.env.exemplo`, `docker-compose.yml`, and `docs/operacao/FEEDBACK_POS_ATENDIMENTO.md`
- [ ] T016 Run Prisma generate, backend build, targeted unit/integration suites, architecture gate, migration validation, and `git diff --check` (unit, build, architecture, Prisma and diff passed; the database-backed contract suite awaits the dedicated `elyon_integration` database)

## Dependencies

- T001–T004 block all user stories.
- US1 (T005–T008) precedes US2 because the lead note is committed with a valid outcome.
- US3 can follow foundational work but must be validated after US1 to prove late replies conclude pending items.

## Independent tests

- **US1**: one eligible call, one WhatsApp response, one canonical outcome.
- **US2**: a valid response creates one visible append-only lead note.
- **US3**: silence produces one reminder and one manager pending item, never no-show.

## MVP

T001–T010 deliver the first safe slice. T011–T015 complete operational resilience before pilot activation.
