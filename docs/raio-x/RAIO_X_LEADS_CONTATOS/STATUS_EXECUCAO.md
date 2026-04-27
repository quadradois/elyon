# Status de Execução — Leads & Contatos

Atualize este arquivo diariamente durante a sprint.

## Painel resumido

| Tarefa | Título | Owner | Status | Início | Fim | Risco | Evidência |
|---|---|---|---|---|---|---|---|
| T01 | Foundation DB/Webhook | Backend 1 (sugerido) | TODO | 2026-04-27 | 2026-04-28 | Alto (dados + webhook) | - |
| T02 | API Proprietários | Backend 2 (sugerido) | TODO | 2026-04-28 | 2026-04-29 | Médio (contrato API) | - |
| T03 | Página Proprietários | Frontend 1 (sugerido) | TODO | 2026-04-29 | 2026-04-30 | Médio (UX + paginação) | - |
| T04 | Detalhe Proprietário | Frontend 2 (sugerido) | TODO | 2026-04-30 | 2026-05-01 | Médio (integração de abas) | - |
| T05 | Sidebar & Rotas | Frontend 1 (sugerido) | TODO | 2026-05-01 | 2026-05-01 | Médio (redirects) | - |
| T06 | Cleanup/Deprecação | Backend 1 + Frontend 2 (sugerido) | TODO | 2026-05-01 | 2026-05-01 | Alto (migração status) | - |
| T07 | Validação Regressão SDR | QA/Tech Lead (sugerido) | TODO | 2026-05-01 | 2026-05-01 | Alto (core do negócio) | - |

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
- Bloqueios:
  - Janela para execução das migrations em staging.
- Próximo passo:
  - Confirmar nomes reais dos owners sugeridos.
  - Iniciar T01 (P1) e registrar evidências dos cenários C e B.

## Registro de bloqueios

| Data | Tarefa | Bloqueio | Impacto | Responsável destrave | ETA |
|---|---|---|---|---|---|
| - | - | - | - | - | - |

## Evidências por tarefa

Preencha com links internos (PR, commit, logs, prints, query result).

- T01:
- T02:
- T03:
- T04:
- T05:
- T06:
- T07:
