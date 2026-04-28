# Pendências Mobile Consolidadas (Implementação Futura)

## Status
Pendente

## Prioridade
P1

## Data de registro
2026-04-28

## Contexto
Decisão do projeto: **tudo que for relativo a mobile não é prioridade agora** e deve ficar registrado no backlog.

## Problema
Existem pendências mobile distribuídas entre revisão visual, responsividade e validação de usabilidade em campo. Sem consolidação, há risco de perda de contexto.

## Escopo futuro
- Concluir totalmente a Fase 4 (Mobile e Responsividade) do plano visual.
- Fechar itens remanescentes de responsividade em tabs, grids e blocos de ação.
- Revisar páginas críticas para uso one-handed e zonas de toque (>=44px).
- Executar bateria de validação manual em 375px e 430px.
- Revisar overflow horizontal e legibilidade de tabelas/cards em telas pequenas.

### Itens pendentes por referência do plano
- `4.1` Sidebar mobile: complementar UX (ex.: botão de fechar explícito e avaliação de gesto/sweep para fechar).
- `4.2` Breakpoints: finalizar varredura para eliminar qualquer `grid-cols-N` sem fallback adequado em mobile.
- `4.3` Kanban: manter e validar indicador de scroll horizontal em cenários reais de uso.
- `4.4` LeadDetalhes: validar barra fixa de ações e ergonomia completa do fluxo em campo.
- `4.5` Wizard de captação/agente: garantir não-transbordo em viewport 375px.

## Impactos
- Melhora direta da operação mobile em campo.
- Redução de atrito nos fluxos principais (captação, leads, atendimento).
- Menor risco de regressão visual entre páginas.

## Critério de pronto futuro
- Checklist da Fase 4 concluído e validado.
- Evidência de testes manuais mobile (375px e 430px).
- Sem regressão em desktop após ajustes mobile.
- `tsc --noEmit` sem erros ao final.

## Observação
Referências:
- `/root/elyon/docs/REVISÕES/PLANO_EXECUCAO_REVISAO_VISUAL.md`
- `/root/elyon/backlog/2026-04-28-revisao-visual-mobile-fase-4.md`
