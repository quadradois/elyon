# Issue #62 — piloto tenant-safe de agenda e no-show

## Estado

Preparação técnica concluída nesta branch. O piloto permanece **bloqueado** e os
dois recursos continuam desabilitados até a aprovação dos seis gates
operacionais.

Baseline: `main@e69231a88b8ae3fef38bb68caa5373f88b8c969d`.

```text
AGENDA_EFFECTS_ENABLED=false
AGENDA_NO_SHOW_ENABLED=false
```

Nenhum tenant foi escolhido ou publicado por esta entrega.

## Mecanismo de isolamento

O worker resolve uma configuração imutável ao iniciar. A ativação aceita
exatamente um `AGENDA_PILOT_TENANT_ID`, validado como UUID e obtido somente da
configuração confiável do processo. Payloads, parâmetros HTTP e texto do modelo
não participam dessa decisão.

Os claimers do outbox de agenda e de no-show recebem esse escopo e aplicam o
filtro de `tenantId` dentro da consulta PostgreSQL que usa `FOR UPDATE SKIP
LOCKED`. Assim, um item mais antigo de outro tenant não é reservado, alterado ou
capaz de causar starvation no piloto. Escopo vazio retorna sem claim.

O mecanismo não cria schema, migration nem identidade paralela de tenant.

## Matriz fail-closed

| Configuração | Efeitos | No-show | Resultado |
|---|---:|---:|---|
| flags ausentes ou `false` | off | off | estado publicado inicial |
| efeito `true`, tenant ausente/inválido | off | off | `TENANT_ID_MISSING` ou `TENANT_ID_INVALID` |
| no-show `true`, efeito `false` | off | off | `EFFECTS_REQUIRED` |
| ambos `true`, tenant válido, grace ausente/inválido | on | off | `GRACE_PERIOD_MISSING` ou `GRACE_PERIOD_INVALID` |
| efeito `true`, tenant válido | on | off | primeira etapa possível após aprovação operacional |
| ambos `true`, tenant válido e grace explícito entre 1 e 1440 | on | on | segunda etapa possível após aprovação da primeira |

Uma configuração recusada não derruba inbox, lotes ou follow-ups. Ela impede
somente os novos processadores de agenda, registra reason code sem identidade e
mantém o restante do worker observável.

## Observabilidade sem PII

- `elyon_agenda_pilot_gate{recurso,status,reason_code}` informa a decisão do
  gate com cardinalidade fechada;
- `elyon_agenda_pilot_tenant_scope_count` informa apenas `0` ou `1`;
- métricas existentes de comandos, efeitos e no-show continuam agregadas;
- logs registram recurso, estado, reason code e tamanho do escopo, nunca UUID,
  nome, telefone, mensagem ou identidade do tenant.

## Gates operacionais pendentes

Antes de qualquer alteração das flags, o responsável pela operação deve
registrar em canal aprovado e não público quando houver identificadores ou
credenciais:

1. tenant piloto e UUID verificado contra a fonte administrativa confiável;
2. responsáveis técnico e comercial e contatos de escalonamento;
3. início, término e janela sem mudanças concorrentes;
4. `AGENDA_NO_SHOW_GRACE_MINUTES` aprovado explicitamente;
5. snapshot das métricas e backlog imediatamente antes da ativação;
6. aceite dos critérios de interrupção e execução do ensaio de rollback.

O UUID real deve permanecer em secret/configuração do ambiente e não no GitHub.

## Proposta de janela e volume para aprovação

Esta proposta não autoriza ativação:

- etapa 1: ao menos 48 horas, dez efeitos confirmados, incluindo no mínimo três
  cancelamentos e três reagendamentos;
- etapa 2: ao menos 72 horas e cinco no-shows elegíveis processados;
- validação manual de 100% desses eventos no piloto, sem publicar dados
  individuais;
- se o volume não for atingido, prolongar a janela; não reduzir a amostra durante
  a execução.

## Critérios de interrupção

Executar rollback imediato diante de qualquer um destes sinais:

- PII em logs ou métricas;
- novo `DELIVERY_UNKNOWN` sem reconciliação operacional;
- qualquer efeito, milestone ou mutação comercial duplicada;
- `NO_SHOW_LEASE_LOST` acima de 5% dos claims ou três ocorrências em dez minutos;
- estado comercial divergente da atividade autoritativa;
- item elegível mais antigo acima de 15 minutos ou crescimento contínuo do
  backlog por três scrapes consecutivos;
- `/ready` não saudável ou loop do worker não recente.

## Sequência de rollout

1. implantar esta mudança com as duas flags `false`;
2. validar `/ready`, `/metrics`, migrations e os gates com escopo `0`;
3. aprovar e configurar o UUID do tenant piloto, responsáveis, janela, grace e
   baseline, ainda com as flags `false`;
4. habilitar somente `AGENDA_EFFECTS_ENABLED=true`, reiniciar o worker e validar
   que o gate mostra `effects=enabled`, `no_show=disabled` e escopo `1`;
5. cumprir observação e volume da etapa 1;
6. após aceite formal, configurar grace explícito e habilitar
   `AGENDA_NO_SHOW_ENABLED=true`;
7. cumprir observação e volume da etapa 2;
8. executar ou repetir o rollback ensaiado e registrar a decisão final.

## Rollback

1. definir ambas as flags como `false`;
2. reiniciar somente o worker;
3. confirmar `elyon_agenda_pilot_gate` com ambos os recursos desabilitados;
4. validar `/ready`, backlog e itens em reconciliação;
5. preservar ledger, outbox, milestones e claims já duráveis;
6. não reativar envios diretos e não reenviar automaticamente resultados
   ambíguos.

O rollback não remove colunas ou dados. Intenções `NOVA` permanecem duráveis para
decisão posterior, e intenções ambíguas continuam fail-closed em reconciliação.

## Evidências automatizadas

- parser recusa tenant ausente, texto arbitrário, múltiplos IDs e UUID inválido;
- no-show não pode preceder efeitos e exige grace period explícito;
- claim sem escopo retorna vazio;
- PostgreSQL real ignora item externo mais antigo e processa apenas o tenant
  piloto;
- métricas expõem estado e tamanho do escopo sem revelar UUID;
- testes existentes de fencing, idempotência, takeover e restart permanecem
  gates de regressão.

## Fora de escopo

- escolher ou ativar um tenant;
- alterar flags em qualquer ambiente;
- ativação global;
- iniciar ou decompor a Onda 1;
- mudar domínio, estados, ledger, outbox ou migrations da #57.
