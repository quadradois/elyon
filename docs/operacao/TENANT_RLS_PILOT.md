# Piloto de isolamento de tenant no PostgreSQL

## Escopo

O piloto protege `leads` e `campanhas`, tabelas com PII e mutacoes de alto impacto. A migration cria a role `elyon_tenant_access` (`NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`) e policies que comparam `tenantId` com o parametro transacional `app.tenant_id`.

O helper `withTenantDb` abre uma transacao, define o tenant com `set_config(..., true)` e executa `SET LOCAL ROLE elyon_tenant_access`. Tanto a role quanto o parametro sao descartados no commit ou rollback, antes de a conexao voltar ao pool.

Os endpoints de controle de atendimento e follow-up de leads formam o primeiro fluxo da aplicacao executado sob essa defesa. Os filtros de tenant continuam no codigo durante a fase de expansao como defesa em profundidade.

## Acesso administrativo

Operacoes que precisam atravessar tenants devem usar `withTenantAdminDb`, informando `tenantId`, `actor` e `reason`. O pedido e persistido em `logs_auditoria` com a acao `RLS_ADMIN_ACCESS` antes da transacao administrativa.

O acesso direto pelo usuario proprietario do schema continua existindo durante o piloto para preservar jobs e rotas ainda nao migrados. Ele nao deve ser usado em novos fluxos tenant-scoped.

## Rollout expand/contract

1. Expand: criar role/policies sem `FORCE ROW LEVEL SECURITY` e migrar hotspots para `withTenantDb`.
2. Observar erros, latencia e logs `RLS_ADMIN_ACCESS`.
3. Migrar progressivamente as demais tabelas e rotas tenant-scoped.
4. Contract: usar uma credencial de aplicacao nao proprietaria e, apos cobertura completa, avaliar `FORCE ROW LEVEL SECURITY`.

## Validacao e desempenho

O job `Integracao - PostgreSQL e Redis` aplica as migrations, verifica duas policies, executa o rollback, confirma a remocao, reaplica o SQL e roda testes com dois tenants. Os testes cobrem leitura, escrita, alternancia concorrente no pool e escape administrativo auditado.

A suite mede 20 consultas equivalentes dentro de uma unica transacao, publicando `baselineMs`, `rlsMs` e `overheadMs` no log do CI. O limite bloqueante e deliberadamente conservador (`RLS < baseline * 8 + 250 ms`) para detectar degradacao grosseira sem introduzir flakiness de runner.

Referencia local inicial (Windows + Docker Desktop, 2026-07-14): 45,6 ms no baseline e 40,6 ms com RLS para 20 consultas. Esses numeros servem apenas como baseline operacional; a tendencia do CI e a metrica relevante para regressao.

## Rollback

Em incidente, executar como proprietario do schema:

```sh
npx prisma db execute \
  --file prisma/rollbacks/20260714130000_tenant_rls_pilot.sql \
  --schema prisma/schema.prisma
```

O rollback remove policies, desabilita RLS nas duas tabelas, revoga a role do usuario de deploy e remove a role. Ele nao altera nem apaga dados.
