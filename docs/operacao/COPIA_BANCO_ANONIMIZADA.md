# Copia anonimizada do banco para testes de migration

Owner: `platform-data`

Ultima validacao documental: 2026-07-13

Issue: [#27](https://github.com/quadradois/elyon/issues/27)

## Objetivo

Produzir uma copia estruturalmente fiel do PostgreSQL de producao para validar
baseline, upgrade e restore sem retirar dados pessoais ou segredos da VPS. Este
procedimento nao substitui backup off-host e nao resolve a #12.

## Garantias do utilitario

- acessa producao somente por `pg_dump`;
- transmite o dump bruto diretamente para PostgreSQL temporario, sem arquivo;
- nao publica porta e usa `--network none` nos bancos descartaveis;
- anonimiza identificadores diretos e quase-identificadores em texto, JSON,
  arrays, binarios, numeros, booleanos, datas e geolocalizacao;
- exclui chaves primarias e estrangeiras da substituicao;
- preserva chaves, relacionamentos, enums, status e `_prisma_migrations`;
- exporta apenas depois da anonimizacao;
- gera inventario sem valores, checksum SHA-256 e evidencia `0600`;
- restaura o artefato em um segundo banco descartavel antes de concluir;
- remove os containers temporarios mesmo quando ocorre erro.

## Preflight na VPS

Use uma sessao administrativa. A chave restrita do GitHub Actions nao oferece
shell e aceita apenas `probe <sha>` ou `deploy <sha>`.

```bash
cd /root/elyon
sudo ./scripts/ops/create-anonymized-db-copy.sh --check
```

O check exige espaco livre igual a duas vezes o tamanho do banco mais 1 GiB. Ele
nao cria containers, arquivos ou volumes.

## Execucao

Janela recomendada: ate 60 minutos. O banco permanece online; `pg_dump` pode
aumentar I/O, portanto o owner deve observar CPU, disco e latencia.

```bash
cd /root/elyon
sudo ./scripts/ops/create-anonymized-db-copy.sh \
  --apply \
  --confirm-production-copy
```

Saidas em `/var/lib/elyon/anonymized-db/`:

- `elyon-anonymized-<timestamp>.dump`;
- `.dump.sha256`;
- `.inventory.csv`, contendo somente tabela, coluna e tipo;
- `.evidence`, com tamanho, contagens, imagem, resultado do restore e retencao.

Nenhum desses arquivos deve ser adicionado ao Git, logs de CI ou artefatos
publicos.

## Validacao pelo operador

```bash
sudo grep -E '^(raw_dump_persisted|restore_verified|sha256|retention_deadline_utc)=' \
  /var/lib/elyon/anonymized-db/elyon-anonymized-<timestamp>.evidence

cd /var/lib/elyon/anonymized-db
sudo sha256sum --check elyon-anonymized-<timestamp>.dump.sha256
```

Resultado esperado:

```text
raw_dump_persisted=false
restore_verified=true
elyon-anonymized-<timestamp>.dump: OK
```

## Transferencia e retencao

Somente o dump anonimizado, checksum, inventario e evidencia podem sair da VPS.
Use a credencial administrativa e canal acordado pelo owner; a chave de deploy
do CI nao deve ser reutilizada. Confirme o checksum no destino antes dos testes.

O artefato continua sendo interno. Restrinja acesso ao responsavel pela #27 e
apague origem e destino no prazo indicado em `retention_deadline_utc`. Remova
somente os quatro arquivos do mesmo timestamp, nunca o diretorio recursivamente.

## Uso na #27

1. Restaurar o dump em `pgvector/pgvector:0.8.0-pg15` isolado.
2. Registrar contagem de tabelas e migrations concluidas.
3. Testar o baseline em banco vazio com `prisma migrate deploy`.
4. No banco restaurado, marcar o baseline conforme o runbook do PR de squash.
5. Executar `prisma migrate deploy` e verificar drift, constraints e contagens.
6. Documentar timeout, rollback e descarte da copia.

## Falha e rollback

Falha antes do dump nao deixa artefato bruto. O trap remove containers
temporarios. Se houver arquivo parcial, remova apenas o timestamp informado e
repita o preflight. O procedimento nunca altera o banco de origem.
