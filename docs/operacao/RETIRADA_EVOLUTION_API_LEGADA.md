# Retirada da Evolution API local legada

## Decisão

O ELYON utiliza a Evolution Go dedicada configurada por `EVOLUTION_API_URL`. O
stack local `evolution-api` 2.3.6, seu PostgreSQL e seu Redis pertencem a uma
implementação anterior e não fazem mais parte da arquitetura suportada.

Evidências coletadas em 2026-07-13:

- as quatro instâncias locais estavam em `connecting`;
- a mensagem local mais recente era de 2026-06-06;
- nenhuma sessão do banco ELYON possuía o mesmo nome das instâncias locais;
- o backend consultava com sucesso `/instance/all` na Evolution Go dedicada;
- o volume PostgreSQL legado ocupava aproximadamente 1,6 GiB.

## Execução

Depois do merge e antes de remover qualquer volume:

```bash
sudo scripts/ops/retire-legacy-evolution.sh --check
sudo scripts/ops/retire-legacy-evolution.sh
```

O script falha fechado se encontrar uma instância local aberta ou sobreposição
de nomes com `sessoes_whatsapp`. Em seguida ele:

1. cria um `pg_dump` em formato custom;
2. valida o dump com `pg_restore --list`;
3. grava checksum SHA-256 e evidência com permissão `600`;
4. para e remove somente os três contêineres legados;
5. preserva os dois volumes Docker;
6. valida API, CRM e site.

O diretório padrão é `/var/backups/elyon/evolution-legacy`. Para outro destino,
defina `EVOLUTION_LEGACY_BACKUP_DIR` em uma sessão administrativa.

## Retenção

Mantenha o dump e os volumes por pelo menos 30 dias. A exclusão dos volumes
`evolution_evolution_postgres_data` e `evolution_evolution_redis_data` é uma etapa
separada e exige aceite explícito depois de validar a Evolution Go dedicada.

## Rollback

Enquanto os volumes existirem, recupere o `evolution/docker-compose.yml` do commit
anterior à retirada e suba o projeto com o mesmo nome Compose. Se os volumes já
tiverem sido excluídos, restaure o dump verificado em um PostgreSQL compatível. O
rollback do stack legado não altera `EVOLUTION_API_URL`; qualquer retorno de
tráfego para ele precisa ser uma decisão operacional separada.
