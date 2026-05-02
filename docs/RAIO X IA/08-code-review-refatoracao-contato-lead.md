# 08 - Code Review Da Refatoracao `Contato -> Lead`

Data: 2026-05-02  
Escopo: revisao tecnica do diff atual que remove/absorve `Contato` em `Lead`.  
Modo: code review e recomendacao; sem alteracao de backend/frontend.

## Veredito Executivo

**No-Go para merge/deploy da refatoracao atual.**

O diff atual parece tentar uma unificacao ampla `Contato -> Lead`, aproximando-se da abordagem de big bang que o relatorio existente de viabilidade ja classificava como nao recomendada sem aprovacao. A direcao arquitetural pode ser valida no longo prazo, mas o estado atual esta parcial: schema Prisma valido, frontend buildando, porem fluxo de webhook ainda consulta tabela removida, use cases de agente estao em contratos divergentes, testes direcionados falham e a verificacao padrao do backend esta bloqueada por pasta backup local.

Recomendacao: **nao implementar P0 em cima deste worktree como se estivesse estavel**. Primeiro decidir explicitamente se vamos completar esta refatoracao como epico proprio ou isolar os P0 em worktree limpo.

## Checks Executados

| Check | Resultado | Observacao |
|---|---|---|
| `npx tsc -p pacotes/backend/tsconfig.json --noEmit --pretty false` | Passou | O `tsconfig.json` exclui a pasta backup. |
| `npm --workspace @elyon/backend run verificar` | Falhou | `tsconfig.build.json` compila `src/agentes_bak_pre_sdr_20260411_155803`. |
| Testes direcionados de use cases dos agentes | Falharam | 4 suites falharam, 17 testes falharam, 1 suite passou. |
| `npm --workspace @elyon/frontend run build` | Passou com warnings | Warnings de chunk grande e import dinamico inefetivo. |
| `npm --workspace @elyon/backend exec prisma -- validate --schema prisma/schema.prisma` | Passou | Schema Prisma local e valido. |
| `git diff --check` | Falhou | Trailing whitespace em `pacotes/backend/src/jobs/recontato-automatico.ts:164`. |

## Findings

### Critico - Webhook Ainda Consulta A Tabela Removida `contatos`

Evidencia:

- `/root/elyon/pacotes/backend/prisma/schema.prisma:594` remove o modelo `Contato` e migra `MensagemProspeccao` para `leadId`.
- `/root/elyon/pacotes/backend/src/rotas/webhook.ts:447` ainda usa `FROM contatos c`.
- `/root/elyon/pacotes/backend/src/rotas/webhook.ts:448` ainda faz join por `c."campanhaId"`.
- `/root/elyon/pacotes/backend/src/rotas/webhook.ts:451` ainda faz join por `c."leadId"`.
- O mesmo padrao aparece novamente em `/root/elyon/pacotes/backend/src/rotas/webhook.ts:486`.

Impacto:

- Em banco migrado sem tabela `contatos`, o inbound WhatsApp tende a cair no `catch` e usar fallback.
- O fallback usa `prisma.lead.findFirst`, mas perde a priorizacao e parte do shape esperado pelo caminho raw.
- Como o webhook e o ponto de entrada da conversa, isso pode quebrar atendimento antes do agente rodar.

Recomendacao:

- Bloquear deploy ate remover ou adaptar o SQL raw para `leads`.
- Garantir que o objeto retornado tenha shape consistente com o restante do webhook.

### Critico - Shape Retornado Pelo Raw Query Diverge Do Restante Do Webhook

Evidencia:

- `/root/elyon/pacotes/backend/src/rotas/webhook.ts:520` retorna propriedade `campanha` no objeto montado manualmente.
- Depois, o fluxo usa `contatoProspeccao.campanhaOrigemId` em `/root/elyon/pacotes/backend/src/rotas/webhook.ts:1594`.
- O fluxo usa `contatoProspeccao.campanhaOrigem?.tenantId` em `/root/elyon/pacotes/backend/src/rotas/webhook.ts:1602`.
- O fluxo usa `contatoProspeccao.campanhaOrigem?.empreendimento` em `/root/elyon/pacotes/backend/src/rotas/webhook.ts:1829`.

