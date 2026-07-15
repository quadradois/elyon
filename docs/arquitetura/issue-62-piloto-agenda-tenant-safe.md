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

Quando algum recurso é solicitado, `AGENDA_PILOT_STARTED_AT` também é obrigatório
e deve ser um instante UTC ISO-8601 terminado em `Z`. O worker resolve esse cutoff
uma única vez no startup e reutiliza o mesmo valor em todos os loops até o próximo
restart. Um restart com a mesma configuração preserva o watermark; sua alteração
durante uma janela exige nova aprovação operacional e uma nova janela.

Antes de habilitar o gate, o worker consulta o PostgreSQL e exige que o UUID exista
e que o tenant esteja `ATIVO`. A mesma condição é repetida dentro do SQL de cada
claim, impedindo processamento se o tenant for suspenso ou cancelado após o
startup.

Os claimers do outbox de agenda e de no-show recebem esse escopo e aplicam o
filtro de `tenantId` dentro da consulta PostgreSQL que usa `FOR UPDATE SKIP
LOCKED`. Assim, um item mais antigo de outro tenant não é reservado, alterado ou
capaz de causar starvation no piloto. Escopo vazio retorna sem claim.

Intenções `NOVA` do tenant piloto criadas antes do cutoff são movidas para
`RECONCILIACAO/PILOT_PRE_CUTOFF`, sem envio. Atividades com `agendadoPara` anterior
ao cutoff nunca são elegíveis para no-show automático. Portanto, habilitar uma
flag não drena retroativamente o backlog histórico.

O mecanismo não cria schema, migration nem identidade paralela de tenant.

## Matriz fail-closed

| Configuração | Efeitos | No-show | Resultado |
|---|---:|---:|---|
| flags ausentes ou `false` | off | off | estado publicado inicial |
| efeito `true`, tenant ausente/inválido | off | off | `TENANT_ID_MISSING` ou `TENANT_ID_INVALID` |
| recurso solicitado, cutoff ausente/inválido | off | off | `STARTED_AT_MISSING` ou `STARTED_AT_INVALID` |
| tenant inexistente ou não ativo | off | off | `TENANT_NOT_FOUND` ou `TENANT_INACTIVE` |
| no-show `true`, efeito `false` | off | off | `EFFECTS_REQUIRED` |
| ambos `true`, tenant ativo, cutoff válido, grace ausente/inválido | on | off | `GRACE_PERIOD_MISSING` ou `GRACE_PERIOD_INVALID` |
| efeito `true`, tenant ativo e cutoff válido | on | off | primeira etapa possível após aprovação operacional |
| ambos `true`, tenant ativo, cutoff válido e grace explícito entre 1 e 1440 | on | on | segunda etapa possível após aprovação da primeira |

Uma configuração recusada não derruba inbox, lotes ou follow-ups. Ela impede
somente os novos processadores de agenda, registra reason code sem identidade e
mantém o restante do worker observável.

## Observabilidade sem PII

- `elyon_agenda_pilot_gate{recurso,status,reason_code}` informa a decisão do
  gate com cardinalidade fechada;
- `elyon_agenda_pilot_tenant_scope_count` informa apenas `0` ou `1`;
- `elyon_agenda_pilot_cutoff_configured` informa apenas `0` ou `1`, nunca o
  timestamp;
- métricas existentes de comandos, efeitos e no-show continuam agregadas;
- logs registram recurso, estado, reason code e tamanho do escopo, nunca UUID,
  nome, telefone, mensagem ou identidade do tenant.

## Gates operacionais pendentes

Antes de qualquer alteração das flags, o responsável pela operação deve
registrar em canal aprovado e não público quando houver identificadores ou
credenciais:

1. tenant piloto e UUID verificado contra a fonte administrativa confiável;
2. responsáveis técnico e comercial e contatos de escalonamento;
3. início, término, `AGENDA_PILOT_STARTED_AT` e janela sem mudanças concorrentes;
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
3. aprovar e configurar o UUID do tenant piloto, cutoff UTC, responsáveis,
   janela, grace e baseline, ainda com as flags `false`;
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

O rollback não remove colunas ou dados. Intenções posteriores ao cutoff que ainda
estiverem `NOVA` permanecem duráveis para decisão posterior; itens pré-cutoff e
intenções ambíguas continuam fail-closed em reconciliação.

## Evidências automatizadas

- parser recusa tenant ausente, texto arbitrário, múltiplos IDs e UUID inválido;
- cutoff ausente, inválido ou fora de UTC é recusado antes do SQL;
- tenant inexistente ou inativo mantém os recursos desabilitados, e a condição
  `ATIVO` é repetida dentro do claim;
- no-show não pode preceder efeitos e exige grace period explícito;
- claim sem escopo retorna vazio;
- PostgreSQL real põe intenção pré-cutoff em reconciliação, ignora atividade
  histórica e processa somente itens posteriores ao cutoff do tenant piloto;
- restart com a mesma configuração preserva o cutoff;
- métricas expõem estado do gate, cutoff configurado e tamanho do escopo sem
  revelar UUID, timestamp ou PII;
- testes existentes de fencing, idempotência, takeover e restart permanecem
  gates de regressão.

## Fora de escopo

- escolher ou ativar um tenant;
- alterar flags em qualquer ambiente;
- ativação global;
- iniciar ou decompor a Onda 1;
- mudar domínio, estados, ledger, outbox ou migrations da #57.
