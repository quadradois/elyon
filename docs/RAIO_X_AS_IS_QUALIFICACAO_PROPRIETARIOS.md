# RAIO-X AS-IS — Agente de Qualificação de Proprietários (ELYON)

> **Data do diagnóstico:** 12/04/2026  
> **Escopo:** Fluxo de qualificação de proprietários na prospecção ativa (WhatsApp → Orquestrador → SDR/Admin → Persistência → Métricas)  
> **Método:** leitura de código + validação com testes direcionados

---

## 1) Resumo Executivo

Hoje o fluxo está operando com **arquitetura unificada de 2 agentes**:

- `SDR` (qualificação completa: abertura, descoberta, SPIN, pitch e agendamento)
- `ADMIN` (onboarding pós-negociação/documentação)

O desenho anterior (`OPENER` + `PRESENTER`) foi absorvido no `sdr_agent_v1`, e o roteamento real está centralizado no `orchestrator`.

Do ponto de vista de qualificação, o sistema já possui:

- Coleta estruturada de dados SPIN + dados do imóvel
- Persistência de estado conversacional (`schemaState`) entre turnos
- Guardrails de entrada (opt-out, spam, comprador, blacklist)
- Validação de tools (pré-validação + enriquecimento de erro)
- Gates para impedir avanço de fase sem qualificação mínima SPIN

Também existem lacunas importantes de governança e métrica (detalhadas na seção 9).

---

## 2) Evidências Auditadas (código-fonte)

Arquivos-base usados no diagnóstico:

