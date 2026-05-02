# 07 - Revisao Do Estado Atual Do Git

Data: 2026-05-02  
Escopo: fotografia do worktree antes de implementar os P0 do RAIO-X IA.  
Modo: analise e recomendacao; sem alteracao de backend/frontend.

## Resumo Executivo

O repositorio esta em `main...origin/main`, sem alteracoes staged, mas com worktree significativamente sujo: 48 arquivos rastreados modificados, 2397 insercoes e 2870 delecoes. As mudancas existentes nao se limitam a documentacao; elas incluem schema Prisma, backend, frontend, jobs, rotas e arquivos diretamente relacionados aos P0.

Recomendacao: **nao implementar P0 por cima deste estado sem antes estabilizar ou isolar as mudancas existentes**. O risco de misturar auditoria/P0 com uma refatoracao ampla `Contato -> Lead` e alto.

## Fatos Verificados

| Item | Evidencia |
|---|---|
| Branch atual | `main...origin/main` em `git status -sb`. |
| Staging area | Sem arquivos staged (`git diff --cached --stat` sem saida). |
| Tamanho do diff rastreado | 48 arquivos, 2397 insercoes, 2870 delecoes (`git diff --shortstat`). |
| Backend rastreado | 37 arquivos modificados em `pacotes/backend`. |
| Frontend rastreado | 9 arquivos modificados em `pacotes/frontend`. |
| Docs rastreados fora do RAIO-X | 2 arquivos modificados em `docs/planos`. |
| Docs RAIO-X | Pasta `docs/RAIO X IA/` nao rastreada, criada para esta demanda. |
| Arquivos untracked adicionais | Relatorio na raiz, guias/operacao em `docs`, hook e formatter no frontend. |
| Check de whitespace | `git diff --check` falhou por trailing whitespace em `pacotes/backend/src/jobs/recontato-automatico.ts:164`. |
| Verificacao backend | `npm --workspace @elyon/backend run verificar` falhou no TypeScript. |

## Falha De Verificacao Backend

Comando executado:

```bash
npm --workspace @elyon/backend run verificar
```

Resultado:

- Falhou no `tsc -p tsconfig.build.json --noEmit`.
- O ESLint nao chegou a rodar, porque o TypeScript falhou antes.
- Erros reportados em `src/agentes_bak_pre_sdr_20260411_155803`.

Erros principais:

```text
src/agentes_bak_pre_sdr_20260411_155803/elyon-core.ts: Property 'contato' does not exist...
src/agentes_bak_pre_sdr_20260411_155803/elyon-core.ts: 'contatoId' does not exist in type 'ConverterParaLeadInput'.
src/agentes_bak_pre_sdr_20260411_155803/orchestrator-queries.ts: Property 'contato' does not exist...
```

Observacao importante: a pasta `pacotes/backend/src/agentes_bak_pre_sdr_20260411_155803` esta ignorada por `.gitignore` via padrao `*_bak_*`, mas existe localmente e ainda entra no `tsconfig.build.json`. O `tsconfig.json` foi alterado para excluir essa pasta, mas `tsconfig.build.json` define seu proprio `exclude` e, por isso, nao herda essa exclusao.

## Achados Por Severidade

### Critico - Worktree Nao Esta Seguro Para Implementacao P0 Imediata

O diff atual ja altera arquivos diretamente envolvidos nos P0, incluindo:

