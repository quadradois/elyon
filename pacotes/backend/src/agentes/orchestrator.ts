/**
 * ORCHESTRATOR - Orquestrador da Cadeia de Agentes de Captação
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

import { setTracingExportApiKey } from '@openai/agents';
import { prisma } from '../lib/db';
import type { Lead, Prisma } from '@prisma/client';
import type { SchemaState } from './conversation-state';
import type { ElyonRunResult, AgentInputItem } from './types';
import { executarGuardrails, GuardrailResult } from './guardrails';
import type { ElyonContext } from './elyon-context';
import type { MessageItem } from './types';
import { getHistory, setHistory, getLastAgent, clearHistory } from './conversation-cache';
import { gerarBriefingHandoff } from './handoff-filters';
import { persistirHistoricoSdk } from './history-persistence';
import { extrairRespostaECot } from './output-extraction';
import { construirInputSdk } from './input-builder';
import { construirElyonContext } from './context-builder';
import { executarAgenteComRetry } from './agent-runner';
import { processarPosHandoff } from './post-handoff';
import { logMetricaOrchestrator } from './orchestrator-metrics';
import { ServicoAuditoria } from '../servicos/servico-auditoria';
import { resolverAgenteFinal, logAgenteResolvido } from './agent-resolution';
import { executarGuardrailsEntrada } from './entry-guardrail';
import { resolverAgentePersistido } from './persisted-agent';
import { analisarSentimento, gerarInstrucaoSentimento } from './sentiment-analyzer';
import { tentarDetectarObjecao } from './classificador-objecao';
import { tentarPreCarregarSkill, AgenteAtual } from './classificador-skills';
import { resolverChaveAgentes, MODELO_PADRAO_AUXILIAR } from './byok-resolver';

// Módulos extraídos
import {
    extrairEstadoConversa,
    enriquecerEstadoComLeadRecord,
    gerarFallbackContextual,
    gerarFallbackAntiRepeticao,
    respostaRepetePerguntaCritica,
    atualizarSchemaState,
} from './conversation-state';
import { getSchemaState, setSchemaState } from './conversation-cache';
import { aplicarFiltrosRespostaOrchestrator } from './response-filters';
import { logger } from '../lib/logger';
import {
    TipoAgente,
    STATUS_FASE_HUMANA,
    fasePorStatus,
    determinarAgente,
    criarAgente,
    ultimoAgentePorContato,
    persistirAgente,
    MAPA_NOMES_AGENTES,
} from './agent-chain';

// Re-exports para consumidores existentes (webhook.ts, sdr-tools-agents.ts)
export { buscarConfiguracaoTenant, buscarContextoConversa } from './orchestrator-queries';

// Ativar Tracing para o Dashboard OpenAI (platform.openai.com/traces)
if (process.env.OPENAI_API_KEY) {
    setTracingExportApiKey(process.env.OPENAI_API_KEY);
    logger.debug('[ORCHESTRATOR] 📊 Tracing ativado → platform.openai.com/traces');
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
    // Retrocompatibilidade (string não-criptografada resolvida no query builder)
    llmApiKey?: string;

    // BYOK (Campos de configuração herdados da TenantBYOK para byok-resolver)
    llmProvedor?: string | null;
    llmModelo?: string | null;
    llmApiKeyCriptografada?: string | null;
    llmBaseUrl?: string | null;
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
    instrucaoTurno?: string;
    // optional record fetched from leads table; may be included by orchestrator
    leadRecord?: Lead;
}

export interface ResultadoProcessamento {
    sucesso: boolean;
    resposta?: string;
    agenteUsado?: string;
    guardrailAcionado?: GuardrailResult;
    erro?: string;
}

// ====================================
// PROCESSAR MENSAGEM
// ====================================

export async function processarMensagemOrquestrada(
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa,
): Promise<ResultadoProcessamento> {
    const inicioTurno = Date.now();

    try {
        const faseFluxoAtual = fasePorStatus(contexto.statusLead);
        let fallbackAplicado = 'NONE';
        let toolCallsTurno = 0;
        let handoffsTurno = 0;

        logger.debug(`[ORCHESTRATOR] Processando mensagem para ${contexto.telefone}`);

        // 1. EXECUTAR GUARDRAILS DE ENTRADA (opt-out, spam, blacklist, comprador)
        const guardrailEntrada = await executarGuardrailsEntrada({
            mensagens,
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            executarGuardrailsFn: executarGuardrails,
        });

        if (guardrailEntrada.bloqueado && guardrailEntrada.guardrailResult) {
            const guardrailResult = guardrailEntrada.guardrailResult;
            logger.debug(`[ORCHESTRATOR] Guardrail acionado: ${guardrailResult.tipo} telefone=${contexto.telefone} acao=${guardrailResult.acao || 'N/A'}`);
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

        if (contexto.statusLead && STATUS_FASE_HUMANA.has(contexto.statusLead)) {
            logger.debug(`[ORCHESTRATOR] 🤝 Lead em fase humana (${contexto.statusLead}). Roteando para ADMIN agent.`);
            // Não mais retorna resposta fixa — deixa o Admin agent responder
            // de forma contextual (pode ser dúvida, urgência, desistência, etc.)
        }

        const agentePersistido = await resolverAgentePersistido({
            contatoId: contexto.contatoId,
            getLastAgentFn: getLastAgent,
            atualizarUltimoAgente: async (contatoId, agente) => {
                await persistirAgente(contatoId, agente);
            },
        });

        // 2. DETERMINAR AGENTE INICIAL baseado no status do lead/cache persistido
        const tipoAgente = determinarAgente(contexto.statusLead, contexto.contatoId, agentePersistido);

        logger.debug(`[ORCHESTRATOR] Agente inicial: ${tipoAgente} (status: ${contexto.statusLead || 'sem lead'})`);

        // 3. CRIAR CADEIA DE AGENTES COM HANDOFFS NATIVOS
        // SDK gerencia automaticamente as transferências via tools transfer_to_*
        const agente = criarAgente(tipoAgente, config, contexto);

        // 4. PREPARAR INPUT ESTRUTURADO (SDK Conversations)
        // Tentar recuperar histórico SDK do cache (preserva tool calls e handoffs)
        const cachedHistory = contexto.contatoId ? await getHistory(contexto.contatoId) : undefined;

        const estadoConversaAtual = extrairEstadoConversa(mensagens);

        // SCHEMA STATE: recuperar estado anterior do cache
        let schemaAnterior: SchemaState | undefined;
        if (contexto.contatoId) {
            schemaAnterior = await getSchemaState(contexto.contatoId);
        }
        // Primeiro merge do estado extraído da conversa
        const schemaAtualizado = atualizarSchemaState(schemaAnterior, estadoConversaAtual);

        // persistência opcional no banco (lead record) e leitura da ficha
        let leadRecord: Lead | null | undefined;
        if (contexto.leadId) {
            try {
                leadRecord = await prisma.lead.findUnique({ where: { id: contexto.leadId } });
            } catch (err) {
                logger.warn({
                    erro: err instanceof Error ? err.message : err,
                    leadId: contexto.leadId,
                    telefone: contexto.telefone,
                }, '[ORCHESTRATOR] Falha ao buscar lead record');
            }
        }

        // Enriquecer estado com dados persistidos no banco (preenche campos nulos)
        const estadoEnriquecido = enriquecerEstadoComLeadRecord(estadoConversaAtual, leadRecord);

        // Atualizar schemaState com o estado enriquecido e re-persistir
        const schemaFinal = atualizarSchemaState(schemaAtualizado, estadoEnriquecido);
        if (contexto.contatoId) {
            await setSchemaState(contexto.contatoId, schemaFinal);
        }
        if (leadRecord && contexto.leadId) {
            try {
                await prisma.lead.update({
                    where: { id: contexto.leadId },
                    data: { schemaState: schemaFinal as unknown as Prisma.InputJsonValue },
                });
            } catch (err) {
                logger.warn({
                    erro: err instanceof Error ? err.message : err,
                    leadId: contexto.leadId,
                }, '[ORCHESTRATOR] Falha ao persistir schemaState no lead');
            }
        }

        // pass leadRecord along with contexto so input builder can summarize it
        const contextoParaInput = { ...contexto, leadRecord };

        const inputBuilderResult = construirInputSdk({
            mensagens,
            cachedHistory,
            estadoConversaAtual: estadoEnriquecido,
            schemaState: schemaFinal,
            config,
            contexto: contextoParaInput,
        });
        let inputSDK: AgentInputItem[] = inputBuilderResult.inputSDK;

        if (contexto.instrucaoTurno && contexto.instrucaoTurno.trim().length > 0) {
            inputSDK = [{ role: 'system' as const, content: contexto.instrucaoTurno }, ...inputSDK];
            logger.debug('[ORCHESTRATOR] 🧩 Instrução de turno (mensagens sequenciais) injetada.');
        }

        if (inputBuilderResult.origem === 'cache') {
            logger.debug(`[ORCHESTRATOR] 📜 Usando cache SDK: ${inputBuilderResult.cachedHistoryLength} itens + nova mensagem`);
        } else {
            logger.debug(`[ORCHESTRATOR] 🆕 Primeiro turno SDK: ${inputSDK.length} itens (1 system + ${mensagens.length} mensagens)`);
        }

        // ✅ TASK-IA-05: Análise de Sentimento em Tempo Real
        const ultimaMensagemLead = mensagens.filter(m => m.role === 'user').pop();
        if (ultimaMensagemLead) {
            // ── PRÉ-PROCESSAMENTO PARALELO ──
            // Sentimento é síncrono (regex local), objeção e skill são I/O.
            // Executamos todos em paralelo para reduzir latência do turno.
            const sentimento = analisarSentimento(ultimaMensagemLead.content);

            const resolvedBYOK = resolverChaveAgentes(config);
            const modelToUse = resolvedBYOK.modelo || MODELO_PADRAO_AUXILIAR;
            const agenteAtualStr: AgenteAtual = tipoAgente === 'SDR' ? 'sdr' : 'admin';

            const [objecaoResult, skillResult] = await Promise.allSettled([
                tentarDetectarObjecao(
                    ultimaMensagemLead.content,
                    resolvedBYOK.apiKey,
                    resolvedBYOK.baseUrl,
                    modelToUse
                ),
                tentarPreCarregarSkill(ultimaMensagemLead.content, agenteAtualStr as AgenteAtual),
            ]);

            // Injetar sentimento (síncrono — já resolvido)
            if (sentimento.sentimento !== 'NEUTRO') {
                const instrucaoSentimento = gerarInstrucaoSentimento(sentimento);
                if (instrucaoSentimento) {
                    inputSDK = [{ role: 'system' as const, content: instrucaoSentimento }, ...inputSDK];
                    logger.debug(`[ORCHESTRATOR] 🎭 Sentimento detectado: ${sentimento.sentimento} (${sentimento.confianca}%) — ajustando tom do agente`);
                }
            }

            // Injetar objeção (se detectada)
            const objecaoDetectada = objecaoResult.status === 'fulfilled' ? objecaoResult.value : null;
            if (objecaoDetectada) {
                const instrucaoTatica = `[INJEÇÃO TÁTICA ATIVADA] 🚨 O usuário levantou uma objeção clássica identificada pelo sistema (ID ${objecaoDetectada.id}).
                
INSTRUÇÃO OBRIGATÓRIA: VOCÊ DEVE CONTORNAR A OBJEÇÃO UTILIZANDO ESTRITAMENTE A SEGUINTE PREMISSA DE CONTORNO (sem parecer robótico, use seu tom natural baseado nessa lógica):
"""${objecaoDetectada.contorno}"""`;

                inputSDK = [{ role: 'system' as const, content: instrucaoTatica }, ...inputSDK];
            }
            if (objecaoResult.status === 'rejected') {
                logger.warn({ err: objecaoResult.reason }, '[ORCHESTRATOR] ⚠️ Falha na detecção de objeção (não-bloqueante)');
            }

            // Injetar skill pré-carregada (se encontrada)
            const injecaoSkill = skillResult.status === 'fulfilled' ? skillResult.value : null;
            if (injecaoSkill) {
                inputSDK = [{ role: 'system' as const, content: injecaoSkill }, ...inputSDK];
                logger.debug(`[ORCHESTRATOR] ⚡ Skill pré-carregada injetada no inputSDK.`);
            }
        }

        const agenteCache = contexto.contatoId
            ? ultimoAgentePorContato.get(contexto.contatoId)
            : undefined;

        // 5. CONSTRUIR CONTEXTO TIPADO
        const elyonContext: ElyonContext = construirElyonContext({
            config,
            contexto,
            agenteCache,
            prismaClient: prisma as unknown as ElyonContext['prisma'],
            schemaState: schemaFinal,
            leadRecord,
        });

        // 6. EXECUTAR AGENTE (SDK gerencia handoffs automaticamente)
        let nomesToolsTurno: string[] = [];
        let result: ElyonRunResult;

        // Fallback de provedor: se o tenant usa BYOK (chave própria), criamos
        // callback para recriar o agente com chave da plataforma em caso de falha.
        const resolvedBYOKForFallback = resolverChaveAgentes(config);
        const usaBYOK = resolvedBYOKForFallback.fonte !== 'plataforma';
        const criarAgenteFallbackFn = usaBYOK
            ? () => {
                logger.warn('[ORCHESTRATOR] 🔄 Recriando agente com provedor da plataforma (fallback)...');
                const configPlataforma = {
                    ...config,
                    llmApiKeyCriptografada: null,
                    llmProvedor: 'openai',
                    llmModelo: null,
                    llmBaseUrl: null,
                };
                return criarAgente(tipoAgente, configPlataforma, contexto);
            }
            : undefined;

        const runResult = await executarAgenteComRetry({
            agente,
            inputSDK,
            elyonContext,
            cachedHistory,
            contatoId: contexto.contatoId,
            mensagensLength: mensagens.length,
            construirInputSemCache: () => construirInputSdk({
                mensagens,
                estadoConversaAtual: estadoEnriquecido,
                config,
                contexto: contextoParaInput,
            }).inputSDK,
            limparHistoricoContato: clearHistory,
            criarAgenteFallback: criarAgenteFallbackFn,
        });

        result = runResult.result;
        inputSDK = runResult.inputSDKFinal;
        if (runResult.usouFallbackProvedor) {
            fallbackAplicado = 'PROVIDER_FALLBACK';
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
            logger.debug(`[ORCHESTRATOR] 📦 Structured Output detectado. Próximo passo: ${outputExtraido.proximoPasso}`);
            if (outputExtraido.dadosEstruturados) {
                logger.debug({ dados: outputExtraido.dadosEstruturados }, '[ORCHESTRATOR] 📊 Dados estruturados extraídos');
            }
        }
        if (cotLog) {
            logger.debug(`[ORCHESTRATOR] 🧠 CoT: \n${cotLog}`);
        }

        const nomeRealAgenteRespondeu = (result as ElyonRunResult)?.lastAgent?.name;
        const resolucaoAgente = resolverAgenteFinal({
            nomeRealAgenteRespondeu,
            tipoAgenteInicial: tipoAgente,
            mapaNomesAgentes: MAPA_NOMES_AGENTES,
        });
        const agenteQueRespondeuFormatado = resolucaoAgente.agenteQueRespondeuFormatado;

        logAgenteResolvido(resolucaoAgente.nomeAgenteResposta, agenteQueRespondeuFormatado);

        const { houveHandoff } = await processarPosHandoff({
            contatoId: contexto.contatoId,
            tipoAgente,
            agenteQueRespondeuFormatado,
            atualizarUltimoAgente: async (contatoId, agente) => {
                await persistirAgente(contatoId, agente);
            },
            getHistoryContato: getHistory,
            setHistoryContato: setHistory,
            gerarBriefing: gerarBriefingHandoff,
        });

        // Extrair última mensagem do assistente para continuidade conversacional dos fallbacks
        const ultimaMsgAssistente = mensagens
            .filter(m => m.role === 'assistant')
            .slice(-1)[0]?.content || undefined;
        const ultimaMsgLeadTexto = mensagens
            .filter(m => m.role === 'user')
            .slice(-1)[0]?.content || undefined;

        const filtroResposta = aplicarFiltrosRespostaOrchestrator({
            respostaFinal,
            houveHandoff,
            tipoAgente,
            agenteQueRespondeuFormatado,
            estadoConversaAtual,
            cotLog,
            nomesToolsTurno,
            fallbackAplicadoAtual: fallbackAplicado,
            ultimaMsgAssistente,
            ultimaMsgLead: ultimaMsgLeadTexto,
        });

        let respostaLimpa = filtroResposta.respostaLimpa;
        fallbackAplicado = filtroResposta.fallbackAplicado;

        if (respostaRepetePerguntaCritica(respostaLimpa, mensagens)) {
            logger.warn('[ORCHESTRATOR] ⚠️ Guarda anti-repetição acionada. Resposta repetia pergunta crítica já feita.');
            fallbackAplicado = 'ANTI_REPEAT_GUARD';

            // Coleta mensagens recentes do assistente para evitar repetir qualquer uma delas
            const msgAssistente = mensagens
                .filter(m => m.role === 'assistant')
                .slice(-6)
                .map(m => m.content || '');
            msgAssistente.push(respostaLimpa); // inclui a que foi bloqueada

            respostaLimpa = gerarFallbackAntiRepeticao(estadoConversaAtual, agenteQueRespondeuFormatado, msgAssistente);
        }

        const guardrailRuntime: string | undefined = undefined;

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
            guardrail: guardrailRuntime,
            duracaoMs: Date.now() - inicioTurno,
            sucesso: true,
            // usage não existe no tipo RunResult do SDK — campo reservado para futuras versões
            tokens: undefined,
        });

        // 🔥 Registrar no Audit Log para governança (ações do Agente)
        if (!cachedHistory || cachedHistory.length === 0) {
            ServicoAuditoria.registrar({
                tenantId: config.tenantId,
                // usuarioId omitido para ação do sistema (evita erro de foreign key)
                acao: 'LEAD_CONTATADO',
                entidade: 'Lead',
                entidadeId: contexto.leadId || contexto.contatoId,
                detalhes: { agente: agenteQueRespondeuFormatado, telefone: contexto.telefone },
                ip: '127.0.0.1'
            });
        }

        return {
            sucesso: true,
            resposta: respostaLimpa,
            agenteUsado: agenteQueRespondeuFormatado
        };

    } catch (error: unknown) {
        logger.error({
            erro: error instanceof Error ? error.stack : error,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            turno: mensagens.length,
        }, '[ORCHESTRATOR] Exceção não tratada');
        
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no orquestrador';

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
            erro: errorMessage
        });
        return {
            sucesso: false,
            erro: errorMessage
        };
    }
}
