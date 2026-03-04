/**
 * ORCHESTRATOR - Orquestrador dos 4 Agentes de Captação
 * 
 * Responsável por:
 * 1. Executar guardrails de entrada
 * 2. Determinar qual agente deve atender baseado no status do lead
 * 3. Processar a mensagem com o agente correto
 * 4. Gerenciar handoffs silenciosos entre agentes
 * 
 * @version 2.0 — refatorado em módulos (04/03/2026)
 * @date 16/12/2025
 */

import { run, setTracingExportApiKey } from '@openai/agents';
import { prisma } from '../lib/db';
import { executarGuardrails, GuardrailResult, MensagemContext } from './guardrails';
import type { ElyonContext } from './elyon-context';
import { getHistory, setHistory, getLastAgent, clearHistory } from './conversation-cache';
import { gerarBriefingHandoff } from './handoff-filters';
import { persistirHistoricoSdk } from './history-persistence';
import { extrairRespostaECot } from './output-extraction';
import { construirInputSdk } from './input-builder';

// Módulos extraídos
import {
    extrairEstadoConversa,
    gerarFallbackContextual,
    respostaRepetePerguntaCritica,
    deveForcarTransicaoParaPresenter,
} from './conversation-state';
import { aplicarFiltrosRespostaOrchestrator } from './response-filters';
import {
    TipoAgente,
    STATUS_FASE_HUMANA,
    fasePorStatus,
    determinarAgente,
    criarAgente,
    ultimoAgentePorContato,
    MAPA_NOMES_AGENTES,
} from './agent-chain';

// Re-exports para consumidores existentes (webhook.ts, sdr-tools-agents.ts)
export { buscarConfiguracaoTenant, buscarContextoConversa } from './orchestrator-queries';

// Ativar Tracing para o Dashboard OpenAI (platform.openai.com/traces)
if (process.env.OPENAI_API_KEY) {
    setTracingExportApiKey(process.env.OPENAI_API_KEY);
    console.log('[ORCHESTRATOR] 📊 Tracing ativado → platform.openai.com/traces');
}

// ====================================
// TIPOS
// ====================================

export interface ConfiguracaoOrquestrador {
    tenantId: string;
    nomeAgente: string;
    genero: string;
    nomeImobiliaria: string;
    cidade?: string;
    diferenciais?: string[];
    comissaoPadrao?: string;
    prazoContrato?: number;
    ragPerfilTexto?: string;
    briefingEmpreendimento?: string;
    // BYOK — provedor e modelo do tenant (opcional, fallback ao padrão se ausente)
    llmModelo?: string;    // ex: "claude-sonnet-4-20250514"
    llmBaseUrl?: string;   // ex: "https://openrouter.ai/api/v1"
    llmApiKey?: string;    // decriptografada (nunca persiste no banco assim)
}

export interface ContextoConversa {
    telefone: string;
    contatoId?: string;
    leadId?: string;
    statusLead?: string;
    doresIdentificadas?: string[];
    empreendimento?: string;
    situacaoAtual?: string; // "tem_corretor", "sozinho", "desistiu_corretor"
    tipoAutorizacao?: string;
    comissaoAcordada?: string;
    prazoTrabalho?: number;
}

export interface ResultadoProcessamento {
    sucesso: boolean;
    resposta?: string;
    agenteUsado?: string;
    guardrailAcionado?: GuardrailResult;
    erro?: string;
}

// ====================================
// HELPERS LOCAIS
// ====================================

function shortId(valor?: string): string | null {
    if (!valor) return null;
    return valor.length > 8 ? `${valor.substring(0, 8)}...` : valor;
}

function logMetricaOrchestrator(params: {
    tenantId: string;
    telefone?: string;
    contatoId?: string;
    leadId?: string;
    statusLead?: string;
    faseFluxo: string;
    agenteInicial?: TipoAgente;
    agenteFinal?: TipoAgente;
    toolCalls: number;
    handoffs: number;
    fallback: string;
    guardrail?: string;
    duracaoMs: number;
    sucesso: boolean;
    erro?: string;
}) {
    const payload = {
        ts: new Date().toISOString(),
        tenantId: params.tenantId,
        telefone: params.telefone || null,
        contatoId: shortId(params.contatoId),
        leadId: shortId(params.leadId),
        statusLead: params.statusLead || 'SEM_STATUS',
        faseFluxo: params.faseFluxo,
        agenteInicial: params.agenteInicial || null,
        agenteFinal: params.agenteFinal || null,
        toolCalls: params.toolCalls,
        handoffs: params.handoffs,
        fallback: params.fallback,
        guardrail: params.guardrail || null,
        duracaoMs: params.duracaoMs,
        sucesso: params.sucesso,
        erro: params.erro || null
    };

    console.log(`[ORCH-METRICS] ${JSON.stringify(payload)}`);
}