- `pacotes/backend/prisma/schema.prisma`
- `pacotes/backend/src/agentes/orchestrator-queries.ts`
- `pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts`
- `pacotes/backend/src/casos-de-uso/agentes/registrar-optout.usecase.ts`
- `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- testes de use cases relacionados

Impacto: implementar P0 agora misturaria auditoria/correcao com uma refatoracao ampla ja existente, dificultando rollback, review, teste e atribuicao de responsabilidade.

### Alto - Refatoracao `Contato -> Lead` Parece Parcial

O schema remove o modelo `Contato` e migra `MensagemProspeccao` para `leadId`, mas ainda existem usos ou contratos remanescentes de `contatoId` e `db.contato`.

Evidencias:

- `pacotes/backend/prisma/schema.prisma` remove `model Contato` no diff atual.
- `pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:122` ainda usa `db.contato.findUnique`.
- `pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:226` ainda usa `db.contato.update`.
- `rg` encontrou 205 ocorrencias de `contatoId` em agentes/tools/use cases do escopo consultado.

Impacto: mesmo se TypeScript nao capturar tudo por causa de casts `any`, ha risco de falha em runtime quando um fluxo chamar qualificacao.

### Alto - Testes Parecem Parcialmente Adaptados

Alguns testes tiveram input renomeado de `contatoId` para `leadId`, mas ainda ha mocks/expectativas com `mockPrisma.contato` em arquivos de teste.

Evidencias:

- `converter-para-lead.usecase.test.ts` renomeia chamadas para `leadId`, mas ainda possui referencias a `mockPrisma.contato` no arquivo atual.
- `registrar-optout.usecase.test.ts` renomeia input para `leadId`, mas ainda possui mocks/expectativas antigas em trechos do arquivo atual.
- `qualificar-lead.usecase.test.ts` segue baseado em `mockPrisma.contato`.

Impacto: a suite pode passar parcialmente por mocks desalinhados ou falhar quando rodada integralmente, mascarando riscos dos P0.

### Medio - Build Local Bloqueado Por Pasta Backup Ignorada

A verificacao falha por arquivos em pasta local ignorada (`*_bak_*`). Isso pode nao quebrar CI em clone limpo, mas quebra a verificacao local e cria ruido antes de qualquer implementacao.

Evidencia:

- `.gitignore:51` ignora `*_bak_*`.
- `tsconfig.build.json` nao exclui `src/agentes_bak_pre_sdr_20260411_155803`.
- `npm --workspace @elyon/backend run verificar` falha nessa pasta.

Impacto: nao conseguimos afirmar que o backend principal compila enquanto essa falha bloqueia o check.

### Baixo - Whitespace Pendente

`git diff --check` encontrou trailing whitespace em:

- `pacotes/backend/src/jobs/recontato-automatico.ts:164`

Impacto: pequeno, mas pode falhar gates de qualidade dependendo do CI.

## Hipoteses / Inferencias

| Hipotese | Base | Confianca |
|---|---|---|
| Existe uma refatoracao em andamento para unificar `Contato` dentro de `Lead`. | Schema remove `Contato`; rotas/jobs/frontend foram alterados para `Lead`. | Alta |
| Parte dos P0 ja foi atacada antes desta auditoria, mas sem fechamento completo. | `converter_para_lead`, `registrar_optout`, follow-up e handoff foram alterados para `leadId`. | Alta |
| O RAIO-X feito ate agora observou o worktree sujo, nao necessariamente `origin/main` limpo. | A auditoria leu arquivos locais atuais. | Alta |
| A proxima etapa correta e estabilizacao/isolamento, nao feature nova. | Volume e natureza do diff. | Alta |

## Recomendacao Operacional

1. Nao implementar P0 ainda no worktree atual.
2. Decidir se a refatoracao `Contato -> Lead` atual e intencional e deve ser preservada.
3. Se for intencional, estabilizar essa refatoracao primeiro em uma branch propria.
4. Se nao for intencional, separar ou descartar somente com autorizacao explicita do responsavel.
5. Depois de estabilizar, reexecutar `npm --workspace @elyon/backend run verificar`.
6. So entao iniciar os P0, idealmente em PRs pequenos.

## Caminho Recomendado A Partir Daqui

### Opcao A - Preservar E Estabilizar Mudancas Atuais

Usar quando as mudancas atuais pertencem a uma refatoracao real em andamento.

Passos:

1. Criar branch dedicada para o estado atual.
2. Resolver build local bloqueado pela pasta backup ou ajustar `tsconfig.build.json`.
3. Fechar a migracao `Contato -> Lead` nos pontos remanescentes.
4. Rodar verificacao backend e testes dos fluxos de prospeccao.
5. So depois aplicar P0 formalmente.

### Opcao B - Criar Worktree Limpo Para P0

Usar quando queremos implementar P0 sem depender da refatoracao atual.

Passos:

1. Criar worktree novo a partir de `origin/main` ou `main` limpo.
2. Copiar apenas a documentacao RAIO-X se necessario.
3. Implementar P0 em branch limpa.
4. Comparar depois com a refatoracao `Contato -> Lead` para evitar conflito.

### Opcao C - Fazer Code Review Da Refatoracao Atual

Usar quando precisamos entender se o diff existente e aproveitavel antes de decidir.

Passos:

1. Revisar schema Prisma e rotas de campanha/proprietarios.
2. Revisar use cases dos agentes afetados.
3. Revisar frontend para compatibilidade de API.
4. Rodar testes direcionados apos liberar o build.
5. Produzir lista de correcoes para completar a migracao.

## Decisao Recomendada

Recomendacao atual: **Opcao C primeiro, depois Opcao A ou B**.

Motivo: o estado atual ja mexe exatamente no problema central dos P0. Antes de abrir implementacao nova, vale descobrir se esse diff e uma solucao parcial que devemos completar ou um trabalho paralelo que devemos isolar.
