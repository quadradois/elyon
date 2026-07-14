# Inventario tecnico: referencias legadas de Contato

Data da coleta: 2026-07-14

Baseline: `origin/main` em `8828e9b`

Issue: [#46](https://github.com/quadradois/elyon/issues/46)

## Escopo e metodo

Este inventario classifica referencias a `Contato`, `contatoId`, tabela
`contatos`, `virouLead` e a relacao de conversao. `leadId` canonico nao e uma
ocorrencia legada por si so; ele foi inspecionado quando coexistia com esses
termos ou representava o antigo destino de conversao.

Buscas reproduziveis, executadas da raiz do repositorio:

```bash
rg -n -i --hidden \
  -g '!.git/**' -g '!node_modules/**' -g '!dist/**' -g '!coverage/**' \
  -g '!graphify-out/**' -g '!.agents/**' -g '!.specify/**' \
  'prisma\.contato|db\.contato|FROM\s+"?contatos|JOIN\s+"?contatos|\bcontatoId\b|\bvirouLead\b' .

rg -n -C 3 \
  'contatoId|leadId|virouLead|statusProspeccao|prisma\.lead|MensagemProspeccao' \
  pacotes/backend/src/rotas/campanhas/contatos.rotas.ts \
  pacotes/backend/src/rotas/webhook.ts \
  pacotes/backend/src/ferramentas/sdr-tools-agents.ts \
  pacotes/backend/src/agentes/sdr-agent.ts
```

Arquivos gerados, dependencias, `.git`, `graphify-out`, configuracao local de
agentes e Spec Kit nao participaram da contagem. A classificacao e semantica:
nem todo uso da palavra "contato" representa o modelo removido.

## Evidencia canonica do schema

- `pacotes/backend/prisma/schema.prisma` nao declara `model Contato`.
- `Lead` possui `campanhaOrigemId`, `statusProspeccao`, `tentativasContato`,
  `ultimaTentativa`, `modoAtendimento`, recontato e dados de qualificacao.
- `MensagemProspeccao.leadId` referencia `Lead` com `onDelete: Cascade`.
- `Conversa.leadId` tambem referencia `Lead`.
- Campanhas e o servico de disparo consultam `prisma.lead`; os endpoints ainda
  apresentam o registro como "contato" e calculam `virouLead` a partir de
  `statusProspeccao === null`.

Conclusao: a persistencia canonica ja e `Lead`; o repositorio esta em uma fase de
contracao incompleta de nomes, contratos e dois caminhos runtime invalidos.

## Resumo por classificacao

| Classe | Evidencia | Avaliacao |
|---|---|---|
| Runtime bloqueante | SQL `FROM contatos` no webhook; `db.contato` no `QualificarLeadUseCase` | Pode falhar contra o schema atual e recriar a conversao entre entidades |
| Compatibilidade transitoria | `contatoId` em tools, orquestrador, cache, rotas de campanha e frontend | Em muitos pontos o valor ja e o UUID do Lead, mas o nome perpetua ambiguidade |
| Teste desatualizado | mocks `prisma.contato`, payloads `contatoId` e cenarios `virouLead` | Congela o modelo anterior e pode dar falsa cobertura |
| Documentacao historica | relatorios, raio-x, planos e changelog | Evidencia de evolucao; nao deve ser tratada como runtime nem reescrita em massa |
| Arquivo morto/backup | scripts avulsos, schema backup e fragmento Prisma antigo | Nao compoe o runtime principal, mas pode ser executado acidentalmente |

## Runtime bloqueante

| Componente | Evidencia observada | Risco | Contracao esperada |
|---|---|---|---|
| `pacotes/backend/src/rotas/webhook.ts` | duas queries raw usam `FROM contatos c`; o restante do fluxo atualiza `prisma.lead` e ainda tenta ler `contatoProspeccao.leadId` | Consulta a tabela ausente, ramo incoerente e perda de inbound | Consultar Lead por telefone/tenant/status e propagar somente `leadId` |
| `pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts` | aceita `contatoId`, usa Prisma como `any`, chama `db.contato.findUnique/update` e pode criar outro Lead | Falha runtime, bypass de tipagem e duplicacao de identidade | Operar idempotentemente sobre o Lead existente |

Esses dois itens devem ser corrigidos antes de retirar qualquer adaptador, mas
nao foram alterados nesta issue documental.

## Compatibilidade transitoria em runtime

### Tools e prompts

- `sdr-tools-agents.ts`: `qualificar_lead` e `converter_para_lead` aceitam os dois
  nomes; `registrar_optout`, `agendar_followup`, `encaminhar_corretor`,
  `agendar_reuniao_closer` e `enviar_link_agendamento` ainda expõem
  `contatoId`, embora consultem ou atualizem `Lead`.
- `sdr-agent.ts`: injeta `ID_DO_LEAD` e `ID_DO_CONTATO`, afirma que sao IDs
  diferentes e orienta tools diferentes a usar cada um. Isso contradiz o schema
  unificado.
- `tool-wrapper.ts` e casos de uso relacionados propagam o alias em contratos
  internos.

### Webhook, orquestracao, cache e jobs

- O webhook usa `contatoId` em debounce, cooldown, mutex, idempotencia, logs,
  persistencia de mensagem e contexto do orquestrador.
- `orchestrator.ts` e sua cadeia usam a presenca de `contatoId` como sinal de
  roteamento e chave de historico.
- `conversation-cache.ts` nomeia todos os parametros `contatoId`, mas as chaves
  Redis sao `elyon:conv:<uuid>` e `elyon:agent:<uuid>`. O namespace nao codifica
  o tipo; quando o UUID ja e do Lead, a renomeacao pode preservar a chave.
- Jobs de reengajamento/recontato e servicos de RAG/Google Calendar carregam o
  mesmo alias.

Arquivos runtime backend encontrados pela busca (38):

```text
pacotes/backend/src/agentes/{agent-chain,agent-runner,context-builder,conversation-cache,elyon-context,elyon-core,entry-guardrail,guardrails,history-persistence,input-builder,orchestrator,orchestrator-metrics,orchestrator-queries,persisted-agent,post-handoff,sdr-agent,telemetria-agente}.ts
pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts
pacotes/backend/src/ferramentas/{sdr-tools-agents,tool-wrapper}.ts
pacotes/backend/src/jobs/{conversas-inativas,job-reengajamento,recontato-automatico}.ts
pacotes/backend/src/lib/redis-cache.ts
pacotes/backend/src/modulos/webhook/dominio/politicas-resposta.ts
pacotes/backend/src/rotas/campanhas/{contatos.rotas,index,mensagens.rotas}.ts
pacotes/backend/src/rotas/{contatos,leads,listas,proprietarios,webhook,webhook-resilience}.ts
pacotes/backend/src/servicos/{disparo-campanha,google-calendar,rag-conversas,webhook-utils}.ts
```

Observacao: `listas.ts` contem `prisma.contatoLista`, que e outro modelo; a
ocorrencia nao autoriza renomea-lo. A lista registra arquivos atingidos pelo
padrao agregado, enquanto as tabelas acima identificam as dependencias
arquiteturais reais.

### Campanhas e frontend

`campanhas/contatos.rotas.ts` ja persiste `Lead`, mas preserva rotas
`/contatos/:contatoId`, nomes locais e respostas `virouLead/leadId`. A operacao
"promover" apenas define `statusProspeccao = null` no mesmo UUID. O frontend
continua apresentando a operacao como conversao entre registros.

Arquivos frontend encontrados (8):

```text
pacotes/frontend/src/App.tsx
pacotes/frontend/src/ganchos/useProprietarios.ts
pacotes/frontend/src/paginas/ContatoDetalhes.tsx
pacotes/frontend/src/paginas/detalhes-campanha/abas/AbaContatos.tsx
pacotes/frontend/src/paginas/detalhes-campanha/CampanhaDetalhes.tsx
pacotes/frontend/src/paginas/detalhes-campanha/hooks/useCampanhaDetalhes.ts
pacotes/frontend/src/paginas/ListaDetalhes.tsx
pacotes/frontend/src/paginas/ProprietarioDetalhes/index.tsx
```

Esses contratos sao compatibilidade, nao evidencia de uma tabela `Contato`.
Devem migrar depois dos bloqueios runtime e com adaptacao de borda.

## Testes desatualizados

Quinze arquivos de teste foram encontrados. O caso mais critico e
`qualificar-lead.usecase.test.ts`, com mocks e expectativas de
`mockPrisma.contato.findUnique/update`. Os demais cobrem orquestracao e webhook
com `contatoId`; alguns podem permanecer temporariamente como testes de
compatibilidade, desde que tambem provem o caminho canonico e a rejeicao de IDs
divergentes.

```text
pacotes/backend/src/agentes/__tests__/{agent-runner,context-builder,entry-guardrail,google-calendar,gov-05-ivonet-regression.e2e,orchestrator-integration,orchestrator-metrics,orchestrator-queries,output-extraction,persisted-agent,post-handoff}.test.ts
pacotes/backend/src/casos-de-uso/agentes/__tests__/qualificar-lead.usecase.test.ts
pacotes/backend/src/ferramentas/__tests__/sdr-tools-ownership.test.ts
pacotes/backend/src/rotas/__tests__/webhook-resilience.test.ts
pacotes/backend/test/integration/infra.integration.test.ts
```

## Documentacao e migrations historicas

Foram encontrados 22 documentos historicos, principalmente em
`docs/RAIO X IA/`, `docs/raio-x/`, planos, playbooks, `CHANGELOG.md` e
`RELATORIO_VIABILIDADE_UNIFICACAO_LEAD_CONTATO.md`. Eles registram estados
anteriores, inclusive quando `Contato` ainda existia, e nao devem ser usados
como prova do runtime atual. Permanecem imutaveis, salvo rotulo futuro de
obsolescencia se necessario.

Tres migrations em `prisma/migrations_legacy_pre_20260714/` preservam a historia
de `contatos`, `contatoId` e conversao. Sao registros de banco arquivados e nao
devem ser reescritos:

```text
20251128141218_adicionar_campanha_contato/migration.sql
20251202194627_adicionar_mensagens_prospeccao/migration.sql
20260517010000_unificacao_lead_contato/migration.sql
```

## Arquivos mortos, backups e scripts avulsos

Estes arquivos nao ficam sob `pacotes/backend/src`, mas referenciam o modelo
antigo e podem falhar ou causar dano se executados contra o schema atual:

```text
corrigir-contato.js
corrigir-dados-imovel.js
migrar-js.js
sincronizar-contatos-assertiva.js
test_kimi.js
pacotes/backend/{atualizar-contatos-prefeitura.js,atualizar-contatos-telefones.js,buscar-proprietario.js,check.mts,check-contato.js,get_lead.ts,limpar-lead.mts,reset.mts,verificar-cache.js,vincular-contatos-campanha.js}
pacotes/backend/scripts/{atualizar-contatos-assertiva.ts,atualizar-dados-imovel-contatos.ts,verificar-listas.ts}
pacotes/backend/prisma/campanha-contato-models.prisma
pacotes/backend/prisma/schema.prisma.backup
```

Sua remocao ou arquivamento exige issue propria e verificacao de ownership; nao
foi realizado nesta issue.

## Dados e contratos a preservar

| Ativo | Chave canonica | Regra de preservacao |
|---|---|---|
| Lead e dados de prospeccao/qualificacao | `Lead.id` | Manter UUID e tenant; nao recriar registro ao qualificar |
| Mensagens de prospeccao | `MensagemProspeccao.leadId` | Preservar ordem, direcao, messageId e metadados |
| Conversas e mensagens CRM | `Conversa.leadId` | Manter separado de MensagemProspeccao nesta decisao |
| Redis de historico/schema/agente | UUID do Lead | Preservar chave quando o UUID e igual; dual-read se namespace mudar |
| Campanha e metricas | `campanhaOrigemId` + `statusProspeccao` | Reconciliar contagens antes/depois |
| REST/tools legados | alias `contatoId` | Adaptar na borda, medir uso, rejeitar divergencia, remover ate o gate |
| Migrations e relatorios historicos | caminho/commit | Nao reescrever historia |

## Lacunas que bloqueiam a contracao

1. Nao existe telemetria central de uso do alias por consumidor.
2. O webhook ainda mistura query de tabela removida com operacoes em Lead.
3. A qualificacao ainda pode tentar criar um segundo Lead.
4. Tools e prompt ensinam que dois IDs diferentes sao necessarios.
5. Testes nao distinguem caminho canonico de compatibilidade.
6. Nao existe gate versionado contra a reintroducao de dependencias legadas.
7. A existencia e o volume de `contatos` em cada ambiente implantado precisam ser
   medidos antes de qualquer contract de banco.
