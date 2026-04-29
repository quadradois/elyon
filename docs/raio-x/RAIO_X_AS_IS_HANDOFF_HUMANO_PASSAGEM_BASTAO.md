# RAIO X AS-IS — Handoff para Humano, Passagem de Bastão e Retorno para IA

## 1) Escopo analisado
- Handoff iniciado por IA (tool `encaminhar_corretor`)
- Assunção manual por corretor/humano (rotas de campanha e de lead)
- Objetivo operacional da fase humana
- Retorno para IA (manual e automático)

## 2) Fluxo AS-IS (estado atual)

### Etapa A — IA identifica necessidade de handoff
1. O agente só deve chamar `encaminhar_corretor` quando o proprietário pedir explicitamente para falar com humano.
   - Referência: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts:345-348`
2. A tool exige `motivo`, `contextoConversa` e `urgencia`, para carregar contexto da passagem.
   - Referência: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts:350-355`

### Etapa B — Passagem de bastão IA → Humano
1. Use case valida contato e campanha de origem.
   - Referência: `pacotes/backend/src/casos-de-uso/agentes/encaminhar-corretor.usecase.ts:22-33`
2. Se contato ainda não é lead, promove para lead (com estagio `encaminhado_corretor`).
   - Referência: `pacotes/backend/src/casos-de-uso/agentes/encaminhar-corretor.usecase.ts:37-61`
3. Desliga a IA no contato (`modoAtendimento='HUMANO'`) para evitar resposta automática após handoff.
   - Referência: `pacotes/backend/src/casos-de-uso/agentes/encaminhar-corretor.usecase.ts:64-68`
4. Cria atividade operacional para o corretor com motivo + contexto da conversa (passagem de bastão).
   - Referência: `pacotes/backend/src/casos-de-uso/agentes/encaminhar-corretor.usecase.ts:70-79`

### Etapa C — Atendimento humano (janela manual)
1. Enquanto `modoAtendimento` estiver em `HUMANO` (ou `PAUSADO`), webhook não deixa IA responder.
   - Referência: `pacotes/backend/src/rotas/webhook.ts:1636-1639`
2. Mesmo sem resposta da IA, mensagens recebidas continuam sendo salvas no histórico.
   - Referência: `pacotes/backend/src/rotas/webhook.ts:1641-1651`
3. O sistema extrai sinais de negociação humana (tipo autorização, comissão, prazo) das mensagens e grava em observações.
   - Referências:
     - `pacotes/backend/src/rotas/webhook.ts:1653-1666`
     - `pacotes/backend/src/rotas/webhook-resilience.ts:3-20`

### Etapa D — Retorno Humano → IA
#### D.1 Retorno manual
- Pode ocorrer por rotas operacionais:
  - `POST /:id/contatos/:contatoId/devolver-ia`
    - Referência: `pacotes/backend/src/rotas/campanhas/contatos.rotas.ts:1498-1540`
  - `POST /api/leads/:id/retomar-ia`
    - Referência: `pacotes/backend/src/rotas/leads.ts:1953-1973`
  - `POST /api/leads/:id/controle-modo` com `modo='IA'`
    - Referência: `pacotes/backend/src/rotas/leads.ts:1920-1947`

#### D.2 Retorno automático (resiliência)
1. Se chegar mensagem com contato em `HUMANO/PAUSADO`, o webhook avalia auto-retorno.
   - Referência: `pacotes/backend/src/rotas/webhook.ts:1668-1685`
2. Só auto-retorna se flag estiver ativa e status do lead for elegível.
   - Flag: `AUTO_RETORNO_HUMANO_PARA_IA` (default true)
   - Status elegíveis: `DOCUMENTACAO`, `EM_NEGOCIACAO`, `ONBOARDING`
   - Referências:
     - `pacotes/backend/src/rotas/webhook.ts:717, 738-741`
     - `pacotes/backend/src/rotas/webhook-resilience.ts:1, 23-27`
3. Há também job de SLA que devolve para IA após janela sem interação.
   - Lógica: busca `modoAtendimento='HUMANO'` + `ultimaInteracao < limite`, muda para `IA`, audita.
   - Referência: `pacotes/backend/src/jobs/job-retomar-ia.ts:1-69`

## 3) Objetivo AS-IS do atendimento humano
Pelo comportamento implementado, o objetivo do atendimento humano hoje é:
1. Assumir negociação sensível/solicitada explicitamente pelo proprietário.
2. Conduzir etapas comerciais e de formalização (ex.: comissão, autorização, prazo, documentação).
3. Deixar trilha operacional para continuidade (atividade, histórico e observações).

Sinais no código:
- Handoff com urgência + contexto em atividade (`atividade.tipo='TAREFA'`).
  - `encaminhar-corretor.usecase.ts:74-77`
- Captura de sinais de negociação durante modo humano.
  - `webhook.ts:1653-1666` + `webhook-resilience.ts:3-20`
- Campo de apoio ao closer no payload do lead (`briefingCloser`).
  - `leads.ts:747-749`

## 4) Passagem de bastão (qualidade atual)

### O que já existe e funciona
- Gate forte para pausar IA no handoff (`modoAtendimento='HUMANO'`).
- Contexto resumido entregue ao humano via atividade (`motivo` + `contextoConversa`).
- Persistência completa de mensagens durante atendimento humano.
- Canais claros de retorno manual para IA.
- Mecanismo de auto-retorno para evitar lead parado.

### Gaps / riscos AS-IS
1. **Critério do job SLA pode reativar IA sem confirmação de “sem resposta humana real”**
   - Comentário do arquivo fala em “sem mensagem humana”, mas filtro usa `ultimaInteracao` geral.
   - Referência: `job-retomar-ia.ts:4-5` vs `job-retomar-ia.ts:31`
2. **Auto-retorno no webhook pode ocorrer no mesmo inbound de modo humano, por status elegível**
   - Pode antecipar devolução antes de fechamento operacional desejado do corretor.
   - Referência: `webhook.ts:1668-1685`
3. **Passagem de bastão não usa checklist estruturado obrigatório**
   - Existe `contextoConversa`, mas sem contrato de campos mínimos (SPIN/objeções/próximo passo).
4. **Retorno para IA não exige “objetivo humano concluído” explícito**
   - Mudança de modo para IA é técnica, sem validação formal de desfecho humano.

## 5) Resumo executivo (AS-IS)
- O fluxo IA → HUMANO está implementado e operacional, com bloqueio efetivo de resposta automática da IA durante o atendimento humano.
- A passagem de bastão existe via atividade com contexto, mas ainda sem protocolo estruturado obrigatório.
- O retorno HUMANO → IA já funciona por três caminhos: manual por campanha, manual por lead e automático (webhook/job).
- O principal risco atual é devolver para IA por regra técnica de tempo/status sem uma checagem explícita de “objetivo humano cumprido”.

## 6) Recomendações imediatas (sem mudar arquitetura)
1. Ajustar job de retorno para avaliar efetivamente “ausência de mensagem humana” (fonte de mensagem) em vez de `ultimaInteracao` genérica.
2. Introduzir `motivoRetornoIA` obrigatório no retorno manual (`devolver-ia`/`retomar-ia`) para registrar desfecho.
3. Padronizar passagem de bastão com schema mínimo: dores, objeções, proposta em aberto, próximo compromisso e pendências.
4. Bloquear auto-retorno no webhook quando houver marcador de “atendimento humano em execução” até conclusão explícita.
