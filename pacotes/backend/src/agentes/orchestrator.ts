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
import { calcularGrupoExperimento, registrarOutcomeConversa, registrarTelemetriaTurno } from './telemetria-agente';
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
import { bancoDeAprendizadosService, calcularRecompensaTurno } from '../servicos/banco-aprendizados';
import { isLearningBankEnabled, isPaolAbEnabled, isPaolShadowEnabled } from './feature-flags';
import { gerarInstrucaoPaol, paolPolicyService, type PaolDecision, type PaolModoExecucao } from './paol-policy';

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
    configVersionToken?: string;
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

async function construirInstrucaoReidratacaoTools(leadId?: string): Promise<string | undefined> {
    if (!leadId) return undefined;
    try {
        const atividades = await prisma.atividade.findMany({
            where: {
                leadId,
                titulo: { startsWith: 'TOOL_EXEC:' }
            },
            orderBy: { criadoEm: 'desc' },
            take: 8,
            select: { titulo: true, descricao: true }
        });
        if (!atividades.length) return undefined;

        const linhas = atividades
            .map((a) => {
                const tool = (a.titulo || '').replace('TOOL_EXEC:', '');
                const status = (a.descricao || '').split('|')[0].trim();
                return `${tool}:${status}`;
            })
            .filter(Boolean);

        if (!linhas.length) return undefined;
        return `CONTEXTO DE RECUPERAÇÃO (cache Redis indisponível/expirado): ferramentas já registradas recentemente para este lead -> ${linhas.join(', ')}. Evite repetir tool já concluída sem novo fato do usuário.`;
    } catch (err) {
        logger.warn({ err, leadId }, '[ORCHESTRATOR] Falha ao reidratar trilha mínima de tools');
        return undefined;
    }
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
    // Timestamps de cada fase para diagnóstico de latência
    const tFases: Record<string, number> = { inicio: inicioTurno };
    let sentimentoDetectado: string | null = null;
    let paolModoForError: PaolModoExecucao = 'CONTROL';
    let paolCalcularNoTurnoForError = false;
    let paolDecisionForError: PaolDecision | null = null;

    try {
        const faseFluxoAtual = fasePorStatus(contexto.statusLead);
        const learningBankEnabled = isLearningBankEnabled();
        const paolShadowEnabled = isPaolShadowEnabled();
        const paolAbEnabled = isPaolAbEnabled();
        const grupoExperimento = calcularGrupoExperimento({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: faseFluxoAtual,
        });
        const paolModo: PaolModoExecucao = paolAbEnabled && grupoExperimento === 'VARIANT'
            ? 'AB_VARIANT'
            : paolShadowEnabled
                ? 'SHADOW'
                : 'CONTROL';
        const paolAplicarNoTurno = paolModo === 'AB_VARIANT';
        const paolCalcularNoTurno = paolShadowEnabled || paolAbEnabled;
        paolModoForError = paolModo;
        paolCalcularNoTurnoForError = paolCalcularNoTurno;
        let fallbackAplicado = 'NONE';
        let toolCallsTurno = 0;
        let handoffsTurno = 0;
        let paolDecision: PaolDecision | null = null;

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
            const payloadMetrica = logMetricaOrchestrator({
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
            registrarTelemetriaTurno({
                tenantId: config.tenantId,
                telefone: contexto.telefone,
                contatoId: contexto.contatoId,
                leadId: contexto.leadId,
                statusLead: contexto.statusLead,
                faseFluxo: faseFluxoAtual,
                duracaoMs: payloadMetrica.duracaoMs,
                sucesso: payloadMetrica.sucesso,
                fallback: payloadMetrica.fallback,
                guardrail: guardrailResult.tipo,
                toolCalls: 0,
                handoffs: 0,
                custoEstimadoUSD: payloadMetrica.custoEstimadoUSD,
                tokenAlertLevel: payloadMetrica.tokenAlertLevel,
                paolModo,
                paolAplicado: false,
            });

            const outcomeGuardrail = guardrailResult.tipo === 'OPTOUT'
                ? 'OPTOUT'
                : guardrailResult.tipo === 'COMPRADOR'
                    ? 'HANDOFF_HUMANO'
                    : 'ERRO';
            registrarOutcomeConversa({
                tenantId: config.tenantId,
                telefone: contexto.telefone,
                contatoId: contexto.contatoId,
                leadId: contexto.leadId,
                statusLead: contexto.statusLead,
                faseFluxo: faseFluxoAtual,
                outcome: outcomeGuardrail,
                origem: 'GUARDRAIL',
                motivo: `Guardrail ${guardrailResult.tipo || 'DESCONHECIDO'}`,
                paolModo,
                paolAplicado: false,
            });

            if (learningBankEnabled) {
                await bancoDeAprendizadosService.registrar({
                    tenantId: config.tenantId,
                    contexto: {
                        faseFluxo: faseFluxoAtual,
                        statusLead: contexto.statusLead,
                        agenteInicial: 'GUARDRAIL',
                        sentimento: 'NEUTRO',
                    },
                    acao: `guardrail:${guardrailResult.tipo || 'desconhecido'}`,
                    resultado: outcomeGuardrail,
                    recompensa: calcularRecompensaTurno({
                        sucesso: outcomeGuardrail !== 'ERRO',
                        outcome: outcomeGuardrail as 'SUCESSO' | 'OPTOUT' | 'HANDOFF_HUMANO' | 'PERDA' | 'ERRO',
                        fallback: 'GUARDRAIL_BLOCK',
                        toolCalls: 0,
                        handoffs: 0,
                    }),
                    metadados: {
                        telefone: contexto.telefone,
                        contatoId: contexto.contatoId,
                        leadId: contexto.leadId,
                    },
                });
            }
            return {
                sucesso: true,
                resposta: guardrailResult.mensagemFallback,
                guardrailAcionado: guardrailResult
            };
        }

        tFases.guardrail = Date.now() - inicioTurno;

        if (contexto.statusLead && STATUS_FASE_HUMANA.has(contexto.statusLead)) {
            logger.debug(`[ORCHESTRATOR] 🤝 Lead em fase humana (${contexto.statusLead}). Roteando para ADMIN agent.`);
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

        // Se o schemaState em cache sumiu, tenta reidratar do estado persistido no lead.
        if (!schemaAnterior && leadRecord?.schemaState && contexto.contatoId) {
            const schemaPersistido = leadRecord.schemaState as unknown as SchemaState;
            await setSchemaState(contexto.contatoId, schemaPersistido);
            logger.debug('[ORCHESTRATOR] ♻️ schemaState reidratado do banco após ausência no Redis.');
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
        if (inputBuilderResult.temporalFactsStats) {
            const tf = inputBuilderResult.temporalFactsStats;
            logger.debug(`[ORCHESTRATOR] ⏳ Fatos temporais: ativos=${tf.ativos} expirados=${tf.expirados} total=${tf.total} taxaExpirados=${tf.taxaExpirados}%`);
        }

        if (contexto.instrucaoTurno && contexto.instrucaoTurno.trim().length > 0) {
            inputSDK = [{ role: 'system' as const, content: contexto.instrucaoTurno }, ...inputSDK];
            logger.debug('[ORCHESTRATOR] 🧩 Instrução de turno (mensagens sequenciais) injetada.');
        }

        // Quando o cache SDK expira, reidrata trilha mínima de tools a partir das atividades persistidas.
        if ((!cachedHistory || cachedHistory.length === 0) && contexto.leadId) {
            const instrucaoTools = await construirInstrucaoReidratacaoTools(contexto.leadId);
            if (instrucaoTools) {
                inputSDK = [{ role: 'system' as const, content: instrucaoTools }, ...inputSDK];
            }
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
                sentimentoDetectado = sentimento.sentimento;
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

        // Learning Bank + PAOL (Plan/Act)
        const padroesHistoricos = learningBankEnabled
            ? await bancoDeAprendizadosService.consultarPadroes(
                config.tenantId,
                {
                    faseFluxo: faseFluxoAtual,
                    statusLead: contexto.statusLead,
                    agenteInicial: tipoAgente,
                    sentimento: sentimentoDetectado || 'NEUTRO',
                },
                { limit: 3, diasJanela: 120, minimoAmostra: 2 }
            )
            : [];

        if (padroesHistoricos.length > 0) {
            const sugestoes = padroesHistoricos
                .map((p, idx) => `${idx + 1}. ${p.acao} (reward médio ${p.recompensaMedia.toFixed(2)} | amostra ${p.amostra})`)
                .join('\n');
            const instrucaoAprendizado = `[BANCO DE APRENDIZADOS — PRIORIDADE ALTA]
Para este contexto de conversa, priorize as abordagens com melhor histórico:
${sugestoes}
Use isso como desempate estratégico na próxima ação.`;
            inputSDK = [{ role: 'system' as const, content: instrucaoAprendizado }, ...inputSDK];
            logger.debug(`[ORCHESTRATOR] 🧠 Learning Bank: ${padroesHistoricos.length} padrões injetados no contexto.`);
        }

        if (paolCalcularNoTurno) {
            paolDecision = await paolPolicyService.decidirAcao({
                contexto: {
                    tenantId: config.tenantId,
                    faseFluxo: faseFluxoAtual,
                    statusLead: contexto.statusLead,
                    agenteInicial: tipoAgente,
                    sentimento: sentimentoDetectado || 'NEUTRO',
                },
                padroesHistoricos,
                modo: paolModo,
                aplicar: paolAplicarNoTurno,
            });

            if (paolAplicarNoTurno) {
                inputSDK = [{ role: 'system' as const, content: gerarInstrucaoPaol(paolDecision) }, ...inputSDK];
                logger.debug(`[ORCHESTRATOR] 🎯 PAOL-ACT aplicado: ${paolDecision.acaoEscolhida} (hash=${paolDecision.contextoHash})`);
            } else if (paolModo === 'SHADOW') {
                logger.debug(`[ORCHESTRATOR] 👤 PAOL-SHADOW: ação sugerida=${paolDecision.acaoEscolhida} baseline=${paolDecision.acaoBaseline} divergencia=${paolDecision.divergencia}`);
            }

            ServicoAuditoria.registrar({
                tenantId: config.tenantId,
                acao: 'AGENT_PAOL_DECISION',
                entidade: 'Conversa',
                entidadeId: contexto.leadId || contexto.contatoId,
                ip: '127.0.0.1',
                detalhes: {
                    telefone: contexto.telefone || null,
                    contatoId: contexto.contatoId || null,
                    leadId: contexto.leadId || null,
                    faseFluxo: faseFluxoAtual,
                    paolModo: paolDecision.modo,
                    paolAplicado: paolDecision.aplicouNaResposta,
                    acaoEscolhida: paolDecision.acaoEscolhida,
                    acaoBaseline: paolDecision.acaoBaseline,
                    divergencia: paolDecision.divergencia,
                    ganhoPotencial: paolDecision.ganhoPotencial,
                    custoPotencialExtraUsd: paolDecision.custoPotencialExtraUsd,
                    candidatos: paolDecision.candidatos,
                },
            });
            paolDecisionForError = paolDecision;
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

        tFases.preContexto = Date.now() - inicioTurno;

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

        tFases.llm = Date.now() - inicioTurno;

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

        const payloadMetrica = logMetricaOrchestrator({
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

        tFases.total = Date.now() - inicioTurno;
        logger.debug(`[ORCHESTRATOR] ⏱ tFases guardrail=${tFases.guardrail}ms preContexto=${tFases.preContexto}ms llm=${tFases.llm}ms total=${tFases.total}ms`);

        registrarTelemetriaTurno({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: faseFluxoAtual,
            agenteInicial: tipoAgente,
            agenteFinal: agenteQueRespondeuFormatado,
            duracaoMs: payloadMetrica.duracaoMs,
            sucesso: payloadMetrica.sucesso,
            fallback: payloadMetrica.fallback,
            guardrail: payloadMetrica.guardrail || undefined,
            toolCalls: toolCallsTurno,
            handoffs: handoffsTurno,
            repeticaoDetectada: fallbackAplicado === 'ANTI_REPEAT_GUARD',
            custoEstimadoUSD: payloadMetrica.custoEstimadoUSD,
            tokenAlertLevel: payloadMetrica.tokenAlertLevel,
            paolModo,
            paolAplicado: paolDecision?.aplicouNaResposta || false,
            paolAcao: paolDecision?.acaoEscolhida,
            paolDivergencia: paolDecision?.divergencia || false,
            paolGanhoPotencial: paolDecision?.ganhoPotencial,
            paolCustoPotencialExtraUSD: paolDecision?.custoPotencialExtraUsd,
            tFases,
        });

        const outcomePrincipal = (contexto.statusLead === 'PERDIDO' || contexto.statusLead === 'ARQUIVADO')
            ? 'PERDA'
            : (contexto.statusLead && STATUS_FASE_HUMANA.has(contexto.statusLead))
                ? 'HANDOFF_HUMANO'
                : 'SUCESSO';
        registrarOutcomeConversa({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: faseFluxoAtual,
            outcome: outcomePrincipal,
            origem: 'ORCHESTRATOR',
            motivo: fallbackAplicado !== 'NONE' ? `Fallback aplicado: ${fallbackAplicado}` : undefined,
            paolModo,
            paolAplicado: paolDecision?.aplicouNaResposta || false,
            paolAcao: paolDecision?.acaoEscolhida,
        });

        const acaoExecutada = nomesToolsTurno.length > 0
            ? `tool:${nomesToolsTurno[0]}`
            : `resposta:${String(agenteQueRespondeuFormatado || tipoAgente).toLowerCase()}`;
        const recompensaTurno = calcularRecompensaTurno({
            sucesso: true,
            outcome: outcomePrincipal,
            fallback: fallbackAplicado,
            toolCalls: toolCallsTurno,
            handoffs: handoffsTurno,
        });

        if (learningBankEnabled) {
            await bancoDeAprendizadosService.registrar({
                tenantId: config.tenantId,
                contexto: {
                    faseFluxo: faseFluxoAtual,
                    statusLead: contexto.statusLead,
                    agenteInicial: tipoAgente,
                    sentimento: sentimentoDetectado || 'NEUTRO',
                },
                acao: acaoExecutada,
                resultado: outcomePrincipal,
                recompensa: recompensaTurno,
                metadados: {
                    telefone: contexto.telefone,
                    contatoId: contexto.contatoId,
                    leadId: contexto.leadId,
                    fallback: fallbackAplicado,
                    toolCalls: toolCallsTurno,
                    handoffs: handoffsTurno,
                    agenteFinal: agenteQueRespondeuFormatado,
                },
            });
        }

        if (paolCalcularNoTurno && paolDecision) {
            await paolPolicyService.aprender({
                tenantId: config.tenantId,
                contextoHash: paolDecision.contextoHash,
                acaoExecutada,
                recompensa: recompensaTurno,
                outcome: outcomePrincipal,
                origem: 'ORCHESTRATOR',
                fallback: fallbackAplicado,
            });
        }

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

        const payloadMetrica = logMetricaOrchestrator({
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

        tFases.total = Date.now() - inicioTurno;
        registrarTelemetriaTurno({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: fasePorStatus(contexto.statusLead),
            duracaoMs: payloadMetrica.duracaoMs,
            sucesso: false,
            erro: errorMessage,
            fallback: 'EXCEPTION',
            toolCalls: 0,
            handoffs: 0,
            custoEstimadoUSD: payloadMetrica.custoEstimadoUSD,
            tokenAlertLevel: payloadMetrica.tokenAlertLevel,
            paolModo: paolModoForError,
            paolAplicado: false,
            tFases,
        });
        registrarOutcomeConversa({
            tenantId: config.tenantId,
            telefone: contexto.telefone,
            contatoId: contexto.contatoId,
            leadId: contexto.leadId,
            statusLead: contexto.statusLead,
            faseFluxo: fasePorStatus(contexto.statusLead),
            outcome: 'ERRO',
            origem: 'SYSTEM',
            motivo: errorMessage,
            paolModo: paolModoForError,
            paolAplicado: false,
        });
        if (isLearningBankEnabled()) {
            await bancoDeAprendizadosService.registrar({
                tenantId: config.tenantId,
                contexto: {
                    faseFluxo: fasePorStatus(contexto.statusLead),
                    statusLead: contexto.statusLead,
                    agenteInicial: 'ERRO',
                    sentimento: sentimentoDetectado || 'NEUTRO',
                },
                acao: 'erro_orchestrator',
                resultado: 'ERRO',
                recompensa: calcularRecompensaTurno({
                    sucesso: false,
                    outcome: 'ERRO',
                    fallback: 'EXCEPTION',
                    toolCalls: 0,
                    handoffs: 0,
                }),
                metadados: {
                    telefone: contexto.telefone,
                    contatoId: contexto.contatoId,
                    leadId: contexto.leadId,
                    erro: errorMessage,
                },
            });
        }
        if (paolCalcularNoTurnoForError && paolDecisionForError) {
            await paolPolicyService.aprender({
                tenantId: config.tenantId,
                contextoHash: paolDecisionForError.contextoHash,
                acaoExecutada: 'erro_orchestrator',
                recompensa: calcularRecompensaTurno({
                    sucesso: false,
                    outcome: 'ERRO',
                    fallback: 'EXCEPTION',
                    toolCalls: 0,
                    handoffs: 0,
                }),
                outcome: 'ERRO',
                origem: 'SYSTEM',
                fallback: 'EXCEPTION',
            });
        }
        return {
            sucesso: false,
            erro: errorMessage
        };
    }
}
