# Documentacao Elyon

Este diretorio foi organizado por tema para facilitar manutencao e descoberta.

## Estrutura

- `planos/`: planos tecnicos e de execucao.
- `playbooks/`: guias operacionais.
- `raio-x/`: diagnosticos e analises de estado atual.
- `qa/`: roteiros e relatorios de regressao.
- `politicas/`: politicas e diretrizes de retencao/seguranca.
- `guias/`: guias gerais, migracao, estrategia e auditorias.
- `relatorios/`: pendencias e relatorios executivos.
- `skills/`: materiais de apoio para skills.
- `arquitetura/`: estado AS-IS/TO-BE e registros de decisao (ADRs).
- `governanca/`: processo de issues, branches, PRs, rollout e rollback.

## Governanca tecnica

- [Arquitetura AS-IS/TO-BE](arquitetura/AS_IS_TO_BE.md)
- [Indice de ADRs](arquitetura/decisions/README.md)
- [Workflow de engenharia](governanca/WORKFLOW_ENGENHARIA.md)
- [Constituicao de engenharia](../.specify/memory/constitution.md)
- [Copia anonimizada para testes de migration](operacao/COPIA_BANCO_ANONIMIZADA.md)
- [Baseline e bootstrap das migrations Prisma](operacao/BASELINE_MIGRATIONS.md)

## Limpeza aplicada em 2026-04-27

- `image.png` e `leads.md` foram removidos de `docs/` e movidos para backup em:
  - `/root/elyon/_lixeira_docs_2026-04-27/`