Impacto:

- Mesmo se a tabela `contatos` ainda existisse, o caminho raw pode retornar `campanha`, mas o restante do codigo espera `campanhaOrigem`.
- Isso pode gerar falso `sem_campanha_vinculada`, tenant vazio, perda de RAG e roteamento incorreto.

Recomendacao:

- Padronizar o retorno de `buscarContatoProspeccao` para sempre representar um `Lead` de prospeccao com `campanhaOrigem`.
- Evitar dois shapes possiveis para o mesmo objeto.

### Critico - `qualificar_lead` Ainda Depende De `db.contato`

Evidencia:

- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:122` usa `db.contato.findUnique`.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:181` verifica `contato.leadId`.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:194` usa `contato.campanhaId`.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:226` usa `db.contato.update` e campos `virouLead`, `leadId`, `virouLeadEm`.

Impacto:

- No schema unificado, `Contato` nao existe mais.
- Como o arquivo usa `const db: any = prisma`, o TypeScript nao captura a quebra.
- Em runtime, a tool `qualificar_lead` pode falhar quando chamada pelo agente.

Recomendacao:

- Refatorar `QualificarLeadUseCase` para operar sobre `Lead` de prospeccao.
- Remover `any` onde ele mascara o erro de schema.
- Atualizar testes para refletir o contrato real.

### Alto - Tool Schemas Continuam Expondo `contatoId`, Mas Use Cases Migraram Para `leadId`

Evidencia:

- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:110` define `qualificar_lead.parameters.contatoId`.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:231` define `registrar_optout.parameters.contatoId` e depois passa `leadId: args.contatoId` em `:245`.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:264` define `converter_para_lead.parameters.contatoId`, mas `ConverterParaLeadInput` agora espera `leadId` em `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts:5`.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:326` e `:353` repetem o mesmo alias para follow-up e handoff.

Impacto:

- O modelo continua sendo instruido a enviar `contatoId`, mas o backend interpreta isso como `leadId` em alguns casos.
- Isso preserva compatibilidade superficial, mas aumenta risco de confusao, logging incorreto e validação errada.
- O P0 de identidade (`contatoId` vs `leadId`) ainda nao esta resolvido conceitualmente.

Recomendacao:

- Escolher contrato canonico: `leadId` se a entidade raiz agora e `Lead`.
- Manter alias `contatoId` apenas como camada temporaria explicitamente documentada, nao como schema principal da tool.

### Alto - Prompt Do SDR Contradiz A Nova Semantica Unificada

Evidencia:

- `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:519` injeta `ID_DO_LEAD`.
- `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:520` injeta `ID_DO_CONTATO`.
- `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:523` orienta `agendar_reuniao_closer` a usar `contatoId`.
- `/root/elyon/pacotes/backend/src/agentes/sdr-agent.ts:527` diz: `NUNCA coloque o leadId no campo contatoId — são IDs diferentes!`.

Impacto:

- No modelo unificado, o proprio diff passa `leadId: args.contatoId` em varias tools.
- A instrucao do prompt entra em conflito com a implementacao atual.
- O agente pode evitar chamar tools corretamente ou usar `N/A` como `contatoId` em contextos onde so existe `leadId`.

Recomendacao:

- Reescrever a secao de IDs apos decisao arquitetural.
- Se a unificacao continuar, `LeadId` deve ser a chave primaria das tools de prospeccao.

### Alto - Testes Direcionados Dos Use Cases Estao Desalinhados

Comando:

```bash
npm --workspace @elyon/backend test -- --runTestsByPath src/casos-de-uso/agentes/__tests__/converter-para-lead.usecase.test.ts src/casos-de-uso/agentes/__tests__/qualificar-lead.usecase.test.ts src/casos-de-uso/agentes/__tests__/registrar-optout.usecase.test.ts src/casos-de-uso/agentes/__tests__/agendar-followup.usecase.test.ts src/casos-de-uso/agentes/__tests__/encaminhar-corretor.usecase.test.ts --runInBand
```