- `pacotes/backend/src/rotas/webhook.ts`
- `pacotes/backend/src/agentes/orchestrator.ts`
- `pacotes/backend/src/agentes/agent-chain.ts`
- `pacotes/backend/src/agentes/sdr-agent.ts`
- `pacotes/backend/src/agentes/admin-agent.ts`
- `pacotes/backend/src/agentes/knowledge-agent.ts`
- `pacotes/backend/src/agentes/guardrails.ts`
- `pacotes/backend/src/agentes/response-filters.ts`
- `pacotes/backend/src/agentes/agent-runner.ts`
- `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
- `pacotes/backend/src/ferramentas/tool-wrapper.ts`
- `pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts`
- `pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts`
- `pacotes/backend/src/casos-de-uso/agentes/mover-para-fase.usecase.ts`
- `pacotes/backend/src/agentes/input-builder.ts`
- `pacotes/backend/src/agentes/conversation-state.ts`
- `pacotes/backend/src/agentes/conversation-cache.ts`
- `pacotes/backend/src/agentes/orchestrator-metrics.ts`
- `pacotes/backend/src/rotas/metricas-agentes.ts`
- `pacotes/backend/src/rotas/metricas-ia.rotas.ts`
- `pacotes/backend/prisma/schema.prisma`

---

## 3) Fluxo AS-IS de Qualificação (ponta a ponta)

1. A mensagem chega via webhook WhatsApp.
2. O sistema identifica se é fluxo de prospecção ativa (`contatoProspeccao`).
3. Aplica anti-duplicidade, anti-flood e debounce/buffer de mensagens.
4. Atualiza status do contato para `RESPONDEU`.
5. Monta histórico recente da conversa + contexto do tenant/campanha.
6. Carrega configuração do orquestrador e contexto da conversa.
7. Chama `processarMensagemOrquestrada(...)` quando `USAR_ORQUESTRADOR_4_AGENTES=true`.
8. Orquestrador executa guardrails de entrada (opt-out/spam/comprador/blacklist).
9. Orquestrador determina agente inicial (`SDR` ou `ADMIN`) com cache persistido e status do lead.
10. Constrói input SDK com estado extraído da conversa + histórico cache + `schemaState`.
11. Executa agente com retries e fallback de provedor (BYOK → plataforma).
12. Persiste histórico SDK (incluindo tool calls/handoffs) e estado de agente ativo.
13. Aplica filtros de resposta (anti-narração de handoff, fallback contextual, anti-repetição).
14. Retorna resposta para envio no WhatsApp e salva mensagem de saída.
15. Ferramentas acionadas pelo agente atualizam contato/lead/atividade/agenda/CRM.

---

## 4) Arquitetura Atual de Agentes

### 4.1 Cadeia de agentes

- Tipo de agente atual: `SDR | ADMIN`
- Handoff principal: `SDR → ADMIN`
- Subagente de conhecimento: `knowledge_agent` (via `asTool()` dentro do SDR)

### 4.2 Roteamento por status do lead

- `ADMIN`: `DOCUMENTACAO`, `EM_NEGOCIACAO`, `ONBOARDING`, `CAPTADO`
- `SDR`: demais status (`NOVO`, `QUALIFICADO`, `TENTATIVA_AGENDAMENTO`, etc.)

### 4.3 Modelos LLM

- Padrão principal: `gpt-4.1`
- Auxiliar: `gpt-4.1-mini`
- Suporte BYOK com fallback automático para chave da plataforma

---

## 5) Motor de Qualificação (SDR)

### 5.1 Fases internas da conversa no SDR

- `MEIO_CAMPO`
- `DESCOBERTA`
- `DIAGNOSTICO_SPIN`
- `PITCH`
- `AGENDAMENTO`
- `FOLLOW_UP`
- `RECUO`

### 5.2 Regras centrais de qualificação

- Structured output obrigatório com fase + PVAM + SPIN.
- Regras para não repetir perguntas se dado já existe no histórico/lead/briefing.
- Conversão de contato para lead via `converter_para_lead`.
- Qualificação com enriquecimento SPIN via `qualificar_lead`.
- Gate de avanço de fase (`mover_para_fase`) exige SPIN mínimo para etapas avançadas.

### 5.3 Tools no fluxo de qualificação

Principais tools do SDR:

- `converter_para_lead`
- `qualificar_lead`
- `agendar_followup`
- `registrar_optout`
- `mover_para_fase`
- `registrar_indicacao`
- `atualizar_dados_lead`
- `agendar_reuniao_closer`
- `enviar_link_agendamento`
- `consultar_preco_mercado`
- `ler_skill`

---

## 6) Persistência de Dados e Estado

### 6.1 Entidades principais

- `Contato`: base de prospecção (antes da conversão)
- `MensagemProspeccao`: trilha completa de mensagens de entrada/saída
- `Lead`: entidade pós-conversão com campos SPIN + imóvel + status funil
- `Atividade`: trilha de ações de tool e eventos de negócio

### 6.2 Estado conversacional

- `schemaState` persistido no cache e no lead
- Extração heurística de intenção, valor, ocupação, timeline, anúncio ativo
- Histórico SDK com tool calls/handoffs persistido por contato

### 6.3 TTLs e cache

- Histórico da conversa: Redis + fallback memória, TTL de 6h
- Agente ativo por contato: Redis + fallback memória, TTL de 24h
- Cache de cadeia de agentes: TTL de 30min + limite de tamanho

---

## 7) Guardrails, Segurança e Resiliência

### 7.1 Guardrails de entrada

- Blacklist por telefone
- Anti-spam/flood
- Opt-out
- Detecção de comprador (fora do target de proprietário)

### 7.2 Robustez de execução

- Limite de turnos (`maxTurns=15`) contra loop infinito
- Retry para `tool_call_id` obsoleto (com purge de histórico)
- Retry único para `ToolCallError`
- Fallback de provedor quando BYOK falha (5xx/429/timeout/rede)

### 7.3 Hardening de tools

- Sanitização de payload de tool call (`string/number/bool/enum/array`)
- Pré-validação de casos críticos (agendamento, IDs, fase, dados mínimos)
- Enriquecimento de mensagens de erro para orientar o agente em tempo real

---

## 8) Métricas e Observabilidade (AS-IS)

### 8.1 O que já existe

- Log estruturado do orquestrador (agente inicial/final, fallback, handoff, toolCalls, duração)
- Alertas de consumo de tokens e custo estimado (warning/critical)
- Registro de execução de tools em `Atividade` (`TOOL_EXEC:*`)
- Endpoints de métricas em `/api/metricas-agentes` e `/api/metricas-ia`

### 8.2 Testes executados neste diagnóstico

Com `NODE_OPTIONS=--max-old-space-size=4096`:

- `agent-chain.test.ts` → **46/46** ok
- `structured-output-e2e.test.ts` → **16/16** ok
- `orchestrator-integration.test.ts` → **19/19** ok
- `qualificar-lead.usecase.test.ts` → **5/5** ok

Observação: sem aumento de heap, o comando agregado de testes estourou memória (OOM).

---

## 9) Lacunas e Riscos (priorizados)

### Alta prioridade

1. **Qualificação parcial com status final `QUALIFICADO`**
   - `qualificar_lead` pode retornar prontidão `PARCIAL`, mas ainda assim persiste `status='QUALIFICADO'`.
   - Risco: inflar qualidade percebida do funil com leads incompletos.

2. **Métricas operacionais parcialmente mockadas**
   - Endpoint `/api/metricas-agentes/workers` retorna dados fixos/mock.
   - Risco: gestão tomar decisão com indicador não real.

### Média prioridade

3. **Inconsistência de payload em métricas de conversão**
   - Em `/api/metricas-ia/conversoes`, resposta inclui campo `tipo` baseado em `tipoInteresse` que não está no select/modelo usado.
   - Risco: relatório com atributo vazio/inconsistente.

4. **Nomenclatura legada ainda presente**
   - Exemplo: env `USAR_ORQUESTRADOR_4_AGENTES` permanece após unificação para 2 agentes.
   - Risco: confusão operacional e técnica.

5. **Divergência entre comentários/documentação e implementação**
   - Há comentários citando “4 agentes” em módulos já migrados para cadeia `SDR → ADMIN`.
   - Risco: erro em manutenção futura.

---

## 10) Conclusão

O agente de qualificação de proprietários está funcional e tecnicamente maduro no núcleo (orquestração, ferramentas, estado, guardrails e fallback), com boa cobertura de testes direcionados.

O principal ponto de melhoria agora não é “fazer funcionar”, e sim **aumentar confiabilidade de governança**:

- alinhar regra de prontidão vs status de qualificação,
- limpar métricas não reais,
- remover legados de nomenclatura/documentação,
- consolidar observabilidade em indicadores de produção 100% confiáveis.
