# Baseline e bootstrap das migrations Prisma

## Controle operacional

- **Owner:** `platform-data`.
- **Baseline ativo:** `20260714000000_baseline`.
- **Timeout padrão:** 600 segundos por comando Prisma, configurável por `PRISMA_MIGRATION_TIMEOUT_SECONDS`.
- **Banco suportado:** PostgreSQL 15 com `pgvector/pgvector:0.8.0-pg15`.
- **Gate obrigatório:** `pacotes/backend/scripts/prisma-migrate-deploy.sh`.

O diretório `prisma/migrations` contém somente o baseline reproduzível e as migrations criadas depois dele. A cadeia anterior está preservada em `prisma/migrations_legacy_pre_20260714` apenas para auditoria e rollback de imagem; ela não deve voltar para a cadeia ativa.

## Banco vazio

O gate detecta um banco sem tabelas de aplicação e executa `prisma migrate deploy`. O baseline cria o schema final completo. Uma segunda execução deve informar que não há migrations pendentes.

```bash
cd /app
./scripts/prisma-migrate-deploy.sh
./scripts/prisma-migrate-deploy.sh
```

Depois do bootstrap, validar:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

O retorno esperado é zero e `No difference detected`.

## Adoção por banco legado

O gate nunca aplica o SQL do baseline sobre um banco preenchido. A adoção automática só ocorre quando todos os controles abaixo passam:

1. não há migration incompleta;
2. migrations concluídas e revertidas coincidem com os manifests auditados da cópia anonimizada;
3. o diff estrutural coincide byte a byte com `prisma/legacy-baseline-allowed-drift.sql`;
4. o baseline ainda não está registrado.

O arquivo de drift é uma **impressão digital estrutural**, não um script de correção. Nunca executá-lo no banco.

Com o gate aprovado, `prisma migrate resolve --applied 20260714000000_baseline` registra apenas o marcador e `prisma migrate deploy` confirma que não existe DDL pendente. Divergência de histórico ou de fingerprint interrompe o deploy antes da marcação.

## Deploy de produção

O `scripts/deploy.sh update <sha>` mantém esta ordem:

1. valida o SHA e o estado da release;
2. cria backup pré-deploy;
3. constrói a imagem nova;
4. executa `./scripts/prisma-migrate-deploy.sh` em container isolado;
5. inicia aplicação e worker;
6. executa health checks e smoke externo.

O entrypoint do backend usa o mesmo gate, evitando que reinícios contornem a política.

## Restore

1. Restaurar o backup em PostgreSQL 15 com pgvector.
2. Confirmar owner do incidente e registrar horário/artefato/checksum.
3. Executar o gate com timeout explícito:

   ```bash
   PRISMA_MIGRATION_TIMEOUT_SECONDS=600 ./scripts/prisma-migrate-deploy.sh
   ```

4. Conferir tabelas, migrations concluídas, constraints e contagens críticas.
5. Executar `migrate diff` e smoke tests antes de liberar tráfego.

Para ensaios com produção anonimizada, seguir também [COPIA_BANCO_ANONIMIZADA.md](COPIA_BANCO_ANONIMIZADA.md). O dump anonimizado não deve ser anexado a issues, PRs ou artefatos de CI.

## Rollback

- **Falha antes da marcação:** nenhuma mudança foi feita; corrigir a divergência ou restaurar outra cópia.
- **Falha após a marcação e antes do health check:** manter o marcador. A imagem anterior com as 43 migrations legadas aceita o histórico com o baseline adicional e não executa DDL; esse cenário foi testado contra a cópia anonimizada.
- **Falha em banco vazio descartável:** remover e recriar o banco, depois reaplicar o baseline.
- **Falha em restore de produção:** interromper tráfego, preservar logs e restaurar o backup pré-deploy. Não apagar manualmente linhas de `_prisma_migrations` e não tentar reverter schema sem plano específico.

O baseline inicial não altera o schema do banco legado. Migrations futuras devem continuar retrocompatíveis; rollback de imagem não implica rollback automático de schema.

## Evidências mínimas

Registrar sem dados de usuário:

- SHA implantado;
- estado retornado pelo gate (`EMPTY`, `LEGACY_READY` ou `BASELINE_APPLIED` nos logs controlados);
- contagem de tabelas e migrations concluídas;
- resultado do diff;
- health checks e smoke tests;
- decisão de rollback, quando aplicável.
