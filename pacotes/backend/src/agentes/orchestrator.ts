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
import { getHistory, setHistory, getCacheStats, getLastAgent, clearHistory } from './conversation-cache';
import { gerarBriefingHandoff, removeHandoffNarration, sliceHistoryPreservingSystem } from './handoff-filters';

// Módulos extraídos
import {
    extrairEstadoConversa,
    gerarFallbackContextual,
    respostaRepetePerguntaCritica,
    deveForcarTransicaoParaPresenter,
} from './conversation-state';
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
            console.log(`[ORCHESTRATOR] 🤝 Lead em fase humana (${contexto.statusLead}). Resposta operacional sem negociação por IA.`);
            logMetricaOrchestrator({
                tenantId: config.tenantId,
                telefone: contexto.telefone,
                contatoId: contexto.contatoId,
                leadId: contexto.leadId,
                statusLead: contexto.statusLead,
                faseFluxo: faseFluxoAtual,
                agenteInicial: 'ADMIN',
                agenteFinal: 'ADMIN',
                toolCalls: 0,
                handoffs: 0,
                fallback: 'FASE_HUMANA_BYPASS',
                duracaoMs: Date.now() - inicioTurno,
                sucesso: true
            });
            return {
                sucesso: true,
                resposta: 'Perfeito! Você está na etapa de formalização com nosso time humano. Já sinalizei sua mensagem para continuidade por aqui, combinado?',
                agenteUsado: 'ADMIN'
            };
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

        const construirInputPrimeiroTurno = (): any[] => {
            // 🆕 PRIMEIRO TURNO: construir input com contexto completo
            // Montar seção de contexto da imobiliária (RAG dinâmico ou fallback)
            let secaoMetodoTrabalho: string;
            if (config.ragPerfilTexto) {
                secaoMetodoTrabalho = `PERFIL COMPLETO DA IMOBILIÁRIA (USE SEMPRE):\n${config.ragPerfilTexto}`;
            } else {
                secaoMetodoTrabalho = `NOSSO MÉTODO DE TRABALHO (USE NO PITCH SE A INTENÇÃO FOR VALIDADA):
- Nossa comissão é de ${config.comissaoPadrao || '6%'}
- Contrato de Consultoria de ${config.prazoContrato || 180} dias
- Rede de Parceiros conectada: Imóvel ganha visibilidade de dezenas de corretores da cidade trabalhando de forma organizada
- Apresentação Premium: Avaliação com IA, Fotos Profissionais, Vídeo e Tour 360º
- Diferenciais: ${config.diferenciais?.join(', ') || 'Avaliação com IA, Material Profissional, Rede de Parceiros'}`;
            }

            // Montar seção de briefing do empreendimento
            let secaoBriefing = '';
            if (config.briefingEmpreendimento) {
                secaoBriefing = `\n\nCONHECIMENTO DO EMPREENDIMENTO: ${contexto.empreendimento || 'N/A'}\n${config.briefingEmpreendimento}\n⚠️ USE esses dados! NÃO pergunte coisas que você já sabe!`;
            }

            // Contexto semântico do lead
            const contextoLead = `CONTEXTO DO LEAD (MEMÓRIA SEMÂNTICA):
- ID: ${contexto.leadId || contexto.contatoId || 'N/A'}
- Fila do Funil: ${contexto.statusLead || 'Novo contato frio'}
- Dores/Objeções Anteriores: ${contexto.doresIdentificadas?.join(', ') || 'Nenhuma objeção mapeada ainda'}

${secaoMetodoTrabalho}${secaoBriefing}

ESTADO RESUMIDO (NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS):
- Intenção: ${estadoConversaAtual.intencao || 'não confirmada'}
- Metragem: ${estadoConversaAtual.metragem || 'não confirmada'}
- Ocupação: ${estadoConversaAtual.ocupacao || 'não confirmada'}
- Valor pretendido: ${estadoConversaAtual.valorPretendido || 'não confirmado'}
- Já respondeu decisão de venda: ${estadoConversaAtual.jaRespondeuDecisao ? 'SIM — NUNCA mais pergunte se já decidiu vender' : 'não'}
${estadoConversaAtual.valorPretendido ? '⛔ O proprietário JÁ informou o valor. NÃO pergunte o valor novamente.' : ''}
${estadoConversaAtual.intencao ? '⛔ A intenção JÁ foi confirmada como ' + estadoConversaAtual.intencao + '. NÃO pergunte se quer vender ou alugar.' : ''}

📦 REGRA DE TOOL: Se você já coletou intenção + metragem + ocupação + valor, chame qualificar_lead IMEDIATAMENTE com todos os dados antes de responder.

Lembre-se: Extraia a intenção, faça o pitch de valor e peça para avaliar o imóvel. Responda à última mensagem do proprietário.`;

            // Construir array de AgentInputItem[]
            const inputItems: any[] = [
                // System context como primeira mensagem
                { role: 'system' as const, content: contextoLead }
            ];

            // Adicionar histórico do BD como mensagens user/assistant
            // IMPORTANTE: Responses API espera content como array de objetos, não string
            for (const msg of mensagens) {
                if (msg.role === 'user') {
                    inputItems.push({
                        role: 'user' as const,
                        content: [{ type: 'input_text', text: msg.content }]
                    });
                } else if (msg.role === 'assistant') {
                    inputItems.push({
                        type: 'message',
                        role: 'assistant' as const,
                        content: [{ type: 'output_text', text: msg.content }],
                        status: 'completed'
                    });
                }
            }

            return inputItems;
        };

        let inputSDK: any;

        if (cachedHistory && cachedHistory.length > 0) {
            // ✅ TURNO SUBSEQUENTE: usar histórico SDK + nova mensagem
            const ultimaMsgUser = mensagens.filter(m => m.role === 'user').pop();
            inputSDK = [
                ...cachedHistory,
                {
                    role: 'system' as const,
                    content: `ESTADO RESUMIDO (NÃO REPITA O QUE JÁ FOI RESPONDIDO): intenção=${estadoConversaAtual.intencao || 'n/a'}, metragem=${estadoConversaAtual.metragem || 'n/a'}, ocupação=${estadoConversaAtual.ocupacao || 'n/a'}, valor=${estadoConversaAtual.valorPretendido || 'n/a'}, decisão já respondida=${estadoConversaAtual.jaRespondeuDecisao ? 'SIM-NÃO PERGUNTE NOVAMENTE' : 'não'}. ${estadoConversaAtual.valorPretendido ? 'NÃO pergunte o valor novamente.' : ''} ${estadoConversaAtual.intencao ? 'NÃO pergunte se quer vender ou alugar.' : ''} Se tem intenção+metragem+ocupação+valor, chame qualificar_lead COM TODOS OS DADOS.`
                },
                { role: 'user' as const, content: ultimaMsgUser?.content || '' }
            ];
            console.log(`[ORCHESTRATOR] 📜 Usando cache SDK: ${cachedHistory.length} itens + nova mensagem`);
        } else {
            inputSDK = construirInputPrimeiroTurno();
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

                inputSDK = construirInputPrimeiroTurno();
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
            try {
                const history = (result as any).history;
                if (history && Array.isArray(history)) {
                    const lastAgentName = (result as any).lastAgent?.name;
                    const historySemNarracao = removeHandoffNarration(history as any);
                    const historyFinal = sliceHistoryPreservingSystem(historySemNarracao as any, 20, 'Persistência Orchestrator');
                    await setHistory(contexto.contatoId, historyFinal, lastAgentName);
                    // Log de observabilidade: itens gerados neste turno
                    const newItems = (result as any).newItems;
                    if (newItems && Array.isArray(newItems)) {
                        const toolCalls = newItems.filter((i: any) =>
                            i.type === 'tool_call_item' ||
                            i.type === 'tool_call_output_item' ||
                            i.type === 'function_call' ||
                            i.type === 'function_call_result'
                        );
                        const handoffs = newItems.filter((i: any) => i.type === 'handoff_call_item' || i.type === 'handoff_output_item');
                        nomesToolsTurno = toolCalls
                            .map((i: any) => i.name || i.tool_name)
                            .filter((n: any) => typeof n === 'string' && n.length > 0);
                        toolCallsTurno = toolCalls.length;
                        handoffsTurno = handoffs.length;

                        const stats = await getCacheStats();
                        console.log(`[ORCHESTRATOR] 📊 Turno SDK: ${newItems.length} itens gerados (${toolCalls.length} tool calls, ${handoffs.length} handoffs). Cache: ${stats.redisKeys} Redis + ${stats.memoryKeys} memória.`);
                    }
                }
            } catch (histErr) {
                console.warn('[ORCHESTRATOR] ⚠️ Erro ao salvar history SDK (não-crítico):', histErr);
            }
        }

        // 6. EXTRAIR RESPOSTA
        let respostaFinal: string;
        if (typeof result.finalOutput === 'string') {
            respostaFinal = result.finalOutput;
        } else if (result.finalOutput && typeof result.finalOutput === 'object' && 'respostaParaOCliente' in result.finalOutput) {
            respostaFinal = (result.finalOutput as any).respostaParaOCliente;
            console.log(`[ORCHESTRATOR] 📦 Structured Output detectado. Próximo passo: ${(result.finalOutput as any).proximoPasso}`);
        } else {
            respostaFinal = JSON.stringify(result.finalOutput);
        }

        // Parse Chain-of-Thought (CoT) block gerado pelo agente
        const cotMatch = respostaFinal.match(/<cot>[\s\S]*?<\/cot>/);
        let cotLog = null;
        if (cotMatch) {
            cotLog = cotMatch[0];
            respostaFinal = respostaFinal.replace(/<cot>[\s\S]*?<\/cot>\s*/, '').trim();
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

        // 🔴 FILTRO ANTI-NARRAÇÃO DE HANDOFF (duas camadas)
        // Camada 1: Regex para padrões conhecidos de narração
        const padroesHandoff = [
            /transferindo/i,
            /transfer[eê]ncia/i,
            /pr[oó]ximo\s+agente/i,
            /aguard[ea]\s+(s[oó]\s+)?um\s+(instante|momento)/i,
            /vou\s+te\s+passar/i,
            /vou\s+transferir/i,
            /s[oó]\s+um\s+instante/i,
            /j[aá]\s+estou\s+aqui/i,
            /pronto.*aqui/i,
            /agente\s+(apresentador|closer|admin)/i,
        ];

        // Limpar linhas que são narração de handoff, preservar o resto
        const linhas = respostaFinal.split('\n');
        const linhasLimpas = linhas.filter(linha => {
            const linhaTrimmed = linha.trim();
            if (!linhaTrimmed) return true;
            return !padroesHandoff.some(p => p.test(linhaTrimmed));
        });
        let respostaLimpa = linhasLimpas.join('\n').trim();

        // Camada 2: Heurística — se houve handoff real E a resposta é muito curta sem pergunta, é narração
        if (houveHandoff && respostaLimpa.length > 0 && respostaLimpa.length < 60 && !respostaLimpa.includes('?')) {
            console.log(`[ORCHESTRATOR] 🚫 Heurística: resposta curta sem pergunta após handoff, provavelmente narração: "${respostaLimpa}"`);
            respostaLimpa = '';
        }

        // Camada 3: fallback contextual quando houve handoff e a resposta ficou vazia
        if (!respostaLimpa && houveHandoff) {
            console.warn('[ORCHESTRATOR] ⚠️ Resposta vazia após handoff. Aplicando fallback contextual por agente.');
            fallbackAplicado = 'EMPTY_AFTER_HANDOFF';

            if (agenteQueRespondeuFormatado === 'ADMIN') {
                respostaLimpa = 'Ótimo! Pra eu seguir com seu onboarding, posso começar confirmando seu CPF e e-mail?';
            } else {
                respostaLimpa = gerarFallbackContextual(estadoConversaAtual, agenteQueRespondeuFormatado);
            }
        }

        // Camada 4: Se o LLM alucinou apenas o CoT e não respondeu nem acionou a Tool
        if (!respostaLimpa && !houveHandoff) {
            const cotTexto = (cotLog || '').toLowerCase();
            const indicioTransicaoPresenter =
                tipoAgente === 'OPENER' &&
                /(transferir\s+para\s+presenter|handoff|transi(ç|c)[aã]o|diagn[oó]stico)/i.test(cotTexto);

            const presenterExecutouToolCritica =
                agenteQueRespondeuFormatado === 'PRESENTER' &&
                nomesToolsTurno.some(nome => /mover_para_fase|qualificar_lead/i.test(nome));

            if (indicioTransicaoPresenter) {
                console.warn('[ORCHESTRATOR] ⚠️ Falha na transição OPENER→PRESENTER detectada via CoT. Aplicando fallback consultivo.');
                respostaLimpa = gerarFallbackContextual(estadoConversaAtual, 'PRESENTER');
                fallbackAplicado = 'OPENER_PRESENTER_TRANSITION';
            } else if (presenterExecutouToolCritica) {
                console.warn('[ORCHESTRATOR] ⚠️ Presenter executou tool crítica, mas retornou resposta vazia. Aplicando fallback de continuidade comercial.');
                respostaLimpa = 'Perfeito, faz total sentido. Posso te mostrar agora, em 1 minuto, como a nossa estratégia aumenta as visitas qualificadas no seu imóvel?';
                fallbackAplicado = 'PRESENTER_TOOL_EMPTY_OUTPUT';
            } else {
                console.warn(`[ORCHESTRATOR] ⚠️ Alerta: O LLM falhou em gerar resposta ou tool call. Usando fallback.`);
                respostaLimpa = "Desculpe, deu um pequeno erro aqui. Pode repetir por favor?";
                fallbackAplicado = 'GENERIC_FALLBACK';
            }
        }

        if (respostaLimpa !== respostaFinal.trim()) {
            console.log(`[ORCHESTRATOR] 🧹 Filtro handoff aplicado. Original: "${respostaFinal.trim().substring(0, 80)}" → Limpo: "${respostaLimpa.substring(0, 80)}"`);
            if (fallbackAplicado === 'NONE') {
                fallbackAplicado = 'HANDOFF_NARRATION_FILTER';
            }
        }

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
