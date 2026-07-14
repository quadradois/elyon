# Mapa de migracao: Lead e leadId canonicos

Data: 2026-07-14

Decisao: [ADR-0002](../decisions/0002-lead-entidade-canonica.md)

Inventario: [referencias legadas](../inventarios/issue-46-referencias-contato.md)

## Objetivo e limites

Este mapa transforma a decisao da issue 46 em unidades revisaveis de trabalho.
Ele nao cria issues, nao implementa mudancas e nao detalha a maquina de estados.
As issues #47 e #48 permanecem fora do escopo; qualquer intersecao futura deve
consumir o contrato de identidade deste ADR sem ser antecipada aqui.

Estado final esperado:

- um prospecto possui um `Lead.id` estavel por toda a jornada;
- `leadId` e usado internamente por todos os componentes;
- `contatoId` existe apenas durante a janela de compatibilidade e depois some;
- nenhum runtime consulta modelo/tabela `Contato`;
- historico, cache, tenant e metricas permanecem reconciliados.

## Dependencias e ordem

```text
ADR aprovado
  -> I46-A baseline e telemetria
  -> I46-B bloqueios webhook/qualificacao
  -> I46-C tools, prompts e orquestracao
  -> I46-D cache, historico e jobs
  -> I46-E REST de campanhas e frontend
  -> I46-F testes e fitness gate
  -> I46-G contract de aliases e legado de banco
```

`I46-G` depende de todos os consumidores migrados e de 30 dias sem uso do alias.
As demais unidades podem ser refinadas em paralelo apenas depois de `I46-A`,
mas devem ser integradas na ordem que preserve compatibilidade.

## Mapa por componente

| Componente | AS-IS | Expand | Contract | Evidencia de conclusao | Rollback |
|---|---|---|---|---|---|
| Schema/dados | Schema declara apenas Lead; ambientes podem conter legado | Inventariar por ambiente, reconciliar UUID/FKs e preparar mapping apenas se necessario | Remover estrutura legada somente com migration aprovada | Contagens por tenant/campanha, zero orfaos e teste de upgrade | Aplicacao anterior compativel + backup; sem drop ate reconciliacao |
| Webhook | SQL em `contatos`, aliases em toda a fila | Query Lead por tenant/telefone; adaptador aceita alias e produz `leadId` | Remover SQL e nomes legados | Inbound, debounce, mutex e idempotencia passam com Lead-only | Flag para voltar ao adaptador; nao trocar UUID/chave |
| Qualificacao | `db.contato` via `any` e possivel criacao de novo Lead | Atualizacao idempotente do Lead existente; tipagem Prisma real | Remover ramo de conversao e alias interno | Mesmo UUID antes/depois; teste cross-tenant e repeticao | Manter adaptador de entrada, nao recriar registro |
| Tools/prompts | Contratos mistos; prompt diz que IDs diferem | Adicionar/usar `leadId`, resolver alias na borda e medir consumidor | Retirar `contatoId` dos schemas e instrucoes | Telemetria zero, evals e testes de ownership | Reativar alias do adaptador por versao |
| Orquestrador | Presenca de `contatoId` influencia roteamento | Roteamento por estados/contexto explicito e `leadId` | Remover sinal implicito | Mesma selecao de agente em cenarios congelados | Flag de roteamento anterior com metrica |
| Redis/cache | Parametros chamados `contatoId`; chave usa UUID | Renomear sem mudar chave; se namespace mudar, dual-read/write | Retirar fallback apos maior TTL + observacao | Hits, misses e continuidade de conversa dentro do baseline | Voltar leitura antiga; manter escrita dupla durante janela |
| Historicos | MensagemProspeccao e Conversa separados por Lead | Validar FKs, contagens, ordenacao e messageId | Nenhuma fusao nesta onda | Checksums/contagens e amostra anonimizada | Nao apagar fonte; reprocessamento por mapping auditavel |
| Jobs/integracoes | Recontato, RAG e calendario propagam alias | Migrar payload interno para `leadId` mantendo borda compativel | Remover campos antigos | Jobs sem dead-letter novo e correlacao pelo mesmo UUID | Consumidor pode voltar a enviar alias ao adaptador |
| Campanhas REST | Persistem Lead em rotas `/contatos/:contatoId` | Respostas incluem `leadId` canonico; documentar deprecacao | Nova versao/rota remove alias conforme politica | Contract tests antigos e novos durante expand | Manter rotas antigas como facade |
| Frontend | Tipos `virouLead/leadId` simulam troca de entidade | Consumir `leadId` e tratar promocao como estado | Retirar campos e textos tecnicos obsoletos | Fluxos de campanha/detalhe preservam deep links | Feature flag ou compatibilidade de response |
| Testes/CI | Mocks de `prisma.contato` e cenarios ambiguos | Cobrir canonico + adapter, tenant, IDs divergentes e historico | Proibir padroes legados fora de allowlist | Gate vazio e suites aplicaveis verdes | Allowlist versionada, temporaria e com owner |

## Issues executaveis recomendadas

Os identificadores abaixo sao apenas rotulos de sequenciamento; nenhuma issue e
criada por este documento.

### I46-A — Baseline de dados e telemetria do alias

