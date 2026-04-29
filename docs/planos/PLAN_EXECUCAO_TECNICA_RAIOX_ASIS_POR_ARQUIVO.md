# Plano de Execução Técnica — RAIO-X AS-IS (Por Arquivo)

Data: 2026-04-29  
Base: `docs/planos/PLAN_IMPLEMENTACAO_RAIOX_ASIS.md` + análise de código atual

## Objetivo

Converter o plano macro em tarefas implementáveis por arquivo, com ordem de execução, critérios de aceite e testes mínimos por sprint.

---

## Sprint 1 — P0 imediato (fluxo e consistência de negócio)

## 1) `/pacotes/backend/src/rotas/webhook.ts`

### Tarefa 1.1 — Retorno automático de `HUMANO/PAUSADO` para `IA`

- Ponto atual: bloqueio total em `modoAtendimento === 'HUMANO' || 'PAUSADO'` (linhas ~1558+).
- Implementar:
  - `shouldAutoReturnToIA(contato, ultimaMensagem, agora)` com critérios explícitos.
  - Ao receber nova mensagem elegível, atualizar `modoAtendimento` para `IA` e registrar log/auditoria.
  - Persistir evento (`motivo_retorno_ia`) para rastreio operacional.
- Critério de aceite:
  - Contato volta para `IA` automaticamente sob regra definida, sem edição manual.

### Tarefa 1.2 — Eliminar corrida de conversão

- Ponto atual: fallback `garantirConversaoAutomaticaSeElegivel` após orquestrador (linhas ~1803+).
- Implementar:
  - Guardar decisão de conversão por turno (`decisaoConversao: ORQUESTRADOR|FALLBACK|SKIP`).
  - Executar fallback somente se orquestrador não tentou conversão naquele turno.
  - Reforçar idempotência por chave de turno (`contatoId + assinaturaLote`).
- Critério de aceite:
  - Sem duplicidade de lead em cargas simultâneas.

### Tarefa 1.3 — Retomada com contexto da fase humana

- Implementar:
  - Antes de `processarMensagemOrquestrada`, anexar resumo estruturado da fase humana no contexto.
  - Campos mínimos: `tipoAutorizacao`, `comissaoAcordada`, `prazoTrabalho`, `pendencias`.
- Critério de aceite:
  - Admin Agent não repete perguntas já acordadas no humano.

## 2) `/pacotes/backend/src/agentes/admin-agent.ts`

### Tarefa 2.1 — Corrigir ordem do fluxo CRM/CAPTADO no prompt

- Ponto atual: prompt já descreve CRM antes de CAPTADO (coerente), mas depende da tool errada.
- Implementar:
  - Tornar explícito: `CAPTADO` só após retorno `success=true` de `enviar_para_crm`.
  - Instruir comportamento em falha CRM: não mover fase, informar reprocesso.
- Critério de aceite:
  - Agente não tenta finalizar fase sem CRM sync.

## 3) `/pacotes/backend/src/ferramentas/sdr-tools-agents.ts`

### Tarefa 3.1 — Remover pré-condição inválida de CAPTADO em `enviar_para_crm`

- Ponto atual: bloqueia se `lead.status !== 'CAPTADO'` (linhas ~568+).
- Implementar:
  - Substituir regra por pré-condições reais: contrato + dados mínimos do imóvel.
  - Em caso de sucesso do CRM, a tool pode retornar sinal para transição de fase.
- Critério de aceite:
  - `enviar_para_crm` funciona antes de `CAPTADO` e guia o fluxo corretamente.

### Tarefa 3.2 — Regra de transição para CAPTADO

- Implementar:
  - Em `mover_para_fase`, bloquear `CAPTADO` se `crmSyncStatus !== 'synced'`.
  - Mensagem de erro orientativa para o agente.
- Critério de aceite:
  - Impossível ter lead `CAPTADO` sem CRM sincronizado.

## 4) `/pacotes/backend/src/servicos/crm-service.ts`

### Tarefa 4.1 — Remover defaults hardcoded de localização

- Ponto atual: `cidade: ... || 'Goiânia'` e `estado: ... || 'GO'` (linhas ~193-194).
- Implementar:
  - Enviar `null` quando parse não identificar cidade/estado.
  - Logar aviso estruturado (`crm_missing_location`) para observabilidade.
- Critério de aceite:
  - Nenhum lead é enviado com cidade/estado fictícios por fallback.

### Tarefa 4.2 — Retry automático no envio CRM

- Implementar:
  - Wrapper interno com retry exponencial para erros transitórios HTTP (5xx, timeout).
  - Atualizar `crmSyncStatus` com estados (`pending`, `retrying`, `synced`, `error`).
- Critério de aceite:
  - Falha transitória não vira dead-end imediato.

---

## Sprint 2 — P1 de resiliência de estado/memória

## 5) `/pacotes/backend/src/rotas/webhook.ts` + `/pacotes/backend/src/agentes/orchestrator.ts`

### Tarefa 5.1 — Mitigar divergência DB x Redis history

- Implementar:
  - Estratégia de fallback explícita quando `cachedHistory` inexistente.
  - Reidratação mínima de tool trail crítica em memória de execução.
- Critério de aceite:
  - Expiração de Redis não faz o agente “esquecer” ações críticas.

### Tarefa 5.2 — Reidratar `schemaState` após fase humana

- Implementar:
  - Reconstrução parcial de estado a partir de mensagens persistidas + campos estruturados.
- Critério de aceite:
  - Retorno da IA considera fatos coletados durante HUMANO.

## 6) `/pacotes/backend/src/agentes/agent-chain.ts`

### Tarefa 6.1 — Invalidar cache por versão de briefing/config

- Ponto atual: TTL fixo 30 min (`AGENT_CHAIN_TTL_MS`).
- Implementar:
  - Incluir `version/hash` de briefing no `cacheKey`.
  - Invalidação imediata quando versão mudar.
- Critério de aceite:
  - Alteração de briefing refletida na próxima execução.

---

## Sprint 3 — Governança operacional e testes

## 7) Testes e observabilidade

### Tarefa 7.1 — Casos automatizados mínimos

- Fluxos:
  - HUMANO → IA automático.
  - CRM falha transitória com retry e recuperação.
  - Bloqueio de `CAPTADO` sem CRM sync.
  - Concorrência de mensagens no mesmo contato.
- Critério de aceite:
  - Suite verde em CI para cenários críticos.

### Tarefa 7.2 — Telemetria e alertas

- Eventos mínimos:
  - `ia_auto_return_triggered`
  - `conversion_race_prevented`
  - `crm_sync_retry`
  - `crm_missing_location`
- Critério de aceite:
  - Time operacional consegue diagnosticar gargalo sem leitura manual massiva.

---

## Definição de pronto

- Sem reprodução das falhas críticas 1-5 em homologação.
- Sem `CAPTADO` sem `crmSyncStatus='synced'`.
- Sem fallback hardcoded de localização no payload CRM.
- Retorno Humano → IA funcionando com regra auditável.
- Concorrência de conversão estabilizada com idempotência comprovada.
