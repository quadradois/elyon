# RAIO-X AS-IS — Plano de Implementação de Melhorias
> **Data**: 29/04/2026  
> **Origem**: Análise completa do fluxo do agente IA — qualificação → passagem para humano → retorno para IA → envio ao CRM  
> **Para**: Equipe de Engenharia  
> **Prioridade**: As falhas estão ordenadas por impacto no negócio

---

## CONTEXTO

Este documento consolida os problemas encontrados no RAIO-X AS-IS do fluxo do agente Elyon e detalha exatamente o que precisa ser implementado, onde, e como. Cada item contém: localização no código, causa raiz, solução proposta e critério de aceite.

---

## 🔴 FALHA 1 — Sem retorno automático do modo HUMANO para IA

### Problema
Quando o agente IA transfere para um corretor humano, o campo `modoAtendimento` vai para `'HUMANO'`. Não existe nenhum mecanismo automático para reverter isso. A IA fica muda para sempre se o corretor não mudar o campo manualmente.

**Arquivo afetado**: [webhook.ts:1558-1573](../../pacotes/backend/src/rotas/webhook.ts#L1558)

```typescript
// HOJE: IA silencia e nunca mais volta
const modoAtendimento = (contatoProspeccao as any).modoAtendimento || 'IA';
if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO') {
  registrarIgnorado(telefone, `modo ${modoAtendimento}`, contatoProspeccao.id);
  await salvarMensagemProspeccao({ ... });
  continue; // ← IA nunca retorna
}
```

### Solução A — Timer Automático de Retorno (Recomendada)
Criar um job que verifica contatos no modo `HUMANO` há mais de X horas sem mensagem de saída do humano e reverte para `IA` automaticamente, movendo para a fase correta.

**Arquivos a criar/modificar**:
- `pacotes/backend/src/jobs/retomar-atendimento-ia.job.ts` ← **NOVO**
- `pacotes/backend/src/servidor.ts` — registrar o job no startup

```typescript
// retomar-atendimento-ia.job.ts
// Executa a cada 30 minutos
// 1. Busca contatos com modoAtendimento='HUMANO' há mais de SLA_RETORNO_IA_HORAS
// 2. Verifica se o último status do lead indica que o humano terminou (ONBOARDING, DOCUMENTACAO)
// 3. Se sim, altera modoAtendimento='IA' e dispara Admin Agent para retomar coleta
```

**Variável de ambiente a adicionar** em `.env`:
```
SLA_RETORNO_IA_HORAS=24   # Após quantas horas sem ação humana a IA retoma
```

### Solução B — Endpoint de Retomada via Painel (Complementar)
No dashboard do corretor, adicionar botão "Devolver para IA" que:
1. Altera `modoAtendimento = 'IA'` no contato
2. Salva um contexto especial no Redis para o Admin Agent: o que foi negociado
3. Dispara uma mensagem inicial do Admin Agent ao lead

**Arquivo a modificar**: `pacotes/backend/src/rotas/leads.ts` — adicionar endpoint `POST /api/leads/:id/retomar-ia`

### Critério de Aceite
- [ ] Contatos em modo HUMANO por mais de 24h sem ação voltam automaticamente para IA
- [ ] O Admin Agent ao retomar tem acesso ao histórico da fase humana
- [ ] Painel mostra botão "Devolver para IA" em leads no modo HUMANO
- [ ] Ao devolver, a IA não reapresenta perguntas já respondidas ao humano

---

## 🔴 FALHA 2 — Admin Agent não recebe contexto do que o humano negociou

### Problema
Quando o humano negocia comissão, prazo e tipo de contrato no WhatsApp, essas informações ficam apenas nas mensagens de texto. O Admin Agent nunca lê essas mensagens — só usa `ctx.tipoAutorizacao`, `ctx.comissaoAcordada`, `ctx.prazoTrabalho` que continuam nulos.

**Arquivos afetados**:
- [admin-agent.ts:96-101](../../pacotes/backend/src/agentes/admin-agent.ts#L96) — `gerarPromptAdmin` usa campos que podem estar nulos
- [orchestrator.ts:496-504](../../pacotes/backend/src/agentes/orchestrator.ts#L496) — `construirElyonContext` não extrai dados da conversa humana

### Solução
Criar uma função de **extração estruturada pós-fase-humana** que processa as últimas N mensagens da fase humana antes de construir o contexto do Admin Agent.

**Arquivo a criar**: `pacotes/backend/src/agentes/extrator-contexto-humano.ts` ← **NOVO**

```typescript
// extrator-contexto-humano.ts
// Chama o LLM (modelo auxiliar, barato) para extrair de um bloco de mensagens:
// - tipoAutorizacao (exclusiva/simples)
// - comissaoAcordada (percentual)
// - prazoTrabalho (dias)
// - termosEspeciais (texto livre)
// Salva no lead via AtualizarDadosLeadUseCase antes de chamar o Admin Agent

export async function extrairContextoFaseHumana(leadId: string, mensagensHumanas: string[]): Promise<void>
```

**Arquivo a modificar**: `pacotes/backend/src/agentes/context-builder.ts` — chamar `extrairContextoFaseHumana` quando `lead.status in ['ONBOARDING']` e campos estiverem nulos

### Critério de Aceite
- [ ] Admin Agent sabe a comissão e prazo acordados pelo humano antes de iniciar onboarding
- [ ] Campos `tipoAutorizacao`, `comissaoAcordada`, `prazoTrabalho` estão preenchidos no lead antes do Admin Agent iniciar
- [ ] Admin Agent não repete perguntas sobre termos já definidos pelo humano

---

## 🔴 FALHA 3 — Race condition na conversão automática (duplos leads)

### Problema
O webhook chama `garantirConversaoAutomaticaSeElegivel()` **após** o orchestrator executar. Se o orchestrator já chamou `converter_para_lead` via tool e a conversão está em andamento, a função de fallback pode tentar criar um segundo lead.

**Arquivo afetado**: [webhook.ts:1798-1807](../../pacotes/backend/src/rotas/webhook.ts#L1798)

```typescript
// Problema: sem lock entre a tool call e este fallback
if (!contatoPosOrquestrador?.virouLead || !contatoPosOrquestrador?.leadId) {
  await garantirConversaoAutomaticaSeElegivel({...});
}
```

### Solução
Adicionar um **Redis Lock com TTL curto** (10s) em torno da operação completa de conversão, compartilhado entre a tool e o fallback.

**Arquivo a modificar**: `pacotes/backend/src/casos-de-uso/agentes/converter-para-lead.usecase.ts`

```typescript
// Antes de criar o lead, adquirir lock com chave: `lead_conv:${contatoId}`
// TTL: 15 segundos
// Se não conseguir o lock: verificar se o lead já existe (idempotência)
// Sempre liberar o lock no finally
```

**Arquivo a modificar**: `pacotes/backend/src/rotas/webhook.ts` — aguardar `CONVERSION_LOCK_TIMEOUT_MS` antes de chamar o fallback se o orquestrador executou alguma tool relacionada

### Critério de Aceite
- [ ] Nunca criar dois leads para o mesmo contato em paralelo
- [ ] O fallback de conversão só executa se confirmado que o orquestrador não converteu
- [ ] Testes de carga com 10 webhooks simultâneos do mesmo contato sem duplicar leads

---

## 🔴 FALHA 4 — CRM envia cidade/estado hardcoded como Goiânia/GO

### Problema
A função `parseEndereco` usa regex simples que falha para endereços coletados via WhatsApp (formato livre). Quando falha, usa `'Goiânia'` e `'GO'` como padrão. Todo lead vai para o CRM com localização errada.

**Arquivo afetado**: [crm-service.ts:190-194](../../pacotes/backend/src/servicos/crm-service.ts#L190)

```typescript
// HOJE: silenciosamente errado
cidade: enderecoParseado.cidade || 'Goiânia',  // ← hardcoded
estado: enderecoParseado.estado || 'GO',        // ← hardcoded
```

### Solução
1. **Imediato**: Substituir o default por `null` — não enviar dados falsos
2. **Melhor**: Adicionar campos separados `lead.cidadeImovel` e `lead.estadoImovel` preenchidos pelo Admin Agent via tool `atualizar_dados_lead` durante o onboarding
3. **Ideal**: Integrar ViaCEP ou API de geocoding quando o CEP for fornecido

**Arquivo a modificar**: `pacotes/backend/src/servicos/crm-service.ts`

```typescript
// IMEDIATO — trocar para null:
cidade: enderecoParseado.cidade || null,
estado: enderecoParseado.estado || null,
```

**Arquivo a modificar**: `pacotes/backend/src/agentes/admin-agent.ts` — adicionar CEP, cidade e estado ao checklist de coleta

**Arquivo a modificar**: `pacotes/backend/prisma/schema.prisma` — adicionar campos `cidadeImovel String?` e `estadoImovel String?` ao model Lead (via migration)

### Critério de Aceite
- [ ] Nenhum lead vai para o CRM com cidade 'Goiânia' por padrão se não tiver sido informada
- [ ] Admin Agent coleta CEP/cidade/estado durante onboarding
- [ ] CRM payload usa os campos separados quando disponíveis, null quando não disponíveis

---

## 🔴 FALHA 5 — Contradição: lead vai para CAPTADO antes de enviar ao CRM

### Problema
O `enviarParaCrmTool` bloqueia se `lead.status !== 'CAPTADO'`. Mas o prompt do Admin Agent instrui: "ETAPA 4: enviar_para_crm → ETAPA 5: mover_para_fase(CAPTADO)". O agente tenta enviar antes de marcar CAPTADO, recebe erro, e pode nunca completar o fluxo.

**Arquivo afetado 1**: [sdr-tools-agents.ts:568-573](../../pacotes/backend/src/ferramentas/sdr-tools-agents.ts#L568)
```typescript
// Bloqueia o envio se não for CAPTADO
if (lead.status !== 'CAPTADO') {
  return JSON.stringify({ success: false, error: `Lead ainda não está CAPTADO...` });
}
```

**Arquivo afetado 2**: [admin-agent.ts:148-155](../../pacotes/backend/src/agentes/admin-agent.ts#L148)
```
### ETAPA 4: Enviar para CRM   ← pede envio antes
### ETAPA 5: Finalizar (CAPTADO) ← marca CAPTADO depois
```

### Solução
**Opção A — Remover o bloqueio por status** (recomendada): A tool deve enviar ao CRM independente do status, e o sucesso no CRM é que deve acionar a mudança para CAPTADO.

```typescript
// NOVO fluxo da tool enviar_para_crm:
// 1. Valida dados obrigatórios (nome, tipoImovel, valorPretendido)
// 2. Envia ao CRM
// 3. Se sucesso → automaticamente chama moverParaFase('CAPTADO')
// 4. Retorna resultado consolidado

// REMOVER: verificação de status !== 'CAPTADO'
// ADICIONAR: mover para CAPTADO automaticamente após envio com sucesso
```

**Opção B — Corrigir o prompt do Admin Agent** (complementar): Ajustar a ordem para:
```
ETAPA 4: mover_para_fase("CAPTADO") → DEPOIS enviar_para_crm
```
Mas isso ainda deixa leads CAPTADOS sem CRM se o envio falhar.

**Arquivo a modificar**: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts` — refatorar `enviarParaCrmTool`
**Arquivo a modificar**: `pacotes/backend/src/agentes/admin-agent.ts` — corrigir prompt e ordem das etapas

### Critério de Aceite
- [ ] Lead nunca fica em status CAPTADO sem ter sido enviado ao CRM com sucesso
- [ ] Se o CRM falhar, o lead permanece em ONBOARDING e o agente tenta novamente
- [ ] Se o CRM tiver sucesso, o lead é marcado CAPTADO automaticamente pela tool

---

## 🟡 RISCO 6 — Redis expire apaga histórico de tool calls (histórico SDK perdido)

### Problema
O SDK do OpenAI Agents persiste o histórico rico (com tool calls) no Redis com TTL. Quando o Redis expira ou reinicia, o `cachedHistory` volta como `undefined` e o orchestrator perde o contexto de quais tools já foram chamadas. O agente pode re-qualificar leads já qualificados.

**Arquivo afetado**: [conversation-cache.ts](../../pacotes/backend/src/agentes/conversation-cache.ts) — TTL do Redis

### Solução
1. Aumentar o TTL do Redis para SDK history (hoje está curto para leads MORNO/FRIO que interagem com baixa frequência)
2. Criar fallback: ao detectar `cachedHistory === undefined` E lead já com dados (status > NOVO), reconstruir o contexto a partir do banco antes de executar o agente
3. Adicionar proteção idempotente nas tools `qualificar_lead` e `converter_para_lead`: verificar se os dados já foram salvos antes de sobrescrever

**Arquivo a modificar**: `pacotes/backend/src/agentes/conversation-cache.ts` — revisar TTL
**Arquivo a criar**: `pacotes/backend/src/agentes/history-recovery.ts` — reconstrução de contexto sem cache

### Critério de Aceite
- [ ] Lead com dados parciais não é re-qualificado do zero após restart do Redis
- [ ] Tools de qualificação verificam dados existentes antes de sobrescrever
- [ ] Log explícito quando operando sem cache SDK (para diagnóstico)

---

## 🟡 RISCO 7 — Schema State congelado durante fase HUMANO

### Problema
Durante `modoAtendimento === 'HUMANO'`, as mensagens são salvas no banco mas o `schemaState` no Redis não é atualizado. Quando a IA retoma, não tem conhecimento do que foi dito durante a fase humana.

**Arquivo afetado**: [webhook.ts:1558-1573](../../pacotes/backend/src/rotas/webhook.ts#L1558) — bloco de modo HUMANO

### Solução
Ao salvar mensagens no modo HUMANO, rodar em background (fire-and-forget, sem bloquear resposta) a extração de schema state da mensagem recebida.

```typescript
// Ao salvar mensagem em modo HUMANO:
// fire-and-forget:
atualizarSchemaStateComMensagemHumana(contatoId, conteudoEntrada).catch(err =>
  logger.warn('Falha ao atualizar schema state em modo HUMANO', err)
);
```

**Arquivo a modificar**: `pacotes/backend/src/rotas/webhook.ts` — bloco de tratamento modo HUMANO
**Arquivo a modificar**: `pacotes/backend/src/agentes/conversation-state.ts` — expor função para atualização incremental

### Critério de Aceite
- [ ] Dados mencionados pelo lead durante fase HUMANO aparecem no contexto quando IA retoma
- [ ] Admin Agent não repede informações já compartilhadas durante fase humana

---

## 🟡 RISCO 8 — Agent Chain Cache ignora briefing atualizado por 30 minutos

### Problema
O cache de agentes em memória (`agentChainCache`) tem TTL de 30 minutos. Se o tenant atualizar o briefing do empreendimento, os agentes continuam rodando com o conteúdo antigo até o cache expirar.

**Arquivo afetado**: [agent-chain.ts:182](../../pacotes/backend/src/agentes/agent-chain.ts#L182)

### Solução
Adicionar invalidação explícita do cache quando configurações do tenant/agente forem salvas.

**Arquivo a modificar**: `pacotes/backend/src/rotas/agentes.ts` — ao fazer PUT/PATCH de configuração, invalidar entrada do cache
**Arquivo a modificar**: `pacotes/backend/src/agentes/agent-chain.ts` — expor função `invalidarCacheAgente(tenantId: string)`

### Critério de Aceite
- [ ] Atualizar briefing do empreendimento reflete na próxima mensagem processada
- [ ] PUT /api/agentes/:id invalida o cache do tenant correspondente

---

## 🟡 RISCO 9 — CRM sem retry automático

### Problema
A tool `enviar_para_crm` faz uma única chamada HTTP sem retry. Falha de rede = lead perde CRM silenciosamente.

**Arquivo afetado**: [crm-service.ts:293-301](../../pacotes/backend/src/servicos/crm-service.ts#L293)

### Solução
1. Implementar retry com backoff exponencial (3 tentativas, delays: 2s, 8s, 30s) dentro da `enviarParaCrm()`
2. Criar job de reenvio automático para leads com `crmSyncStatus: 'error'` com mais de 1h

**Arquivo a modificar**: `pacotes/backend/src/servicos/crm-service.ts` — adicionar retry interno
**Arquivo a criar**: `pacotes/backend/src/jobs/reenviar-crm-falhos.job.ts` ← **NOVO**

### Critério de Aceite
- [ ] Falha temporária de rede não deixa lead sem CRM
- [ ] Job de reenvio roda a cada hora e tenta leads com `crmSyncStatus: 'error'`
- [ ] Após 5 tentativas falhas, alerta é enviado ao admin via notificação

---

## 🟠 RISCO 10 — encaminharCorretorTool pode não setar modoAtendimento=HUMANO

### Problema
A tool `encaminhar_corretor` pode atualizar o `corretorAssinado` do lead sem setar `modoAtendimento = 'HUMANO'` no contato. Resultado: IA e humano respondem ao mesmo lead simultaneamente.

**Arquivo afetado**: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts` — `encaminharCorretorTool`

### Solução
Garantir que `encaminharCorretorTool` sempre sete `modoAtendimento = 'HUMANO'` no contato associado ao lead.

**Arquivo a modificar**: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts`
**Arquivo a modificar**: `pacotes/backend/src/casos-de-uso/agentes/encaminhar-corretor.usecase.ts` — garantir que altera `modoAtendimento`

### Critério de Aceite
- [ ] Após `encaminhar_corretor`, IA para de responder ao lead automaticamente
- [ ] Painel mostra lead em modo HUMANO com indicação visual

---

## 📋 CHECKLIST DE MELHORIAS DA UI / DASHBOARD (Mission Control)

Além das falhas de fluxo, o print identificou 5 problemas de qualidade de dados e apresentação:

### UI-1 — Governança de Qualificação: dados não são coletados pelo agente

**Causa raiz**: O SDR Agent chama `qualificar_lead` com `situacaoAtual = "faz sentido sim"` (resposta afirmativa do lead, não a situação dele). O agente confunde a resposta do lead com o campo a ser preenchido.

**Solução**:
- Adicionar instrução explícita no prompt do SDR Agent: `situacaoAtual` deve descrever o contexto atual do imóvel, não o que o lead respondeu
- Adicionar validação na tool: filtrar valores `textoPoucoInformativo` antes de salvar (reutilizar a função já existente em `servico-priorizacao-leads.ts`)
- **Arquivo**: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts` — adicionar filtragem dos campos antes do `useCase.execute()`
- **Arquivo**: `pacotes/backend/src/agentes/sdr-agent.ts` — reforçar instrução sobre o que cada campo SPIN deve conter

### UI-2 — Resumo IA pobre ("Interesse em venda")

**Causa raiz**: `gerarResumoIA()` em `servico-priorizacao-leads.ts` monta o resumo a partir de campos do lead. Se só `interesseEm` estiver preenchido, o resumo tem apenas 1 parte.

**Solução**: O resumo deve ser gerado por LLM (modelo auxiliar, ~10 tokens de custo) a partir das últimas mensagens quando os campos estruturados estão incompletos. Armazenar em `lead.resumoIA` (novo campo) e atualizar a cada qualificação.

- **Arquivo a modificar**: `pacotes/backend/src/servicos/servico-priorizacao-leads.ts` — adicionar geração LLM como fallback
- **Arquivo a modificar**: `pacotes/backend/prisma/schema.prisma` — adicionar campo `resumoIA String?` ao model Lead
- **Arquivo a modificar**: `pacotes/backend/src/casos-de-uso/agentes/qualificar-lead.usecase.ts` — gerar e salvar `resumoIA` após qualificação

### UI-3 — Ação Urgente: só mostra primeiro motivo, perde contexto do agendamento

**Causa raiz**: `calcularUrgencia()` retorna `motivos[0]` apenas. O agendamento para 17h aparece no cálculo mas fica oculto.

**Solução**: Retornar todos os motivos e exibir os top-3 no Mission Control. O painel já tem espaço para isso.

- **Arquivo a modificar**: `pacotes/backend/src/servicos/servico-priorizacao-leads.ts` — alterar interface de retorno para `motivos: string[]` (array) em vez de `motivo: string`
- **Arquivo a modificar**: frontend `LeadDetalhes/index.tsx` e Mission Control card — consumir array de motivos
- **Adicionar**: orientações de próxima ação baseadas na combinação de motivos (ex: QUENTE + agendamento em 2h = "Ligue agora para confirmar")

### UI-4 — SPIN mostra "faz sentido sim" como situacaoAtual

**Causa raiz**: Mesma raiz do UI-1. O agente salvou uma resposta afirmativa do lead como `situacaoAtual`.

**Solução**: Mesma do UI-1 — filtrar valores `textoPoucoInformativo` antes de persistir qualquer campo SPIN. Adicionalmente, limpar valores existentes no banco que são claramente afirmações e não situações.

- **Arquivo a modificar**: `pacotes/backend/src/ferramentas/sdr-tools-agents.ts` — validação antes de salvar
- **Script de limpeza**: criar migration que reseta campos SPIN contendo apenas afirmativas

### UI-5 — Telemetria Operacional vazia

**Causa raiz dupla**:
1. `registrarTelemetriaTurno()` usa `acao: 'AGENT_TURNO'` mas o frontend busca `acao: { startsWith: 'COCKPIT_' }`. **Os prefixos não batem.**
2. `entidadeId` é salvo como `contatoId` quando `leadId` é nulo. O frontend busca por `leadId`. **Os IDs não batem.**

**Solução**:
- **Imediato**: Corrigir o prefixo das ações. Ou o backend usa `'COCKPIT_TURNO'` e `'COCKPIT_OUTCOME'`, ou o frontend busca por `'AGENT_TURNO'` e `'AGENT_OUTCOME'`
- **Imediato**: Ao logar telemetria, salvar tanto por `leadId` quanto por `contatoId` para garantir linkagem
- **Arquivo a modificar**: `pacotes/backend/src/agentes/telemetria-agente.ts` — corrigir prefixo das ações OU
- **Arquivo a modificar**: Frontend route de busca de métricas — ajustar o filtro `startsWith`

---

## PRIORIZAÇÃO SUGERIDA

| Sprint | Itens | Impacto |
|--------|-------|---------|
| **Sprint 1** (esta semana) | UI-5 (telemetria), UI-1+UI-4 (SPIN), Falha 4 (CRM cidade) | Rápidos, alto ROI imediato |
| **Sprint 2** | Falha 5 (ordem CRM/CAPTADO), UI-2 (resumo IA), UI-3 (motivos urgência) | Qualidade do fluxo final |
| **Sprint 3** | Falha 1 (retorno humano→IA), Falha 3 (race condition) | Fluxo crítico de handoff |
| **Sprint 4** | Falha 2 (contexto pós-humano), Riscos 6-9 | Resiliência e dados |

---

## NOTAS TÉCNICAS

- Todas as mudanças no schema Prisma requerem migration com `prisma migrate dev`
- As mudanças em `enviarParaCrmTool` e `moverParaFaseTool` devem ser testadas com o lead de teste `test-lead-onboarding` no ambiente de staging
- O job de retorno automático deve ter um flag de feature `RETORNO_AUTO_IA_ENABLED` para ativar gradualmente
- Antes de limpar dados SPIN no banco, fazer backup da tabela `leads`

---

*Documento gerado automaticamente a partir do RAIO-X AS-IS do fluxo do agente Elyon.*  
*Qualquer dúvida técnica, consultar os arquivos referenciados ou abrir issue no repositório.*
