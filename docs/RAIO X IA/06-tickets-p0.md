# 06 - Tickets Tecnicos P0

Data: 2026-05-02  
Escopo: detalhamento dos P0 do RAIO-X IA / Agentes.  
Modo: especificacao tecnica e criterios de aceite. Nenhuma alteracao de backend foi feita neste documento.

## Como Usar

Cada ticket abaixo deve virar uma implementacao pequena, revisavel e testavel. A recomendacao e abrir PRs curtos, com testes antes/depois e sem misturar refatoracao ampla com correcao de risco.

## Ordem Recomendada

1. `P0-01` e `P0-02` juntos ou em PRs sequenciais curtos, porque ambos tratam identidade `contatoId`/`leadId`.
2. `P0-03`, porque opt-out e risco de compliance.
3. `P0-04`, porque fecha a superficie cross-tenant das tools sensiveis.
4. `P0-05`, porque limita acoes irreversiveis antes de piloto.

## Definicao De Pronto Para P0

- Teste unitario ou de integracao cobrindo sucesso e falha.
- Nenhuma tool sensivel atualiza registro sem ownership valido.
- Erros retornam `reasonCode` claro para o agente responder com seguranca.
- Logs/telemetria registram bloqueio sem vazar dados sensiveis.
- Comportamento idempotente quando a acao ja foi executada.

---

## P0-01 - Padronizar `contatoId`/`leadId` Em `converter_para_lead`

### Objetivo

Garantir que a tool `converter_para_lead` envie ao use case o identificador correto da entidade que sera convertida, evitando falha por `input.leadId` indefinido ou atualizacao da entidade errada.

### Severidade

Critica.

### Evidencias

- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:263` define schema da tool com `contatoId`.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:283` repassa `args` diretamente para o use case.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts:61` loga `input.leadId`.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts:63` busca `prisma.lead.findUnique({ where: { id: input.leadId } })`.

### Fatos

- A tool pede `contatoId` ao modelo.
- O use case usa `leadId` como chave de busca.
- O input e clonado sem adapter explicito entre `contatoId` e `leadId`.

### Hipoteses

- O nome `contatoId` provavelmente virou legado apos unificacao/parcial migracao para tabela `lead`.
- Em producao, o caso pode falhar como `Lead nao encontrado` quando `leadId` nao estiver preenchido.

### Escopo Incluido

- Definir contrato canonico para conversao: `leadId`, `contatoId` ou `entityId` com tipo.
- Criar adapter explicito na fronteira da tool ou ajustar use case para aceitar contrato canonico.
- Garantir idempotencia quando o lead ja estiver convertido.
- Padronizar mensagens de erro e `reasonCode`.

### Fora Do Escopo

- Refatorar toda a modelagem CRM/prospeccao.
- Alterar prompt/persona, exceto se necessario para refletir o nome correto do parametro.
- Mudar regras comerciais de conversao.

### Arquivos Provaveis

- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts`
- Testes existentes ou novos em `/root/elyon/pacotes/backend/src/**/__tests__` ou padrao equivalente do projeto.

### Implementacao Recomendada

1. Escolher `leadId` como contrato canonico se a entidade real for `prisma.lead`.
2. Manter compatibilidade temporaria com `contatoId` somente como alias, se necessario.
3. Antes de executar update, resolver a entidade e validar que ela existe.
4. Retornar erro seguro quando nenhum ID valido existir.
5. Registrar evento de tool com o ID canonico resolvido.

### Testes Minimos

- Deve converter quando a tool recebe ID valido no campo canonico.
- Deve converter quando recebe alias legado, se compatibilidade for mantida.
- Deve retornar `CONTACT_NOT_FOUND` ou equivalente quando ID nao existe.
- Deve ser idempotente quando o registro ja estiver convertido.
- Nao deve chamar update se o ID resolvido for `undefined`.

### Criterios De Aceite

- `ConverterParaLeadUseCase.execute` nao recebe `leadId` indefinido em caminho feliz.
- Tool e use case usam contrato documentado e coerente.
- Testes cobrem sucesso, ID invalido e idempotencia.
- O agente recebe uma resposta de erro que permita continuar a conversa sem inventar estado.

---

## P0-02 - Padronizar `contatoId`/`leadId` Em `qualificar_lead`

### Objetivo

Garantir que `qualificar_lead` resolva corretamente a entidade da conversa sem buscar em tabela errada, duplicar lead ou falhar quando o orquestrador estiver usando ID de `lead` como `contatoId`.

### Severidade

Critica.

### Evidencias

- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts:121` busca `db.contato.findUnique({ where: { id: input.contatoId } })`.
- `/root/elyon/pacotes/backend/src/agentes/orchestrator-queries.ts:147` busca prospeccao em `prisma.lead`.
- `/root/elyon/pacotes/backend/src/agentes/orchestrator-queries.ts:155` atribui `leadProspeccao?.id` a `contatoId`.
- `/root/elyon/pacotes/backend/src/agentes/elyon-context.ts:72` possui `tenantId`, `contatoId` e `leadId` no contexto.