Escopo: consultar metadados/contagens por ambiente sem PII, definir owner,
instrumentar uso de `contatoId` por rota/tool/consumidor e publicar dashboard.

Aceite: baseline assinado; metrica sem UUID/telefone; alertas e janela de 30 dias
definidos. Dependencia: ADR aprovado.

### I46-B — Remover dependencias runtime bloqueantes

Escopo: substituir o SQL de `contatos` no webhook e o `db.contato` da
qualificacao por operacoes tenant-safe em Lead, sem mudar contratos externos.

Aceite: zero `prisma.contato`, `db.contato`, `FROM/JOIN contatos` em runtime;
UUID idempotente; testes negativos de tenant e smoke de inbound. Dependencia:
I46-A.

### I46-C — Canonicalizar tools, prompts e orquestracao

Escopo: `leadId` nos contratos canonicos, resolvedor de alias unico na borda,
rejeicao de valores divergentes e roteamento sem inferir entidade pelo nome do
ID.

Aceite: prompt nao ensina dois IDs; tools preservam ownership; uso legado e
mensuravel. Dependencias: I46-A e I46-B.

### I46-D — Migrar cache, historico e jobs sem perda de contexto

Escopo: renomear parametros internos, preservar chaves por UUID, aplicar
dual-read/write se houver novo namespace e migrar jobs/RAG/calendario.

Aceite: conversa atravessa deploy sem perder history/schema/agente; contagens de
mensagens reconciliadas; nenhum aumento de falhas de job. Dependencias: I46-B e
I46-C.

### I46-E — Deprecar contratos de campanhas e frontend

Escopo: expor `leadId` canonico, manter facade REST durante a janela e atualizar
tipos/textos para representar transicao de estado, nao criacao de entidade.

Aceite: deep links preservados; frontend nao depende de `virouLead` para inferir
identidade; contract tests cobrem as duas versoes. Dependencias: I46-C e I46-D.

### I46-F — Ativar testes de arquitetura e fitness gate

Escopo: substituir mocks antigos, criar allowlist temporaria de adapters e gate
CI para os padroes proibidos.

Aceite: zero falso positivo conhecido; toda excecao tem owner e data de remocao;
suite prova mismatch, tenant e UUID estavel. Dependencias: I46-B a I46-E.

### I46-G — Contrair aliases e legado persistente

Escopo: retirar `contatoId`, adapters e eventual tabela/FK legada depois da
auditoria. Migration de producao, se necessaria, deve ser issue propria com copia
anonimizada, backup e plano de rollback.

Aceite: 30 dias de uso zero, todos os consumidores confirmados, gate sem
allowlist, reconciliacao de dados aprovada e runbook de contract. Dependencias:
I46-A a I46-F.

## Telemetria e sinais operacionais

Metricas propostas, sem labels de alta cardinalidade ou PII:

- `legacy_contact_id_total{surface,consumer}`;
- `legacy_contact_id_mismatch_total{surface}`;
- `lead_identity_resolution_failure_total{surface,reason}`;
- taxa de hit/miss de cache e continuidade apos deploy;
- inbound processado/ignorado/duplicado no webhook;
- falhas e dead-letter de jobs por `leadId`;
- contagem de Lead e MensagemProspeccao por tenant/campanha antes/depois.

Abortar uma onda se houver mismatch de IDs, queda material de inbound, perda de
cache acima do baseline, violacao de tenant ou divergencia de contagens. UUIDs e
PII nao devem aparecer como labels.

## Preservacao e reconciliacao

Antes de qualquer migration posterior:

1. gerar backup verificavel e trabalhar em copia anonimizada;
2. congelar contagens por tenant/campanha/status e FKs de mensagens;
3. preservar UUID do Lead; usar mapping explicito somente para colisao;
4. validar zero orfaos e unicidade esperada;
5. comparar contagens e checksums agregados;
6. executar smoke de webhook, campanha, tool, cache e historico;
7. manter fonte legada ate o fim da janela de observacao.

Nao se deve correlacionar registros somente por telefone, CPF ou nome. Esses
campos podem apoiar revisao, mas nao substituir uma relacao auditavel e
tenant-safe.

## Rollback por fase

- Expand de contrato: reativar o adapter/flag e manter `leadId` persistido.
- Cache: voltar a ler o namespace anterior enquanto a escrita dupla estiver
  ativa; aguardar TTL antes de retirar qualquer lado.
- Runtime: reverter a aplicacao para a versao compativel, sem recriar Contato.
- Dados/schema: seguir migration e restore testados; rollback da aplicacao nao
  reverte dados automaticamente.
- Contract: nao iniciar se a janela de uso zero, backup, reconciliacao ou testes
  de upgrade nao estiverem aprovados.

## Gate final

A contracao so termina quando:

- nao ha consulta runtime a modelo/tabela Contato;
- `contatoId` nao aparece fora de historia/migrations arquivadas;
- telemetria registra zero uso por 30 dias;
- todos os contratos usam `leadId` e rejeitam acesso cross-tenant;
- cache e historicos mantem continuidade e contagens;
- fitness gate esta ativo;
- a data-alvo 2026-10-31 foi cumprida ou formalmente replanejada.
