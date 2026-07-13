# Arquitetura ELYON: AS-IS e TO-BE

Status: vivo  
Owner: arquitetura e plataforma  
Issue rastreadora: [#9](https://github.com/quadradois/elyon/issues/9)

## AS-IS

O ELYON e um monorepo Node/TypeScript com frontend React, backend Express,
Prisma/PostgreSQL com pgvector, Redis e workers. O runtime e empacotado por
Docker Compose e publicado em VPS por GitHub Actions. O dominio opera com
isolamento logico por `tenantId`, webhooks duraveis e agentes especializados.

Os principais riscos abertos sao a reproducibilidade da cadeia de migrations
(#27), backup off-host/restore drill (#12), falta de testes reais de integracao
(#17) e defesa de tenant no banco (#15). A suite atual e majoritariamente
unitaria e a governanca da `main` ainda depende de disciplina de processo.

## TO-BE

- Cadeia de migrations reproduzivel e restore comprovado.
- CI separado em unit, integration, frontend, compose, images e smoke.
- Isolamento por tenant reforcado no banco para tabelas criticas.
- Hotspots divididos em policies, casos de uso e adapters com regras de
  dependencia verificaveis.
- Main e producao protegidas por checks e aprovacoes server-side.
- ADRs, runbooks, SLOs e ownership navegaveis e mantidos junto ao codigo.

## Fontes de evidencia

- [Raio-X AS-IS geral](../raio-x/RAIO_X_AS_IS.md)
- [Auditoria de agentes](../RAIO%20X%20IA/README.md)
- [Matriz de riscos](../RAIO%20X%20IA/02-matriz-riscos.md)
- [Plano TO-BE](../RAIO%20X%20IA/04-plano-evolucao.md)
- [Pipeline de producao](../operacao/PIPELINE_CI_CD_PRODUCAO.md)

Decisoes que mudam contratos ou fronteiras devem ser registradas no indice de
[ADRs](decisions/README.md).
