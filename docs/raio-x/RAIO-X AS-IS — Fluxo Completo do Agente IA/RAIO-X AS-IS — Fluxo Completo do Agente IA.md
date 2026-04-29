RAIO-X AS-IS — Fluxo Completo do Agente IA
FLUXO GERAL (AS-IS)

[WhatsApp] → webhook.ts → buscarContatoProspeccao
                ↓
         [modoAtendimento?]
         HUMANO → salva msg, SILENCIA IA ← ⚠️ SEM RETORNO AUTOMÁTICO
         IA → debounce (5s) → consolida msgs
                ↓
         carregarHistoricoMensagens (DB, 50 msgs)
         buscarConfiguracaoTenant + buscarContextoConversa
                ↓
         processarMensagemOrquestrada
                ↓
    ┌──────── ORCHESTRATOR ────────┐
    │ 1. Guardrails de entrada     │
    │ 2. SchemaState (Redis)       │
    │ 3. determinarAgente          │
    │    SDR → status NOVO/QUAL.   │
    │    ADMIN → DOC/NEG/ONB/CAPT  │
    │ 4. Análise paralela:         │
    │    sentimento + objeção      │
    │ 5. Executar agente           │
    │ 6. Persistir histórico SDK   │
    │ 7. Filtros pós-resposta      │
    └──────────────────────────────┘
                ↓
    ┌── SDR AGENT ──┐    ┌── ADMIN AGENT ──┐
    │ MEIO_CAMPO    │    │ ETAPA1: Docs     │
    │ DESCOBERTA    │    │ ETAPA2: Contrato │
    │ DIAG_SPIN     │ →  │ ETAPA3: Imóvel   │
    │ PITCH         │    │ ETAPA4: CRM      │
    │ AGENDAMENTO   │    │ ETAPA5: CAPTADO  │
    └───────────────┘    └─────────────────┘
                ↓
    garantirConversaoAutomaticaSeElegivel (fallback)
                ↓
    enviarMensagemComRetry → WhatsApp
FALHAS CRÍTICAS IDENTIFICADAS
🔴 FALHA CRÍTICA 1 — Sem retorno automático Humano → IA
Localização: webhook.ts:1558-1573


const modoAtendimento = (contatoProspeccao as any).modoAtendimento || 'IA';
if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO') {
  registrarIgnorado(telefone, `modo ${modoAtendimento}`, contatoProspeccao.id);
  await salvarMensagemProspeccao({ ... });  // salva a msg
  continue;  // ← IA permanece MUDA para sempre
}
Impacto: Quando o humano termina a conversa, não existe nenhum mecanismo automático para reativar a IA. O campo modoAtendimento precisa ser alterado manualmente de HUMANO → IA. Se o corretor esquecer (o que é a norma), a IA nunca retoma o fluxo de onboarding/coleta de dados do imóvel. O lead fica em modo humano para sempre.

Não existe: nenhum job, nenhum timer, nenhum trigger no código que reverta esse estado automaticamente.

🔴 FALHA CRÍTICA 2 — Admin Agent não sabe o que o humano negociou
Localização: admin-agent.ts:216-239

O Admin Agent constrói o prompt usando ctx.tipoAutorizacao, ctx.comissaoAcordada, ctx.prazoTrabalho. Esses campos vêm do ElyonContext, que é construído a partir de buscarContextoConversa.

Problema: Durante a fase HUMANO, toda a conversa de negociação (comissão acordada, tipo de contrato, prazo) é salva apenas nas mensagens de WhatsApp, mas nunca é parseada e salva nos campos estruturados do lead. Quando o Admin Agent assume, ele:

Não sabe o que foi negociado
Pode pedir dados que o lead já deu ao corretor humano
Pode apresentar termos diferentes dos acordados pelo humano
O prompt diz "O cliente já ACORDOU os termos", mas os termos não estão no contexto — são campos nulos.

🔴 FALHA CRÍTICA 3 — Race condition na conversão automática
Localização: webhook.ts:1802-1807 vs ferramentas do agente


// APÓS o orchestrador executar:
if (!contatoPosOrquestrador?.virouLead || !contatoPosOrquestrador?.leadId) {
  await garantirConversaoAutomaticaSeElegivel({...}); // ← fallback com NLP simples
}
O orchestrador pode chamar converter_para_lead via tool E o webhook pode chamar garantirConversaoAutomaticaSeElegivel no mesmo turno. As duas operações rodam de forma independente. A verificação de idempotência (ALREADY_LEAD) existe no use case, mas:

Entre a tool call e a verificação pós-orquestrador existe uma janela de tempo
Em alta carga, dois webhooks do mesmo contato podem passar simultaneamente pelo check de virouLead
O mutex adquirirMutexContato protege contra concurrent messages mas não contra o fallback pós-execução
🔴 FALHA CRÍTICA 4 — CRM envia com cidade/estado hardcoded
Localização: crm-service.ts:193-194


cidade: enderecoParseado.cidade || 'Goiânia',
estado: enderecoParseado.estado || 'GO',
A função parseEndereco usa regex simples (/,?\s*([^,]+)\s*[-\/]\s*([A-Z]{2})$/i) para extrair cidade/estado de endereços como "Rua das Flores, 123, Setor Bueno". Para endereços sem separação de estado (que é a maioria dos endereços coletados via WhatsApp), o parse falha silenciosamente e todo lead é enviado ao CRM como sendo de Goiânia/GO, independente do endereço real. Isso corrompe dados no CRM sem qualquer alerta.

