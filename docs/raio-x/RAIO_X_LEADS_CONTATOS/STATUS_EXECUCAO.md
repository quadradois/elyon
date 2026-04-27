# Status de Execução — Leads & Contatos

Atualize este arquivo diariamente durante a sprint.

## Painel resumido

| Tarefa | Título | Owner | Status | Início | Fim | Risco | Evidência |
|---|---|---|---|---|---|---|---|
| T01 | Foundation DB/Webhook | Backend 1 (sugerido) | DONE | 2026-04-27 | 2026-04-27 | Alto (dados + webhook) | migrations aplicadas + cenários B/C/D validados em staging |
| T02 | API Proprietários | Backend 2 (sugerido) | DONE | 2026-04-28 | 2026-04-29 | Médio (contrato API) | rota + servidor + build |
| T03 | Página Proprietários | Frontend 1 (sugerido) | DONE | 2026-04-29 | 2026-04-30 | Médio (UX + paginação) | hook + página + build |
| T04 | Detalhe Proprietário | Frontend 2 (sugerido) | DONE | 2026-04-30 | 2026-05-01 | Médio (integração de abas) | página + hook + build |
| T05 | Sidebar & Rotas | Frontend 1 (sugerido) | DONE | 2026-05-01 | 2026-05-01 | Médio (redirects) | menu + redirects + grep |
| T06 | Cleanup/Deprecação | Backend 1 + Frontend 2 (sugerido) | DONE | 2026-05-01 | 2026-05-01 | Alto (migração status) | migration + limpeza + grep |
| T07 | Validação Regressão SDR | QA/Tech Lead (sugerido) | DONE | 2026-04-27 | 2026-04-27 | Alto (core do negócio) | webhook B/C/D + redirects + smoke staging |

Status válidos: `TODO` | `IN_PROGRESS` | `BLOCKED` | `DONE`

## Cronograma sugerido (5 dias úteis)

### Dia 1 — 2026-04-27 (segunda)
- T01: iniciar P1 (query do webhook) e validar cenário C.
- Preparar janela de migration em staging para P2/P3.

### Dia 2 — 2026-04-28 (terça)
- T01: concluir P2/P3 e validar cenários B e D.
- T02: iniciar `GET /api/proprietarios` e `GET /api/proprietarios/:id`.

### Dia 3 — 2026-04-29 (quarta)
- T02: concluir `POST /api/proprietarios` + registro em servidor.
- T03: iniciar `useProprietarios` + view Lista.

### Dia 4 — 2026-04-30 (quinta)
- T03: concluir Kanban paginado por coluna.
- T04: iniciar layout base + tabs contextuais.

### Dia 5 — 2026-05-01 (sexta)
- T04: finalizar integração de abas e ações críticas.
- T05: aplicar reorganização do sidebar + redirects.
- T06: executar cleanup controlado e deprecações.
- T07: regressão completa SDR + relatório final (passou/falhou/observação).

## Diário de execução

### 2026-04-27

- Situação geral: planejamento inicial estruturado.
- Decisões tomadas:
  - Sequência oficial de execução definida em `EXECUCAO_SPRINT.md`.
  - Controle operacional centralizado neste arquivo.
  - Owners sugeridos por papel definidos para acelerar kickoff.
  - Cronograma base de 5 dias úteis definido (27/04/2026 a 01/05/2026).
  - T01 iniciada com implementação de P1, P2 e P3 no backend.
- Bloqueios:
  - Janela para execução das migrations em staging.
- Próximo passo:
  - Consolidar entrega com commit único e tag de checkpoint em staging.
  - Seguir monitorando logs do webhook e dashboard de proprietários.
  - Planejar próxima iteração de hardening (testes automatizados E2E de regressão SDR).

### 2026-04-27 — Fechamento staging

- Staging estabilizado com backend/frontend rebuild + redeploy.
- Migrations aplicadas com sucesso:
  - `20260427170500_add_campanha_opcional_contato`
  - `20260427184000_cleanup_statuslead_deprecated`
- Cenários webhook validados:
  - B: contato sem campanha -> `sem_campanha_vinculada` e inbound ignorado.
  - C: mesmo telefone em 2 campanhas -> seleção correta do contato `CONTATANDO`.
  - D: duplicidade telefone com `campanhaId null` + preenchido permitida.
- Redirects legados e smoke de telas validados (sem 404):
  - `/dashboard/leads`, `/dashboard/leads/:id`, `/dashboard/captacao`, `/dashboard/campanhas/:campanhaId/contatos/:contatoId`
  - `/dashboard/proprietarios`, `/dashboard/campanhas`, `/dashboard/agenda`
- Correção adicional concluída pós-validação:
  - filtro `estagio=Qualificado` em `/api/proprietarios` ajustado para enum atual.

## Registro de bloqueios

| Data | Tarefa | Bloqueio | Impacto | Responsável destrave | ETA |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

## Evidências por tarefa

Preencha com links internos (PR, commit, logs, prints, query result).

- T01:
  - `pacotes/backend/src/rotas/webhook.ts` atualizado (P1 + P3)
  - `pacotes/backend/prisma/schema.prisma` atualizado (`campanhaId` opcional)
  - Migration criada: `pacotes/backend/prisma/migrations/20260427170500_add_campanha_opcional_contato/migration.sql`
  - Validação local: `npx prisma validate` (OK)
  - Build local: `npm run build` no backend (OK)
- T02:
  - `pacotes/backend/src/rotas/proprietarios.ts` criado com `GET /`, `GET /:id`, `POST /`
  - `pacotes/backend/src/servidor.ts` registrando `app.use('/api/proprietarios', rotaProprietarios)`
  - Build backend (OK)
- T03:
  - `pacotes/frontend/src/ganchos/useProprietarios.ts` criado
  - `pacotes/frontend/src/paginas/Proprietarios.tsx` criado (lista + kanban paginado por coluna)
  - Build frontend (OK)
- T04:
  - `pacotes/frontend/src/paginas/ProprietarioDetalhes/index.tsx` criado
  - `pacotes/frontend/src/paginas/ProprietarioDetalhes/hooks/useProprietarioDetalhes.ts` criado
  - Reuso de componentes de `LeadDetalhes` nas abas contextuais
- T05:
  - `pacotes/frontend/src/layouts/LayoutDashboard.tsx` reorganizado (Captação/Funil/Gestão/Config)
  - `pacotes/frontend/src/App.tsx` com redirects: leads/captacao/contatos aninhados
  - `grep` de `/dashboard/leads` ficou restrito ao próprio `App.tsx` (rotas de redirect)
- T06:
  - `pacotes/backend/prisma/migrations/20260427184000_cleanup_statuslead_deprecated/migration.sql` criado
  - `pacotes/backend/prisma/schema.prisma` com enum `StatusLead` sem deprecated
  - `pacotes/frontend/src/paginas/Leads.tsx` marcado como `@deprecated`
  - `pacotes/frontend/src/paginas/MissionControlLeads.tsx` sem lazy de lista legado
  - `grep` de `QUALIFICADO|EM_NEGOCIACAO|CONTATANDO|CONVERTIDO|INATIVO` no frontend (tsx) = 0 ocorrências
- T07:
  - Validação funcional em staging concluída (B/C/D + redirects + smoke de telas)
  - `deprecated_count` em leads = 0 para status legados
  - Regressão em `/api/proprietarios?estagio=Qualificado` corrigida e revalidada
