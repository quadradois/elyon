# Checklist Ativo — Execução Revisão Visual ELYON

## Legenda de status
- `Concluído`
- `Em andamento`
- `Pendente`
- `Backlog (mobile)`

## Fase 1 — Fundação
- [x] `Concluído` — 1.1 Corrigir token `--primary` para blue-600.
- [x] `Concluído` — 1.2 Eliminar `gray-*` e unificar `slate-*`.
- [x] `Concluído` — 1.3 Criar componente `PageHeader`.
- [x] `Concluído` — 1.4 Separar hover do `Card` com variante `interactive`.
- [x] `Concluído` — 1.5 Verificar e consolidar tokens de sombra.

## Fase 2 — Consistência
- [x] `Concluído` — 2.1 Aplicar `PageHeader` em 100% das páginas principais.
- [x] `Concluído` — 2.2 Aplicar `EmptyState` em todas as páginas alvo.
- [x] `Concluído` — 2.3 Padronizar loading de botão (`Loader2 w-4 h-4 mr-2 animate-spin`).
- [x] `Concluído` — 2.4 Substituir todos os toggles custom por `Switch`.
- [x] `Concluído` — 2.5 Acessibilidade básica (`aria-label` + `htmlFor`) em todo o escopo.
- [x] `Concluído` — 2.6 Desabilitar item “Conversas” no menu.
- [x] `Concluído` — 2.7 Finalizar padronização de campos da `Blacklist` (validação final).

## Fase 3 — Dashboard e Hierarquia
- [x] `Concluído` — 3.1 `DashboardProspeccao` com 3 zonas visuais.
- [x] `Concluído` — 3.2 Tipografia de KPI (`tabular-nums` + hierarquia) em todos os dashboards.
- [x] `Concluído` — 3.3 Skeleton loading em Dashboard, Leads e Campanhas.
- [x] `Concluído` — 3.4 Hierarquia de superfícies consolidada (`bg-slate-50` + níveis).
- [x] `Concluído` — 3.5 Mover “Meu Plano” para rodapé da sidebar.

## Fase 4 — Mobile e Responsividade
- [ ] `Backlog (mobile)` — 4.1 Sidebar mobile (overlay/fechamento/UX completa).
- [ ] `Backlog (mobile)` — 4.2 Breakpoints responsivos remanescentes.
- [ ] `Backlog (mobile)` — 4.3 Kanban: validação final do indicador de scroll.
- [ ] `Backlog (mobile)` — 4.4 LeadDetalhes one-handed (validação/ajustes remanescentes).
- [ ] `Backlog (mobile)` — 4.5 Wizard de Captação sem transbordo em 375px.

## Fase 5 — Polimento Premium
- [x] `Concluído` — 5.1 Ativar/aplicar `.card-premium` em cards de destaque.
- [x] `Concluído` — 5.2 Microinteração na conversão de lead.
- [x] `Concluído` — 5.3 Breadcrumb em páginas de detalhe.
- [x] `Concluído` — 5.4 Microinteração no disparo de campanha.
- [x] `Concluído` — 5.5 Revisão final de contraste (WCAG AA).

## Itens de backlog relacionados (mobile)
- `/root/elyon/backlog/2026-04-28-revisao-visual-mobile-fase-4.md`
- `/root/elyon/backlog/2026-04-28-pendencias-mobile-consolidadas.md`
- `/root/elyon/backlog/2026-04-28-governanca-demandas-mobile.md`

## Última atualização
- Data: 2026-04-28
- Origem: Fase 5 concluída e validada tecnicamente (`tsc --noEmit`).