### Fatos

- O use case de qualificacao espera um registro em `contato`.
- O orquestrador pode preencher `contatoId` com ID vindo de `lead` de prospeccao.
- O contexto ja tem estrutura para carregar mais de um identificador, mas a fronteira da tool/use case nao esta normalizada.

### Hipoteses

- Ha uma migracao incompleta entre conceitos de contato e lead.
- O agente pode funcionar em alguns fluxos e falhar em outros dependendo da origem do ID.

### Escopo Incluido

- Criar regra deterministica de resolucao de entidade antes da qualificacao.
- Definir precedencia entre `leadId`, `contatoId` e telefone.
- Evitar criacao duplicada quando ja existe lead para telefone/tenant.
- Padronizar retorno quando a entidade nao existe ou pertence a outro tenant.

### Fora Do Escopo

- Reprojetar todo o funil comercial.
- Migrar banco de dados sem decisao explicita.
- Mudar taxonomia de fases sem necessidade direta.

### Arquivos Provaveis

- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts`
- `/root/elyon/pacotes/backend/src/agentes/orchestrator-queries.ts`
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- Possivel helper novo de resolucao de entidade, se aprovado na implementacao.

### Implementacao Recomendada

1. Definir um resolvedor unico de entidade da conversa.
2. Resolver por `{ tenantId, leadId }` quando `leadId` existir.
3. Resolver por `{ tenantId, contatoId }` apenas quando a entidade for realmente `contato`.
4. Usar telefone como fallback somente com `tenantId` e criterios claros.
5. Retornar erro bloqueante se houver ambiguidade.

### Testes Minimos

- Qualificacao com `leadId` existente no tenant atual.
- Qualificacao com `contatoId` real existente no tenant atual, se ainda suportado.
- Contexto em que `contatoId` contem ID de `lead` de prospeccao.
- ID inexistente.
- Telefone duplicado em tenants diferentes.
- Garantia de nao duplicar lead quando ja existe um registro valido.

### Criterios De Aceite

- `qualificar_lead` nao depende de buscar sempre em `db.contato` quando o contexto aponta para `lead`.
- Nao ha duplicidade de lead para a mesma conversa/tenant.
- Erros sao explicitos e auditaveis.
- Testes cobrem os caminhos de identidade principais.

---

## P0-03 - Persistir Opt-out No Caminho De Guardrail

### Objetivo

Garantir que quando o usuario pede para nao receber mais mensagens, o sistema persista o opt-out antes de encerrar o turno.

### Severidade

Critica.

### Evidencias

- `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:199` detecta opt-out.
- `/root/elyon/pacotes/backend/src/agentes/guardrails.ts:207` retorna `acao: 'REGISTRAR_OPTOUT'`.
- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts:292` retorna fallback imediatamente quando guardrail bloqueia.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:242` existe tool `registrar_optout`, mas ela nao e chamada no early return do guardrail.

### Fatos

- A deteccao existe.
- A intencao de registrar existe no campo `acao`.
- O caminho atual retorna resposta ao usuario antes de uma persistencia evidente no trecho analisado.

### Hipoteses

- O opt-out pode depender de outro fluxo externo nao identificado na auditoria.
- Mesmo que exista outro fluxo, a arquitetura fica fragil porque o guardrail nao garante transacao local.

### Escopo Incluido

- Executar persistencia deterministica quando `guardrailResult.acao === 'REGISTRAR_OPTOUT'`.
- Garantir idempotencia: opt-out repetido nao deve gerar erro operacional.
- Encerrar/pausar conversa ativa apos persistencia.
- Registrar telemetria de compliance.

### Fora Do Escopo

- Redesenhar copy de opt-out.
- Criar campanha de reativacao.
- Alterar regras de deteccao sem testes especificos.

### Arquivos Provaveis

- `/root/elyon/pacotes/backend/src/agentes/orchestrator.ts`
- `/root/elyon/pacotes/backend/src/agentes/guardrails.ts`
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/registrar-optout.usecase.ts`
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts`

### Implementacao Recomendada

1. No ramo de guardrail bloqueado, antes do `return`, tratar a `acao` de forma deterministica.
2. Para `REGISTRAR_OPTOUT`, resolver entidade por telefone/tenant/contexto.
3. Chamar use case diretamente ou service dedicado, nao depender do LLM chamar tool.
4. Se a persistencia falhar, registrar erro critico e retornar mensagem segura sem reabrir automacao.
5. Bloquear novos disparos para o telefone/tenant apos sucesso.

### Testes Minimos

- Mensagem "nao me mande mais mensagem" persiste opt-out.
- Opt-out repetido retorna sucesso idempotente.
- Falha de persistencia gera log/telemetria e nao prossegue para o agente.
- Frase de comprador/vendedor sem opt-out nao deve registrar opt-out falso.
- Proxima tentativa de contato deve ser bloqueada.

### Criterios De Aceite

- Opt-out nao depende de prompt nem tool chamada pelo modelo.
- Banco reflete a preferencia do usuario.
- Conversa e automacoes futuras respeitam o bloqueio.
- Telemetria permite auditar quando, por que e para qual tenant o opt-out foi registrado.

---

## P0-04 - Validar Tenant Ownership Em Tools Sensiveis

### Objetivo

Impedir que tools com efeito colateral leiam ou atualizem registros de outro tenant, mesmo se o modelo ou input externo fornecer um ID valido mas indevido.

### Severidade

Critica.

### Evidencias

- `/root/elyon/pacotes/backend/src/agentes/elyon-context.ts:72` define `tenantId` no contexto do agente.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/mover-para-fase.usecase.ts:119` busca lead por `id` sem `tenantId` no trecho analisado.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:606` envia lead ao CRM por `args.leadId`.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:665` busca origem de indicacao por `id`.

