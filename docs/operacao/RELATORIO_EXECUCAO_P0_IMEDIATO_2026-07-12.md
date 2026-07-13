# Relatório de execução — P0 imediato antes de deploy

Data: 12/07/2026  
VPS: ELYON  
Escopo: tarefas 2 a 6 do plano P0 imediato  
Resultado: concluído sem rebuild, migração ou restart da aplicação

## Resumo

| Tarefa | Estado | Evidência |
|---|---|---|
| 2. Preservar alterações da VPS | Concluída | Snapshot restrito na VPS, hashes SHA-256 e PR draft #1 |
| 3. Rotação dos logs Docker | Ativa | `logrotate` instalado; backend e Evolution rotacionados; limites nativos preparados nos Compose |
| 4. Alerta de disco | Ativo | Timer systemd a cada 5 minutos; warning 80%; crítico 90%; testes sintéticos registrados |
| 5. Corrigir `trust proxy` | Implementada e validada; deploy pendente | TypeScript, ESLint direcionado e 7 testes aprovados no PR draft #2 |
| 6. Proibir deploy direto | Ativa na VPS | Build bloqueado fora de `main`; worktree limpa na branch P0; deploy exige SHA exato de `origin/main` |

## 1. Preservação

- Commit base identificado: `2d3481f776ecfe61171ab65b659d2d77259e05ea`.
- Snapshot integral armazenado em `/root/vps-snapshots/elyon-20260713T020948Z`.
- Snapshot contém patch binário, arquivos não rastreados, status e checksums.
- Código, migrações e documentação segura foram publicados no PR draft #1.
- Dumps e exports permaneceram somente na VPS; nenhum dado operacional foi enviado ao GitHub.

PR: https://github.com/quadradois/elyon/pull/1

## 2. Disco e logs

### Antes

- Disco: 96% usado; 3,3 GB livres.
- Build cache Docker: 14,82 GB.
- Journal: 2,6 GB.
- Log do backend: 2,28 GB.
- Log da Evolution: 212 MB.

### Depois

- Disco: 68% usado; 23 GB livres.
- Build cache: removido.
- Journal: limitado a aproximadamente 500 MB.
- Log ativo do backend: rotacionado e truncado com cópia comprimida.
- Log ativo da Evolution: rotacionado e truncado com cópia comprimida.
- Containers não foram interrompidos.

### Política

- Rotação ao atingir 50 MB.
- Cinco arquivos retidos.
- Compressão habilitada.
- `copytruncate` usado para containers atuais, sem restart.
- Compose usa `json-file`, `max-size=50m`, `max-file=5` após futura recriação controlada.

## 3. Monitor de disco

- Unit: `elyon-disk-monitor.service`.
- Timer: `elyon-disk-monitor.timer`.
- Frequência: 5 minutos.
- Warning: 80%.
- Critical: 90%.
- Estado atual: `OK`.
- Último estado: `/var/lib/elyon-disk-monitor/latest`.
- Eventos: `journalctl -t elyon-disk-monitor`.
- Webhook externo opcional via `/etc/elyon/disk-monitor.env`.

Foram executados testes sintéticos de `WARNING` e `CRITICAL`, seguidos de uma execução normal que restaurou o estado `OK`.

## 4. Trust proxy e rate-limit

Implementado no PR #2:

- um salto de proxy confiável por padrão em produção;
- proxy desabilitado por padrão em desenvolvimento/teste;
- configuração explícita por `TRUST_PROXY_HOPS`;
- rejeição de valores inválidos;
- uso de `ipKeyGenerator` do `express-rate-limit`;
- remoção de `x-tenant-id` como chave controlável do rate-limit global.

Validações:

- TypeScript `--noEmit`: aprovado;
- ESLint dos arquivos tocados: aprovado;
- Jest: 7 testes aprovados.

O runtime atual ainda apresenta a configuração antiga. A correção só deve ser ativada após revisão/merge do PR e deploy seguro, evitando reconstruir a produção a partir de mudanças históricas não revisadas.

## 5. Deploy seguro

O script agora exige:

- branch `main`;
- worktree sem modificações ou arquivos não rastreados;
- fetch explícito de `origin/main`;
- SHA exato informado pelo operador;
- SHA igual ao topo de `origin/main`;
- validação dos dois Compose;
- fast-forward apenas;
- health check pós-deploy.

O fluxo não usa mais `git pull`, não executa `down` durante atualização e não permite `docker volume prune` pelo comando de limpeza.

Teste realizado na VPS:

```text
ERRO: Deploy permitido somente a partir da branch main; atual=codex/p0-immediate-ops.
GUARD_BLOCKED_AS_EXPECTED
```

## 6. Saúde após execução

- 11 containers ativos.
- Backend, frontend, PostgreSQL, Redis e backup saudáveis.
- Site: HTTP 200.
- CRM: HTTP 200.
- API `/health`: HTTP 200.
- Worktree da VPS limpa e alinhada a `origin/codex/p0-immediate-ops`.

## 7. Pendências deliberadas

1. Revisar e integrar o PR #2 antes de deploy.
2. Não integrar o PR #1 sem revisão funcional das mudanças históricas.
3. Configurar canal externo para alertas de disco, se desejado.
4. Corrigir dívida preexistente do lint em fluxo separado:
   - backend: 55 erros e 945 warnings;
   - frontend: 1 warning bloqueante por `max-warnings=0`.
5. Tratar segredos existentes no Compose Evolution durante o próximo P0 de segurança.

PR de guardrails: https://github.com/quadradois/elyon/pull/2
