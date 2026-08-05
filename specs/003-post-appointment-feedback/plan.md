# Implementation Plan: Feedback Pós-Atendimento

**Branch**: `codex/post-appointment-feedback` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-post-appointment-feedback/spec.md`

## Summary

Estender o Copilot de Agenda para solicitar o desfecho ao especialista após o compromisso, interpretar a resposta de forma determinística, registrar o resultado pelo comando canônico da Agenda e adicionar um resumo auditável à ficha do lead. Um job idempotente cria solicitação, lembrete e pendência; o outbox existente entrega mensagens; o silêncio nunca produz no-show.

## Technical Context

**Language/Version**: TypeScript 5.3 sobre Node.js 20

**Primary Dependencies**: Express, Prisma 5.7, prom-client, Evolution/WhatsApp, date-fns

**Storage**: PostgreSQL; Redis permanece indireto na infraestrutura existente

**Testing**: Jest unitário, Jest de integração com PostgreSQL/Redis, TypeScript build e CI de migrations

**Target Platform**: Worker e API Linux em Docker Compose na VPS do ELYON

**Project Type**: Aplicação web com backend, worker e frontend React

**Performance Goals**: processar solicitações elegíveis em ciclos de até um minuto e materializar resposta na ficha em até um minuto

**Constraints**: tenant resolvido no servidor, migração aditiva, mensagens idempotentes, compatibilidade do Copilot atual, nenhuma PII em métricas/logs, rollout fail-closed

**Scale/Scope**: piloto de um tenant com desenho compatível com múltiplos tenants e milhares de compromissos

## Constitution Check

| Princípio | Decisão | Estado |
|---|---|---|
| Segurança e tenant | Solicitação, especialista, compromisso e lead sempre filtrados por tenant | PASS |
| Mudança incremental | Nova tabela e novos serviços; contratos atuais preservados | PASS |
| Evidência | Unitários, integração, replay, concorrência e quickstart | PASS |
| Main auditável | Branch e PR próprios, sem edição de código na VPS | PASS |
| Migração segura | Schema aditivo; rollback desliga gate e mantém dados inertes | PASS |
| Observabilidade/privacidade | Métricas por resultado, logs sem resumo integral e sanitização existente | PASS |

## Project Structure

### Documentation

```text
specs/003-post-appointment-feedback/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code

```text
pacotes/backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── jobs/
│   ├── observabilidade/
│   ├── servicos/
│   └── worker.ts
└── test/
    ├── contract/
    └── baseline/

pacotes/frontend/src/paginas/LeadDetalhes/
```

**Structure Decision**: Reutilizar o bounded context de Agenda no backend. A ficha já monta sua timeline a partir de atividades, portanto o resumo será uma atividade append-only do tipo NOTA vinculada ao lead, evitando criar outro endpoint de leitura no primeiro release.

## Design

1. Migração aditiva cria `FeedbackPosAtendimentoAgenda`, uma solicitação por atividade.
2. Scheduler existente executa um job por minuto para criar solicitações elegíveis, enfileirar mensagens, lembrar e escalar.
3. O inbound do Copilot resolve primeiro feedbacks aguardando resposta; convites e consultas atuais permanecem como fallback.
4. Parser determinístico reconhece desfecho e separa o restante como resumo sanitizado.
5. Serviço transacional revalida tenant, responsável, versão e estado, executa `executarComandoAgenda`, conclui a solicitação e cria NOTA na ficha.
6. Resposta ambígua não muda a Agenda; apenas pede esclarecimento.
7. O processador automático de no-show não atua no escopo em que o feedback pós-atendimento está habilitado.

## Rollout e rollback

- Gate `AGENDA_POST_FEEDBACK_ENABLED`, restrito ao mesmo tenant/cutoff do piloto.
- Deploy com gate desligado; ativação posterior no tenant piloto.
- Rollback operacional: desligar o gate. Solicitações existentes permanecem consultáveis e nenhum novo job/inbound é processado.
- A tabela não é removida no rollback da aplicação.

## Gate pós-design

O desenho mantém fonte canônica, idempotência, auditabilidade, tenant, compatibilidade e desligamento seguro. Nenhuma violação constitucional permanece.
