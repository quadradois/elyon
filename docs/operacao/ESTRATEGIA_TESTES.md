# Estrategia de testes

Esta separacao mantem o ciclo rapido sem Docker local e reserva infraestrutura real para o CI.

| Suite | Comando | Infraestrutura | Timeout | Ownership |
| --- | --- | --- | --- | --- |
| Unit backend + frontend | `npm run test:unit` | Nenhuma | 10 s por teste | Times Backend e Frontend |
| Integration backend | `npm run test:integration` | PostgreSQL 15 com pgvector e Redis 7 | 30 s por teste, 15 min no job | Platform/Data |
| Migrations | job `Migrations - banco vazio` | PostgreSQL 15 com pgvector vazio | 10 min no job | Platform/Data |
| Smoke | `npm run test:smoke` | Endpoints HTTP implantados | 20 s por endpoint | Platform/SRE |

## Ciclo local

`npm run test:unit` executa Jest e Vitest sem PostgreSQL, Redis ou Docker. O backend continua aceitando `npm test --workspace @elyon/backend` como alias da suite unitaria.

## Integracao isolada

O job `Integracao - PostgreSQL e Redis` cria servicos efemeros exclusivos, aplica as migrations oficiais e executa testes reais de:

- isolamento de listagem e detalhe entre dois tenants;
- idempotencia/replay de webhook pela constraint do PostgreSQL;
- TTL, deduplicacao e mutex atomico no Redis;
- cadeia de migrations antes dos testes de aplicacao.

A suite recusa executar se `DATABASE_URL` nao usar o banco `elyon_integration` ou se `REDIS_URL` nao usar o database `/15`. Cada execucao usa identificadores aleatorios e remove somente os registros e chaves que criou. Nunca se deve apontar esses comandos para dados compartilhados ou producao.

## Frontend

Vitest + Testing Library cobre login valido, erro de credenciais, persistencia da sessao e guards de rota privada/administrativa. Esses testes rodam antes do build do frontend.

## Bloqueios de PR e deploy

Os jobs de backend, frontend, integracao, migrations e compose precisam passar antes do build das imagens. O deploy usa a mesma suite de smoke, com URLs configuraveis por `SMOKE_API_URL`, `SMOKE_CRM_URL` e `SMOKE_SITE_URL`.
