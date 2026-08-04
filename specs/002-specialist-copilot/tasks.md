# Tarefas — Copilot de Agenda do Especialista

## Fase 1 — Preparação

- [x] T001 Registrar variáveis do gate e janelas do Copilot em `.env.exemplo` e `pacotes/backend/src/servicos/agenda-pilot-config.ts`
- [x] T002 [P] Adicionar métricas sem PII para roteamento, intenção e decisão em `pacotes/backend/src/observabilidade/agenda-comercial-metrics.ts`
- [x] T003 [P] Criar utilitários de sanitização do contexto do especialista em `pacotes/backend/src/servicos/specialist-copilot-privacy.ts`

## Fase 2 — Fundamentos bloqueadores

- [x] T004 Modelar convites, interações e contrapropostas em `pacotes/backend/prisma/schema.prisma`
- [x] T005 Criar migração aditiva e retrocompatível em `pacotes/backend/prisma/migrations/<timestamp>_specialist_copilot/migration.sql`
- [x] T006 [P] Testar gate fail-closed e escopo por tenant em `pacotes/backend/src/servicos/__tests__/agenda-pilot-config.test.ts`
- [x] T007 [P] Testar sanitização de PII e limites em `pacotes/backend/src/servicos/__tests__/specialist-copilot-privacy.test.ts`
- [x] T008 Implementar repositório tenant-safe de contexto/convites em `pacotes/backend/src/servicos/specialist-copilot-context.ts`
- [x] T009 Implementar serviço determinístico compartilhado de decisão do especialista em `pacotes/backend/src/servicos/specialist-appointment-decision.ts`
- [x] T010 Adaptar confirmação pública para usar o serviço compartilhado em `pacotes/backend/src/rotas/leads.ts`

## Fase 3 — US1: responder ao convite pelo WhatsApp (P1)

**Teste independente**: convite contextual chega ao responsável e as respostas “confirmar” e “recusar” atualizam uma única solicitação, com lead notificado e link ainda funcional.

- [x] T011 [P] [US1] Criar testes do template contextual e fallback por link em `pacotes/backend/src/jobs/__tests__/job-confirmacao-corretor.test.ts`
- [x] T012 [P] [US1] Criar testes de parser determinístico de confirmação/recusa em `pacotes/backend/src/servicos/__tests__/specialist-copilot-intent.test.ts`
- [x] T013 [US1] Implementar parser determinístico e contrato de intenção em `pacotes/backend/src/servicos/specialist-copilot-intent.ts`
- [x] T014 [US1] Enriquecer e sanitizar o convite com lead, modalidade, imóvel e resumo em `pacotes/backend/src/jobs/job-confirmacao-corretor.ts`
- [x] T015 [US1] Persistir tentativa de convite e sincronizar campos legados em `pacotes/backend/src/jobs/job-confirmacao-corretor.ts`
- [x] T016 [US1] Implementar orquestrador de resposta confirmar/recusar em `pacotes/backend/src/servicos/specialist-copilot.ts`
- [x] T017 [US1] Inserir roteamento especialista-primeiro condicionado no inbound em `pacotes/backend/src/rotas/webhook.ts`
- [x] T018 [US1] Criar integração de webhook para confirmação, recusa e remetente não autorizado em `pacotes/backend/src/rotas/__tests__/webhook-specialist-copilot.integration.test.ts`

## Fase 4 — US2: contrapropor horário (P1)

**Teste independente**: especialista sugere horário; compromisso original não muda; somente o aceite explícito do lead, após revalidação, produz reagendamento.

- [x] T019 [P] [US2] Testar extração e validação temporal da contraproposta em `pacotes/backend/src/servicos/__tests__/specialist-copilot-intent.test.ts`
- [x] T020 [P] [US2] Testar ciclo proposta→aceite/recusa e corrida de disponibilidade em `pacotes/backend/src/servicos/__tests__/specialist-counterproposal.integration.test.ts`
- [x] T021 [US2] Persistir e consultar contrapropostas tenant-safe em `pacotes/backend/src/servicos/specialist-counterproposal.ts`
- [x] T022 [US2] Integrar verificação de disponibilidade e envio de proposta ao lead em `pacotes/backend/src/servicos/specialist-copilot.ts`
- [x] T023 [US2] Reconhecer aceite/recusa da contraproposta no fluxo atual do lead em `pacotes/backend/src/rotas/webhook.ts`
- [x] T024 [US2] Executar reagendamento atômico e invalidar contextos antigos em `pacotes/backend/src/servicos/specialist-counterproposal.ts`

## Fase 5 — US3: ambiguidade e múltiplas solicitações (P1)

**Teste independente**: uma resposta ambígua nunca altera agenda; convite único é resolvido automaticamente; ação tardia ou concorrente é rejeitada de forma coerente.