### Fatos

- O contexto possui `tenantId`.
- Algumas buscas sensiveis usam apenas `id` no trecho analisado.
- Tools podem mover fase, registrar dados, enviar CRM, gerar contrato, agendar e criar indicacao.

### Hipoteses

- O risco de exploracao direta depende de como os argumentos das tools sao montados e se IDs chegam ao modelo.
- Mesmo sem ataque externo, bugs de roteamento podem causar escrita cross-tenant.

### Escopo Incluido

- Definir lista de tools sensiveis.
- Exigir `tenantId` em toda execucao sensivel.
- Validar ownership no use case ou em uma camada comum antes do side effect.
- Retornar erro seguro para tentativa cross-tenant.
- Registrar evento de auditoria.

### Fora Do Escopo

- Implementar RBAC completo para painel administrativo.
- Mudar autenticao geral da API.
- Reestruturar todos os repositories fora do modulo de agentes.

### Arquivos Provaveis

- `/root/elyon/pacotes/backend/src/agentes/elyon-context.ts`
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- `/root/elyon/pacotes/backend/src/ferramentas/tool-wrapper.ts`
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/*.usecase.ts`

### Implementacao Recomendada

1. Criar helper/policy de ownership reutilizavel para tools.
2. Passar `tenantId` do `ElyonContext` para toda tool sensivel.
3. Trocar buscas `findUnique({ id })` por validacao com `tenantId` onde o schema permitir.
4. Quando a tabela nao tiver `tenantId` direto, validar por relacionamento.
5. Bloquear side effect antes de qualquer chamada externa.

### Tools A Priorizar

- `converter_para_lead`
- `qualificar_lead`
- `mover_para_fase`
- `enviar_para_crm`
- `gerar_link_contrato`
- `registrar_optout`
- `encaminhar_corretor`
- `agendar_visita`
- `registrar_indicacao`

### Testes Minimos

- Cada tool sensivel bloqueia ID de outro tenant.
- Nenhum update ocorre em tentativa cross-tenant.
- Calls externas, como CRM/calendario, nao sao disparadas quando ownership falha.
- Logs registram tentativa sem expor dados pessoais completos.

### Criterios De Aceite

- Toda tool sensivel valida `{ id, tenantId }` ou ownership equivalente.
- Nao ha side effect antes da validacao.
- O agente recebe erro recuperavel, sem revelar detalhes internos.
- Cobertura de testes inclui pelo menos uma tool de DB, uma tool de fase e uma tool externa.

---

## P0-05 - Bloquear Acoes Irreversiveis Sem Approval/Policy

### Objetivo

Evitar que o agente execute acoes irreversiveis ou de alto impacto apenas por decisao do LLM, especialmente envio ao CRM, geracao de contrato e marcacao automatica como `CAPTADO`.

### Severidade

Critica.

### Evidencias

- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:606` chama `enviarParaCrm(args.leadId)`.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:611` move automaticamente para `CAPTADO` apos CRM sincronizado.
- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts:612` instancia `MoverParaFaseUseCase` dentro da tool de CRM.
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/mover-para-fase.usecase.ts:140` possui gate de transicao, mas a decisao de acionar a tool ainda pode vir do agente.

### Fatos

- Existem validacoes minimas antes do envio ao CRM.
- Ha gate de transicao de fase.
- Ainda assim, uma tool pode executar chamada externa e tentar mudanca para `CAPTADO` em sequencia.

### Hipoteses

- O gate atual reduz risco, mas nao substitui approval/policy explicita para acao irreversivel.
- Em piloto, a melhor experiencia pode ser registrar solicitacao de acao e pedir validacao humana.

### Escopo Incluido

- Classificar tools por nivel de risco.
- Criar policy deterministica para `CRM`, `contrato` e `CAPTADO`.
- Exigir campos minimos, ownership e estado do funil.
- Definir quando precisa aprovacao humana.
- Impedir chamada externa se policy falhar.

### Fora Do Escopo

- Construir painel completo de aprovacoes, se ainda nao existir.
- Automatizar assinatura juridica de contrato.
- Alterar integracao de CRM alem dos bloqueios necessarios.

### Arquivos Provaveis

- `/root/elyon/pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/mover-para-fase.usecase.ts`
- `/root/elyon/pacotes/backend/src/agentes/paol-policy.ts`
- Possivel service/policy novo para autorizacao de tool sensivel, se aprovado.

### Implementacao Recomendada

1. Definir matriz de risco das tools.
2. Introduzir policy `canExecuteSensitiveAction` ou equivalente.
3. Para `enviar_para_crm`, exigir ownership, campos completos, status permitido e approval quando aplicavel.
4. Separar "CRM enviado" de "mover para CAPTADO" se a mudanca de fase exigir criterio adicional.
5. Retornar resposta operacional segura quando bloquear: o agente deve pedir dado faltante ou encaminhar para humano.

### Testes Minimos

- `enviar_para_crm` bloqueia sem dados obrigatorios.
- `enviar_para_crm` bloqueia sem approval/policy valido quando configurado.
- CRM nao e chamado se policy falha.
- `CAPTADO` nao e aplicado automaticamente quando gate/policy reprova.
- Contrato nao e gerado sem campos minimos e autorizacao.

### Criterios De Aceite

- Tools irreversiveis nao dependem apenas da escolha do LLM.
- Toda acao critica passa por policy deterministica.
- O bloqueio e observavel e compreensivel para operacao.
- Piloto controlado pode ser ativado com risco operacional reduzido.

---

## Checklist De Execucao Dos P0

| Ordem | Ticket | Dependencia | Saida Esperada |
|---|---|---|---|
| 1 | P0-01 | Nenhuma | Conversao com ID canonico. |
| 2 | P0-02 | P0-01 recomendado | Qualificacao sem ambiguidade de entidade. |
| 3 | P0-03 | Resolvedor de entidade ajuda, mas nao bloqueia | Opt-out persistido fora do LLM. |
| 4 | P0-04 | P0-01/P0-02 ajudam a padronizar IDs | Tools sensiveis com ownership. |
| 5 | P0-05 | P0-04 | Acoes irreversiveis atras de policy/approval. |

## Recomendacao De Branches/PRs

- PR 1: `p0-agent-identity-contracts` cobrindo `P0-01` e `P0-02` se o diff ficar pequeno.
- PR 2: `p0-agent-optout-guardrail` cobrindo `P0-03`.
- PR 3: `p0-agent-tool-ownership` cobrindo `P0-04`.
- PR 4: `p0-agent-sensitive-action-policy` cobrindo `P0-05`.

## Pausa De Governanca Antes De Implementar

Antes de alterar codigo, confirmar duas decisoes:

1. Qual identificador sera canonico no modulo de agentes: `leadId`, `contatoId` ou `entityId` tipado.
2. Quais acoes exigem aprovacao humana no piloto: CRM, contrato, `CAPTADO`, agenda ou todas as anteriores.