🔴 FALHA CRÍTICA 5 — Lead pode ir para CAPTADO sem enviar ao CRM
Localização: sdr-tools-agents.ts:568-573 + admin-agent.ts:148-155

O fluxo obrigatório do Admin Agent é:


ETAPA 4: enviar_para_crm
ETAPA 5: mover_para_fase("CAPTADO")
Mas a tool enviar_para_crm bloqueia se lead.status !== 'CAPTADO'. Portanto, o agente precisa mover para CAPTADO antes de enviar ao CRM — mas o prompt diz para enviar antes de marcar como CAPTADO. Contradição direta no fluxo: o prompt diz uma ordem, a tool impõe outra.

Na prática o agente pode:

Mover para CAPTADO → tentar enviar CRM → falha por dados incompletos → lead fica CAPTADO mas sem CRM
Tentar enviar CRM → recebe erro → nunca move para CAPTADO → loop
🟡 RISCO ALTO 1 — Histórico do DB ≠ Histórico SDK (Redis)
Localização: webhook.ts:1678 vs orchestrator.ts:291


// webhook.ts carrega do DB (texto plano):
const historicoMensagens = await carregarHistoricoMensagens(contatoProspeccao.id, 50);

// orchestrator.ts tenta pegar do Redis (com tool calls):
const cachedHistory = contexto.contatoId ? await getHistory(contexto.contatoId) : undefined;
Se o Redis expirar (TTL) ou reiniciar, o cachedHistory é undefined. O inputBuilder cai no caminho "primeiro turno" — sem tool call history. O agente perde o contexto de quais ferramentas já foram chamadas (se qualificar_lead já rodou, se o lead já foi convertido). Isso pode causar re-execução de tools e dados duplicados no banco.

🟡 RISCO ALTO 2 — Schema State perdido durante fase HUMANO
Localização: orchestrator.ts:296-323

O schemaState no Redis é atualizado a cada turno que passa pelo orchestrator. Durante a fase modoAtendimento === 'HUMANO', as mensagens são salvas no banco mas o orchestrator nunca executa. Quando a IA retoma, o schemaState está congelado no momento do handoff, sem incluir:

Informações de endereço compartilhadas pelo lead
Confirmações de termos negociados
Dados do imóvel mencionados ao humano
O agente retoma como se o lead nunca tivesse dito nada durante a fase humana.

🟡 RISCO ALTO 3 — Agent Chain Cache ignora briefing atualizado por 30 minutos
Localização: agent-chain.ts:182-230


const AGENT_CHAIN_TTL_MS = 30 * 60 * 1000; // 30 min
const agentChainCache = new Map<string, { agents: Record<TipoAgente, ElyonAgent>; lastAccess: number }>();
Se o tenant atualizar o briefing do empreendimento ou as configurações do agente, o agente em cache continua rodando com as configurações antigas por até 30 minutos. Para imobiliárias que ajustam preços ou diferenciais com frequência, isso é um problema real.

🟡 RISCO ALTO 4 — CRM sem retry automático na tool
Localização: sdr-tools-agents.ts:554-598

A tool enviar_para_crm faz uma única chamada HTTP sem retry. Se o CRM estiver instável no momento exato do envio, o lead fica em crmSyncStatus: 'error' e não há mecanismo automático de reenvio. A única forma de reenviar é via UI ou API manual (POST /api/leads/:id/crm/sync). Em um fluxo 100% automatizado, isso cria dead-ends invisíveis.

🟠 RISCO MÉDIO — encaminharCorretorTool não garante que modoAtendimento vira HUMANO
Localização: sdr-tools-agents.ts (encaminharCorretorTool)

O SDR Agent pode chamar encaminhar_corretor, que muda o corretorAssinado e statusAtribuicao do lead. Mas se essa tool não setar modoAtendimento = 'HUMANO' no contato, a IA continuará respondendo ao lead mesmo depois de "passá-lo" para o humano. O lead receberia respostas simultâneas do agente IA e do corretor humano.

SUMÁRIO EXECUTIVO
#	Ponto	Severidade	Descrição curta
1	Retorno Humano → IA	🔴 Crítico	Sem mecanismo automático — IA silencia para sempre
2	Contexto pós-humano	🔴 Crítico	Admin Agent não sabe o que o humano negociou
3	Race condition conversão	🔴 Crítico	Tool + fallback podem criar leads duplicados
4	CRM cidade hardcoded	🔴 Crítico	Todo lead enviado como Goiânia/GO por padrão
5	Ordem CRM vs CAPTADO	🔴 Crítico	Contradição no fluxo — lead pode ficar CAPTADO sem CRM
6	Redis expire = perda de state	🟡 Alto	Tool call history perdido após restart/TTL
7	Schema state congelado	🟡 Alto	Dados da fase humana nunca entram no contexto da IA
8	Cache de 30 min	🟡 Alto	Agente roda com briefing desatualizado
9	CRM sem retry	🟡 Alto	Falha de rede → lead fica preso sem reenvio
10	modoAtendimento no handoff	🟠 Médio	IA pode continuar respondendo após handoff humano
As três correções que impactam mais o fluxo imediatamente:

Falha 1 → implementar timer ou API de "devolver para IA" que reseta modoAtendimento e dispara o Admin Agent com contexto da conversa humana
Falha 5 → inverter a lógica do enviarParaCrmTool — remover o bloqueio por status CAPTADO e fazer o CAPTADO ser consequência do sucesso no CRM
Falha 4 → CRM service precisa de fallback de cidade/estado via geocode ou manter nulo em vez de default hardcoded