- [x] T025 [P] [US3] Testar telefone com papel duplo, múltiplos convites e tenant cruzado em `pacotes/backend/src/servicos/__tests__/specialist-copilot-context.test.ts`
- [x] T026 [P] [US3] Testar concorrência WhatsApp/link e replay de webhook em `pacotes/backend/src/rotas/__tests__/specialist-decision-concurrency.integration.test.ts`
- [x] T027 [US3] Implementar desambiguação mínima e seleção explícita de convite em `pacotes/backend/src/servicos/specialist-copilot-context.ts`
- [x] T028 [US3] Invalidar tokens e tentativas substituídas em `pacotes/backend/src/servicos/specialist-appointment-decision.ts`

## Fase 6 — US4: substituição sem gargalo (P2)

**Teste independente**: recusa, expiração ou saída do especialista tenta fallback antes de informar cancelamento ao lead.

- [x] T029 [P] [US4] Cobrir principal→fallback e ausência de substituto em `pacotes/backend/src/jobs/__tests__/fluxo-confirmacao-corretor.integration.test.ts`
- [x] T030 [US4] Migrar remanejamento para convites versionados em `pacotes/backend/src/servicos/remanejamento-corretor.ts`
- [x] T031 [US4] Tratar cancelamento de participação sem cancelar atendimento em `pacotes/backend/src/servicos/specialist-copilot.ts`
- [x] T032 [US4] Ajustar cutoff para encerrar tentativa e abrir fallback de forma idempotente em `pacotes/backend/src/jobs/job-confirmacao-corretor.ts`

## Fase 7 — US5: lembretes próximos do atendimento (P2)

**Teste independente**: compromisso confirmado dentro de T-60 envia um lembrete a cada parte; segundo ciclo, cancelamento ou reagendamento não envia duplicata obsoleta.

- [x] T033 [P] [US5] Testar janela T-60, deduplicação e invalidação em `pacotes/backend/src/jobs/__tests__/appointment-reminders.test.ts`
- [x] T034 [US5] Implementar seleção tenant-safe de compromissos elegíveis em `pacotes/backend/src/jobs/job-lembretes-agendamento.ts`
- [x] T035 [US5] Enfileirar lembretes para lead e usuário no outbox em `pacotes/backend/src/jobs/job-lembretes-agendamento.ts`
- [x] T036 [US5] Integrar job ao scheduler existente em `pacotes/backend/src/servicos/scheduler-confirmacao-corretor.ts`

## Fase 8 — US6: consultar a própria agenda (P3)

**Teste independente**: especialista consulta seus compromissos e detalhes; nenhum registro de outro usuário ou tenant é retornado.

- [x] T037 [P] [US6] Testar consultas próprias, período e negação de outro especialista em `pacotes/backend/src/servicos/__tests__/specialist-agenda-query.test.ts`
- [x] T038 [US6] Implementar consulta tenant-safe da agenda do especialista em `pacotes/backend/src/servicos/specialist-agenda-query.ts`
- [x] T039 [US6] Integrar intenção de consulta e resposta sanitizada em `pacotes/backend/src/servicos/specialist-copilot.ts`

## Fase 9 — Acabamento e validação transversal

- [x] T040 [P] Atualizar `.env.production.example`, `DEPLOY.md` e `specs/002-specialist-copilot/quickstart.md` com rollout e rollback
- [x] T041 [P] Criar testes de privacidade de logs em `pacotes/backend/src/observabilidade/__tests__/specialist-copilot-privacy.test.ts`
- [x] T042 Executar build, unitários, integração e arquitetura conforme `specs/002-specialist-copilot/quickstart.md`
- [x] T043 Executar smoke com gate desligado e registrar evidência de compatibilidade no PR
- [ ] T044 Executar smoke no tenant piloto com gate ativo e registrar métricas iniciais no PR

## Dependências

```text
Preparação -> Fundamentos -> US1 -> US3
                           -> US2 -> US3
US1 + US3 -> US4
US1 -> US5
US1 + US3 -> US6
US2 + US4 + US5 + US6 -> Acabamento
```

## Oportunidades de paralelismo

- T002 e T003 podem ocorrer em paralelo.
- T006 e T007 podem ocorrer em paralelo após o schema definido.
- Testes marcados `[P]` podem ser preparados em arquivos distintos antes da implementação correspondente.
- US5 e US6 podem avançar em paralelo depois dos fundamentos e da identidade do especialista.

## Estratégia incremental

- **MVP recomendável**: T001–T018 e T025–T028 — convite contextual, confirmar/recusar no WhatsApp, link de fallback e segurança para ambiguidade/concorrência.
- **Incremento 2**: contraproposta e fallback completo.
- **Incremento 3**: lembretes e consulta da própria agenda.
- Cada incremento deve manter o gate desligável e não remover o link.