// ====================================
// PROCESSAR MENSAGEM
// ====================================

export async function processarMensagemOrquestrada(
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa,
    profundidade: number = 0 // Mantido para retrocompatibilidade, mas não mais usado
): Promise<ResultadoProcessamento> {
    const inicioTurno = Date.now();

    try {
        const faseFluxoAtual = fasePorStatus(contexto.statusLead);
        let fallbackAplicado = 'NONE';
        let toolCallsTurno = 0;
        let handoffsTurno = 0;

        console.log(`[ORCHESTRATOR] Processando mensagem para ${contexto.telefone}`);

        // 1. EXECUTAR GUARDRAILS DE ENTRADA (opt-out, spam, blacklist, comprador)
        const ultimaMensagem = mensagens.filter(m => m.role === 'user').pop();
        if (ultimaMensagem) {
            const guardrailCtx: MensagemContext = {
                telefone: contexto.telefone,
                conteudo: ultimaMensagem.content,
                tenantId: config.tenantId,
                contatoId: contexto.contatoId,
                leadId: contexto.leadId,
                timestamp: new Date()
            };

            const guardrailResult = await executarGuardrails(guardrailCtx);

            if (!guardrailResult.permitido) {
                console.log(`[ORCHESTRATOR] Guardrail acionado: ${guardrailResult.tipo} telefone=${contexto.telefone} acao=${guardrailResult.acao || 'N/A'}`);
                logMetricaOrchestrator({
                    tenantId: config.tenantId,
                    telefone: contexto.telefone,
                    contatoId: contexto.contatoId,
                    leadId: contexto.leadId,
                    statusLead: contexto.statusLead,
                    faseFluxo: faseFluxoAtual,
                    toolCalls: 0,
                    handoffs: 0,
                    fallback: 'GUARDRAIL_BLOCK',
                    guardrail: guardrailResult.tipo,
                    duracaoMs: Date.now() - inicioTurno,
                    sucesso: true
                });
                return {
                    sucesso: true,
                    resposta: guardrailResult.mensagemFallback,
                    guardrailAcionado: guardrailResult
                };
            }
        }

        if (contexto.statusLead && STATUS_FASE_HUMANA.has(contexto.statusLead)) {
            console.log(`[ORCHESTRATOR] 🤝 Lead em fase humana (${contexto.statusLead}). Roteando para ADMIN agent.`);
            // Não mais retorna resposta fixa — deixa o Admin agent responder
            // de forma contextual (pode ser dúvida, urgência, desistência, etc.)
        }

        let agentePersistido: TipoAgente | undefined;
        if (contexto.contatoId) {
            const ultimoPersistido = await getLastAgent(contexto.contatoId);
            if (ultimoPersistido === 'OPENER' || ultimoPersistido === 'PRESENTER' || ultimoPersistido === 'ADMIN') {
                agentePersistido = ultimoPersistido;
                ultimoAgentePorContato.set(contexto.contatoId, ultimoPersistido);
            } else if (ultimoPersistido === 'CLOSER') {
                agentePersistido = 'PRESENTER';
                console.log('[ORCHESTRATOR] ♻️ Agente legado CLOSER encontrado no cache. Migrando para PRESENTER.');
                ultimoAgentePorContato.set(contexto.contatoId, 'PRESENTER');
            }
        }

        // 2. DETERMINAR AGENTE INICIAL baseado no status do lead/cache persistido
        let tipoAgente = determinarAgente(contexto.statusLead, contexto.contatoId, agentePersistido);

        if (tipoAgente === 'OPENER' && deveForcarTransicaoParaPresenter(mensagens)) {
            tipoAgente = 'PRESENTER';
            console.log('[ORCHESTRATOR] 🧭 Fallback determinístico: confirmação de prioridade detectada, roteando direto para PRESENTER.');
        }

        console.log(`[ORCHESTRATOR] Agente inicial: ${tipoAgente} (status: ${contexto.statusLead || 'sem lead'})`);

        // 3. CRIAR CADEIA DE AGENTES COM HANDOFFS NATIVOS
        // SDK gerencia automaticamente as transferências via tools transfer_to_*
        const agente = criarAgente(tipoAgente, config, contexto);

        // 4. PREPARAR INPUT ESTRUTURADO (SDK Conversations)
        // Tentar recuperar histórico SDK do cache (preserva tool calls e handoffs)
        const cachedHistory = contexto.contatoId ? await getHistory(contexto.contatoId) : undefined;

        const estadoConversaAtual = extrairEstadoConversa(mensagens);

        const inputBuilderResult = construirInputSdk({
            mensagens,
            cachedHistory,
            estadoConversaAtual,
            config,
            contexto,
        });
        let inputSDK: any = inputBuilderResult.inputSDK;

        if (inputBuilderResult.origem === 'cache') {
            console.log(`[ORCHESTRATOR] 📜 Usando cache SDK: ${inputBuilderResult.cachedHistoryLength} itens + nova mensagem`);
        } else {
            console.log(`[ORCHESTRATOR] 🆕 Primeiro turno SDK: ${inputSDK.length} itens (1 system + ${mensagens.length} mensagens)`);
        }

        // Identificar se houve transferência (agente atual vem do cache)
        let textoUltimaInteracao = undefined;
        if (contexto.contatoId && ultimoAgentePorContato.has(contexto.contatoId)) {
            const agenteCache = ultimoAgentePorContato.get(contexto.contatoId);
            textoUltimaInteracao = `ATENÇÃO: Este lead acabou de ser transferido automaticamente para você (${agenteCache}). A conversa já está em andamento. Leia o histórico, NÃO SE APRESENTE NOVAMENTE e continue de onde parou de forma fluida.`;
        }

        // 5. CONSTRUIR CONTEXTO TIPADO
        const elyonContext: ElyonContext = {
            tenantId: config.tenantId,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            telefone: contexto.telefone,
            statusLead: contexto.statusLead,
            doresIdentificadas: contexto.doresIdentificadas,
            empreendimento: contexto.empreendimento,
            situacaoAtual: contexto.situacaoAtual,
            nomeAgente: config.nomeAgente,
            genero: config.genero,
            nomeImobiliaria: config.nomeImobiliaria,
            cidade: config.cidade,
            diferenciais: config.diferenciais,
            comissaoPadrao: config.comissaoPadrao,
            prazoContrato: config.prazoContrato,
            ragPerfilTexto: config.ragPerfilTexto,
            briefingEmpreendimento: config.briefingEmpreendimento,
            tipoAutorizacao: contexto.tipoAutorizacao,
            comissaoAcordada: contexto.comissaoAcordada,
            prazoTrabalho: contexto.prazoTrabalho,
            ultimaInteracao: textoUltimaInteracao,
            prisma
        };

        // 6. EXECUTAR AGENTE (SDK gerencia handoffs automaticamente)
        let nomesToolsTurno: string[] = [];
        let result: any;
        try {
            result = await run(agente, inputSDK, {
                context: elyonContext
            });
        } catch (runError: any) {
            const mensagemErro = String(runError?.message || '');
            const erroReasoningContent = /reasoning_content is missing/i.test(mensagemErro);

            if (erroReasoningContent && cachedHistory && cachedHistory.length > 0) {
                console.warn('[ORCHESTRATOR] ⚠️ Histórico SDK incompatível com LLM atual (reasoning_content). Limpando cache e retry sem histórico SDK.');

                if (contexto.contatoId) {
                    await clearHistory(contexto.contatoId);
                    console.log(`[ORCHESTRATOR] 🧹 Cache SDK limpo para ${contexto.contatoId.substring(0, 8)}...`);
                }

                inputSDK = construirInputSdk({
                    mensagens,
                    estadoConversaAtual,
                    config,
                    contexto,
                }).inputSDK;
                console.log(`[ORCHESTRATOR] 🔁 Retry sem cache SDK: ${inputSDK.length} itens (1 system + ${mensagens.length} mensagens)`);

                result = await run(agente, inputSDK, {
                    context: elyonContext
                });
            } else {
                throw runError;
            }
        }

        // 6.1 PERSISTIR HISTÓRICO SDK (preserva tool calls e handoffs para o próximo turno)
        if (contexto.contatoId) {
            const persistenciaResult = await persistirHistoricoSdk(contexto.contatoId, result);
            nomesToolsTurno = persistenciaResult.nomesToolsTurno;
            toolCallsTurno = persistenciaResult.toolCallsTurno;
            handoffsTurno = persistenciaResult.handoffsTurno;
        }

        // 6. EXTRAIR RESPOSTA
        const outputExtraido = extrairRespostaECot(result);
        let respostaFinal = outputExtraido.respostaFinal;
        const cotLog = outputExtraido.cotLog;
        if (outputExtraido.structuredOutputDetectado) {
            console.log(`[ORCHESTRATOR] 📦 Structured Output detectado. Próximo passo: ${outputExtraido.proximoPasso}`);
        }
        if (cotLog) {
            console.log(`[ORCHESTRATOR] 🧠 CoT: \n${cotLog}`);
        }

        // Identificar qual agente respondeu (pode ser diferente do inicial se houve handoff)
        const nomeRealAgenteRespondeu = (result as any).lastAgent?.name;
        const agenteQueRespondeuFormatado = nomeRealAgenteRespondeu ? (MAPA_NOMES_AGENTES[nomeRealAgenteRespondeu] || 'OPENER') : tipoAgente;

        console.log(`[ORCHESTRATOR] ✅ Resposta gerada por: ${nomeRealAgenteRespondeu || tipoAgente} (Mapeado: ${agenteQueRespondeuFormatado})`);

        // 🔑 PERSISTIR AGENTE APÓS HANDOFF
        // Se houve handoff, salvar o novo agente para que a próxima mensagem seja roteada corretamente
        const houveHandoff = agenteQueRespondeuFormatado !== tipoAgente;

        if (houveHandoff && contexto.contatoId) {
            const novoTipo = agenteQueRespondeuFormatado;
            ultimoAgentePorContato.set(contexto.contatoId, novoTipo);
            console.log(`[ORCHESTRATOR] 🔄 Handoff detectado: ${tipoAgente} → ${novoTipo}. Salvo no cache para próxima mensagem.`);

            // 🧠 BRIEFING LLM PÓS-HANDOFF: gerar resumo estratégico e injetar no cache
            // O briefing fica disponível para o próximo turno do novo agente
            try {
                const cachedHist = await getHistory(contexto.contatoId);
                if (cachedHist && cachedHist.length > 0) {
                    const briefing = await gerarBriefingHandoff(cachedHist, tipoAgente, novoTipo);
                    if (briefing) {
                        // Prepend briefing no cache para o próximo turno
                        await setHistory(contexto.contatoId, [briefing, ...cachedHist], agenteQueRespondeuFormatado);
                        console.log(`[ORCHESTRATOR] 🧠 Briefing LLM injetado no cache para ${novoTipo}`);
                    }
                }
            } catch (briefErr) {
                console.warn('[ORCHESTRATOR] ⚠️ Erro ao gerar briefing pós-handoff (não-crítico):', briefErr);
            }
        }

        const filtroResposta = aplicarFiltrosRespostaOrchestrator({
            respostaFinal,
            houveHandoff,
            tipoAgente,
            agenteQueRespondeuFormatado,
            estadoConversaAtual,
            cotLog,
            nomesToolsTurno,
            fallbackAplicadoAtual: fallbackAplicado,
        });

        let respostaLimpa = filtroResposta.respostaLimpa;
        fallbackAplicado = filtroResposta.fallbackAplicado;

        if (respostaRepetePerguntaCritica(respostaLimpa, mensagens)) {
            console.warn('[ORCHESTRATOR] ⚠️ Guarda anti-repetição acionada. Resposta repetia pergunta crítica já feita.');
            fallbackAplicado = 'ANTI_REPEAT_GUARD';

            respostaLimpa = gerarFallbackContextual(estadoConversaAtual, agenteQueRespondeuFormatado);
        }

        logMetricaOrchestrator({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: faseFluxoAtual,
            agenteInicial: tipoAgente,
            agenteFinal: agenteQueRespondeuFormatado,
            toolCalls: toolCallsTurno,
            handoffs: handoffsTurno,
            fallback: fallbackAplicado,
            duracaoMs: Date.now() - inicioTurno,
            sucesso: true
        });

        return {
            sucesso: true,
            resposta: respostaLimpa,
            agenteUsado: agenteQueRespondeuFormatado
        };

    } catch (error: any) {
        console.error(`[ORCHESTRATOR] Erro:`, error);
        logMetricaOrchestrator({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: fasePorStatus(contexto.statusLead),
            toolCalls: 0,
            handoffs: 0,
            fallback: 'EXCEPTION',
            duracaoMs: Date.now() - inicioTurno,
            sucesso: false,
            erro: error?.message || 'Erro desconhecido no orquestrador'
        });
        return {
            sucesso: false,
            erro: error.message || 'Erro desconhecido no orquestrador'
        };
    }
}
