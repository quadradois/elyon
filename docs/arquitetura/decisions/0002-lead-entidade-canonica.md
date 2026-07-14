# ADR-0002: Lead como entidade canonica do prospecto

Data: 2026-07-14

Estado: aceita

Issue: [#46](https://github.com/quadradois/elyon/issues/46)

## Contexto

O ELYON concluiu parte da unificacao estrutural de `Contato` e `Lead`. No schema
vigente, dados de prospeccao, qualificacao e operacao residem em `Lead`, e
`MensagemProspeccao` referencia `leadId`. Entretanto, o runtime ainda contem SQL
contra `contatos`, acesso a `db.contato`, contratos `contatoId`, chaves de cache e
interfaces que preservam a ideia de converter uma entidade Contato em Lead.

Essa divergencia faz o mesmo UUID assumir nomes e semanticas diferentes e cria
riscos de falha no webhook, perda de contexto conversacional e duplicacao de
registro. O [inventario da issue 46](../inventarios/issue-46-referencias-contato.md)
registra as evidencias. O
[mapa de migracao](../migracoes/issue-46-lead-canonico.md) divide a contracao em
mudancas executaveis posteriores.

Esta decisao trata identidade. O desenho detalhado das transicoes de estado, a
reescrita de componentes e a fusao dos dois armazenamentos de mensagens nao
fazem parte desta issue.

## Forcas da decisao

- Um prospecto precisa manter a mesma identidade da importacao/mineracao ao
  pos-captacao.
- O schema vigente ja concentra a jornada em `Lead`; reintroduzir `Contato`
  aumentaria divergencia e custo de migracao.
- Webhook, jobs, Redis e historicos nao podem perder correlacao durante a
  mudanca de nomes.
- Prospecção, status comercial e fase da conversa sao dimensoes distintas e nao
  devem ser comprimidas em um unico enum.
- Compatibilidade deve ser observavel, temporaria e removivel.

## Alternativas consideradas

### 1. Manter Contato e Lead separados

`Contato` representaria o prospecto frio e seria convertido em outro registro
`Lead` quando qualificado. A separacao torna o funil inicial explicito, mas exige
uma troca de identidade, sincronizacao de dados e dois caminhos de historico,
cache, autorizacao e deduplicacao. Tambem conflita com o schema atual.

Decisao: rejeitada. O custo operacional e o risco de inconsistência superam o
beneficio de representar estagio por troca de entidade.

### 2. Unificar a identidade em Lead e contrair contratos incrementalmente

Todo prospecto e um `Lead` desde a entrada. Prospecção fria e qualificacao sao
estados do mesmo agregado. Contratos antigos sao adaptados na borda por prazo
limitado, com migracao expand/contract e preservacao dos UUIDs e historicos.

Decisao: escolhida. E coerente com o schema vigente e permite remover a
ambiguidade sem uma virada destrutiva.

### 3. Separar identidade Prospect/Party de Opportunity

Uma entidade `Party` ou `Prospect` seria a identidade da pessoa e `Opportunity`
representaria cada oportunidade comercial. O modelo pode ser adequado quando o
produto precisar de multiplas oportunidades por pessoa, matching cross-campanha
ou uma visao mestre de cliente. Hoje ele adicionaria uma nova entidade, novas
chaves e uma migracao maior antes de estabilizar os contratos existentes.

Decisao: adiada. Pode substituir este ADR no futuro mediante evidencia de
multiplas oportunidades e um ADR proprio; nao e etapa da migracao atual.

## Decisao

1. `Lead` e a entidade persistente canonica de todo prospecto, desde
   mineracao/importacao ate captacao e pos-captacao.
2. `leadId` e o unico nome canonico do identificador em dominio, banco, webhook,
   tools, cache, historico, jobs, eventos e integracoes.
3. O UUID de um prospecto nao muda quando ele e qualificado ou captado. A acao
   hoje chamada de "promover/converter para Lead" passa, nas issues de
   implementacao, a significar transicao de estado do mesmo `Lead`.
4. Todo prospecto, qualificado ou nao, mantem a identidade `Lead.id`. No fluxo
   outbound atual, a participacao e o progresso na prospeccao ativa sao
   indicados por `statusProspeccao`, normalmente iniciado em `AGUARDANDO`. Um
   Lead manual ou inbound pode estar nao qualificado com esse campo nulo;
   portanto, `statusProspeccao` nao define qualificacao comercial. A semantica
   canonica de qualificacao sera definida na issue #47.
5. As dimensoes permanecem independentes:
   - `statusProspeccao`: elegibilidade e progresso da prospeccao ativa;
   - `status` (`StatusLead`): progresso comercial/CRM;
   - `Conversa.faseSPIN` e estado conversacional: progresso da conversa.
   Nenhuma dimensao deve ser inferida apenas da outra. O detalhamento de suas
   transicoes pertence a trabalho posterior e nao e decidido aqui.
6. `contato`, em texto de produto, pode continuar significando uma pessoa ou um
   ato de comunicacao. Ele nao designa modelo persistente nem identificador.
7. `MensagemProspeccao` e `Conversa/Mensagem` continuam como historicos
   distintos, ambos correlacionados pelo mesmo `leadId`. Este ADR nao determina
   sua fusao.

## Politica temporaria para `contatoId`

`contatoId` pode existir somente em adaptadores de borda de contratos ja
publicados. O adaptador deve:

- resolver `contatoId` ou `leadId` somente dentro do tenant derivado da
  autenticacao ou de contexto interno confiavel; `tenantId` fornecido pelo
  consumidor nunca amplia esse escopo;
- rejeitar e auditar, sem PII, identificadores pertencentes a outro tenant;
- preferir `leadId` quando apenas ele for enviado;
- mapear `contatoId` para `leadId` sem criar ou trocar UUID;
- quando ambos forem enviados, aceitar somente valores identicos e rejeitar
  divergencia;
- propagar internamente apenas `leadId`;
- emitir metrica por consumidor/rota/tool, sem registrar PII;
- documentar deprecacao no contrato.

Novos contratos nao podem introduzir `contatoId`. A data-alvo de remocao e
2026-10-31, condicionada a zero uso por 30 dias, migracao de todos os
consumidores conhecidos e aprovacao do gate de contracao. Se esses criterios nao
forem atendidos, a data deve ser revista explicitamente; o alias nao se torna
permanente por omissao.

## Preservacao de identidade, historico e cache

- Registros que ja sao `Lead` mantem o UUID atual.
- Antes de qualquer contracao de banco, uma auditoria deve comparar contagens e
  detectar eventual tabela `contatos` ainda existente em ambientes atualizados.
- Se houver linhas legadas sem `Lead`, a migracao posterior deve criar o `Lead`
  preservando o UUID quando nao houver colisao. Colisoes exigem uma tabela de
  mapeamento auditavel `legacyContatoId -> leadId`; nunca uma associacao por nome
  ou telefone apenas.
- FKs e historicos sao migrados com reconciliacao por contagem e amostragem
  anonimizada. Migrations historicas permanecem imutaveis.
- As chaves Redis existentes usam o UUID sem tipo embutido
  (`elyon:conv:<uuid>` e `elyon:agent:<uuid>`). Quando esse UUID ja e o do Lead,
  renomear o parametro nao pode alterar a chave. Uma mudanca de namespace deve
  usar dual-read/dual-write por no minimo o maior TTL vigente (24 horas), seguida
  de observacao antes da retirada do fallback.

## Estrategia expand/contract

### Expand

1. Medir aliases e introduzir um resolvedor unico na borda.
2. Fazer caminhos runtime consultarem `Lead` por `leadId`, preservando respostas
   e rotas antigas por adaptacao.
3. Migrar tools, prompts, jobs, cache e consumidores REST para `leadId`.
4. Atualizar testes para provar UUID estavel, isolamento por tenant, rejeicao de
   IDs divergentes e preservacao de historico.

### Contract

1. Exigir zero uso observado de `contatoId` por 30 dias.
2. Remover aliases, SQL/tipos legados e semantica de conversao entre entidades.
3. Remover estrutura de banco legada somente apos backup, reconciliacao e teste
   de upgrade/rollback em copia anonimizada.
4. Ativar gate que proiba novas dependencias.

## Fitness functions e gates

O gate minimo de contracao deve falhar se codigo runtime introduzir:

```text
prisma.contato
db.contato
FROM contatos
JOIN contatos
```

Apos a retirada dos adaptadores, `contatoId` tambem deve ser proibido em runtime.
Durante a compatibilidade, uma allowlist pequena e explicita deve limitar o termo
aos adaptadores aprovados. O CI posterior deve executar busca equivalente a:

```bash
rg -n -i 'prisma\.contato|db\.contato|FROM\s+"?contatos|JOIN\s+"?contatos' pacotes/backend/src
rg -n '\bcontatoId\b' pacotes/backend/src pacotes/frontend/src
```

O primeiro comando deve retornar vazio; o segundo deve retornar apenas itens da
allowlist durante o expand e vazio apos o contract.

## Consequencias

### Positivas

- Identidade estavel e um unico nome de ID em toda a jornada.
- Menos joins, conversoes, caches duplicados e falhas por usar o UUID errado.
- O estado de prospeccao pode evoluir sem duplicar a pessoa.
- O schema atual e ratificado em vez de revertido.

### Negativas e riscos

- `Lead` passa a cobrir uma jornada ampla e exige limites claros entre
  prospeccao, CRM e conversa para nao se tornar um agregado sem fronteiras.
- A compatibilidade temporaria aumenta complexidade e precisa de owner e prazo.
- Contratos REST e UI com a palavra "contato" nao desaparecem imediatamente.
- Uma contracao prematura pode quebrar webhook, tools e conversas em andamento.
- Unicidade e deduplicacao cross-campanha continuam sendo regras de negocio a
  validar nas issues de implementacao; este ADR nao altera constraints.

## Rollout e rollback

Este PR nao possui rollout funcional. Depois da aprovacao, cada issue de
implementacao deve ter flag/adaptador reversivel, telemetria e criterio de
abortagem conforme o mapa de migracao.

Antes do contract, rollback significa reativar leitura do alias e o caminho
anterior sem desfazer dados canonicos. Depois de alteracao estrutural, rollback
exige restaurar a aplicacao compativel e seguir o plano especifico da migration;
rollback de aplicacao nao implica reversao automatica de schema. Se a decisao
for rejeitada antes da implementacao, este ADR deve ser marcado `rejeitada` ou
`substituida` por outro ADR, sem alterar runtime.