Resultado:

- 5 suites executadas.
- 4 suites falharam.
- 1 suite passou.
- 28 testes no total.
- 17 testes falharam.
- 11 testes passaram.

Falhas representativas:

- `converter-para-lead.usecase.test.ts`: ainda espera criacao/relacao `Contato -> Lead`, mas o use case agora promove o proprio `Lead`.
- `encaminhar-corretor.usecase.test.ts`: mocks nao definem `prisma.lead.findUnique`, gerando `db_1.prisma.lead.findUnique is not a function`.
- `agendar-followup.usecase.test.ts`: mocks ainda esperam `prisma.contato.update`, mas o use case chama `prisma.lead.update`.
- `registrar-optout.usecase.test.ts`: expectativas ainda verificam fallback antigo `Contato -> Lead`.

Impacto:

- A suite nao oferece confianca para validar P0.
- Existe risco de falso senso de seguranca se apenas `tsc` for usado como gate.

Recomendacao:

- Atualizar testes junto com a decisao de contrato.
- Adicionar testes de runtime para `qualificar_lead`, porque o TypeScript nao pega o `db: any`.

### Alto - Acao "Remover Lead" Agora Deleta O Proprio Registro De Prospecção

Evidencia:

- `/root/elyon/pacotes/backend/src/rotas/campanhas/contatos.rotas.ts:440` documenta: remover lead associado e restaurar contato como prospect.
- `/root/elyon/pacotes/backend/src/rotas/campanhas/contatos.rotas.ts:455` chama `cascadeDeleteLeads([contatoId])`.
- `/root/elyon/pacotes/frontend/src/paginas/detalhes-campanha/abas/AbaContatos.tsx:139` mostra `Lead removido. Contato restaurado como prospect.`
- `/root/elyon/pacotes/frontend/src/paginas/detalhes-campanha/abas/AbaContatos.tsx:563` exibe acao `Remover Lead` quando `contato.virouLead`.

Impacto:

- Antes, remover o lead restaurava o contato prospectado.
- Agora, como `contatoId` e o proprio `lead.id`, a rota deleta o registro raiz.
- A UI comunica uma restauracao que nao acontece.
- Risco de perda operacional de proprietarios/prospeccoes por acao de UI.

Recomendacao:

- Renomear/redefinir a acao antes de liberar.
- Se a intencao for restaurar prospeccao, atualizar apenas `statusProspeccao`, nao deletar o `Lead`.
- Se a intencao for deletar, trocar copy/confirmacao para deixar claro que e exclusao definitiva.

### Medio - `tsconfig.build.json` Nao Exclui Pasta Backup Ignorada

Evidencia:

- `/root/elyon/pacotes/backend/tsconfig.json` foi alterado para excluir `src/agentes_bak_pre_sdr_20260411_155803`.
- `/root/elyon/pacotes/backend/tsconfig.build.json` tem `exclude` proprio e nao inclui essa pasta.
- `npm --workspace @elyon/backend run verificar` falha compilando essa pasta.

Impacto:

- O gate padrao local esta quebrado.
- CI em clone limpo pode nao reproduzir se a pasta backup nao estiver versionada, mas desenvolvedores locais ficam bloqueados.

Recomendacao:

- Excluir a pasta tambem no `tsconfig.build.json` ou remover/mover backup para fora de `src`.

### Medio - `ConverterParaLeadUseCase` Perdeu Semantica De Idempotencia Antiga

Evidencia:

- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts:113` sempre seta `statusProspeccao: null` e `status: 'NOVO'`.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts:190` retorna `reasonCode: 'CONVERTED'`.
- Testes antigos ainda esperam `ALREADY_LEAD` em varios cenarios.

Impacto:

- Chamar a tool novamente em lead ja promovido pode gerar nova atividade de promocao e tarefa quente repetida.
- O wrapper ainda trata `ALREADY_LEAD` como idempotente, mas o use case atual parece nao retornar esse codigo.

Recomendacao:

- Definir idempotencia no modelo unificado: se `statusProspeccao === null`, atualizar dados, mas retornar `ALREADY_LEAD` ou equivalente.

### Medio - Guardrail De Opt-out Continua Sem Persistencia Deterministica

Evidencia:

- `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:199` detecta opt-out.
- `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:207` retorna `acao: 'REGISTRAR_OPTOUT'`.
- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:292` retorna resposta fallback sem chamar use case de opt-out.

Impacto:

- Mesmo com `RegistrarOptoutUseCase` migrado para `leadId`, o caminho de guardrail ainda depende de implementacao externa nao evidente.
- P0-03 permanece aberto.

Recomendacao:

- Persistir opt-out no ramo de guardrail antes do early return.

### Baixo - Nomenclatura `contatoId` Ainda E Aceitavel Como Alias, Mas Nao Como Conceito Canonico

Evidencia:

- Diversos caches, debounces e logs ainda usam `contatoId` como nome de chave operacional.
- Exemplos: `/root/elyon/pacotes/backend/src/rotas/webhook.ts:741`, `/root/elyon/pacotes/backend/src/agentes/conversation-cache.ts:45`.

Impacto:

- Se `contatoId` passar a significar `leadId de prospeccao`, isso pode ser aceitavel como alias tecnico temporario.
- O risco aparece quando prompts/tools/use cases tratam os dois como entidades diferentes.

Recomendacao:

- Criar decisao de arquitetura: `contatoId` vira alias legado para `leadId` ou sera eliminado.
- Documentar essa decisao no codigo e nos prompts.

## Fatos

- O schema Prisma local e valido.
- O frontend builda.
- O TypeScript do backend passa quando usado `tsconfig.json`.
- O comando padrao `verificar` do backend falha por pasta backup local.
- Testes direcionados dos agentes falham.
- O webhook ainda tem SQL raw para tabela `contatos`.
- `QualificarLeadUseCase` ainda usa `db.contato`.

## Hipoteses

- A refatoracao atual e uma implementacao parcial da abordagem A, unificacao total, descrita no relatorio de viabilidade existente.
- O objetivo do diff parece ser eliminar `Contato`, mas preservar rotas `/contatos` como compatibilidade de API.
- O proximo passo mais seguro depende de decisao de produto/arquitetura, nao apenas de correcao mecanica.

## Decisao Recomendada

### Nao seguir com P0 sobre este worktree agora

Motivo: os P0 dependem da identidade canonica (`contatoId` vs `leadId`) e este worktree ainda nao tem essa identidade resolvida.

### Escolher uma das duas trilhas

| Trilha | Quando usar | Recomendacao |
|---|---|---|
| Estabilizar refatoracao atual | Se a decisao de produto ja for unificacao total `Contato -> Lead`. | Criar branch propria e fechar os findings criticos antes dos P0. |
| Isolar P0 em worktree limpo | Se a prioridade for liberar agentes com menor risco agora. | Criar worktree a partir de `origin/main` e implementar P0 no modelo atual, sem misturar esta unificacao. |

## Minha Recomendacao Final

**Prioridade tecnica: isolar P0 em worktree limpo, mantendo esta refatoracao `Contato -> Lead` congelada para revisao separada.**

Justificativa:

1. O proprio relatorio de viabilidade existente recomendava nao fazer big bang.
2. O diff atual ja apresenta quebras criticas no webhook e use cases.
3. Os P0 dos agentes podem ser resolvidos com escopo menor do que completar a unificacao total.
4. Misturar P0 com a refatoracao atual tornaria review e rollback muito caros.

## Proximo Passo Recomendado

1. Criar worktree/branch limpa para `p0-agent-identity-contracts`.
2. Copiar ou referenciar apenas os documentos RAIO-X.
3. Implementar P0-01 e P0-02 no modelo limpo.
4. Voltar a esta refatoracao `Contato -> Lead` como epico separado, com plano e gates proprios.
