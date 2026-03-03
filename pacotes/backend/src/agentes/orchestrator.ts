/**
 * ORCHESTRATOR - Orquestrador dos 4 Agentes de Captação
 * 
 * Responsável por:
 * 1. Executar guardrails de entrada
 * 2. Determinar qual agente deve atender baseado no status do lead
 * 3. Processar a mensagem com o agente correto
 * 4. Gerenciar handoffs silenciosos entre agentes
 * 
 * @version 1.0
 * @date 16/12/2025
 */

import { Agent, run, setTracingExportApiKey, handoff } from '@openai/agents';
import { prisma } from '../lib/db';
import { executarGuardrails, GuardrailResult, MensagemContext } from './guardrails';
import { criarOpenerAgent } from './opener-agent';
import { criarPresenterAgent } from './presenter-agent';
import { criarAdminAgent } from './admin-agent';
import { knowledgeAgent } from './knowledge-agent';
import type { ElyonContext } from './elyon-context';
import { getHistory, setHistory, getCacheStats, getLastAgent, clearHistory } from './conversation-cache';
import { filterHistoryByQuery, gerarBriefingHandoff, removeHandoffNarration, sliceHistoryPreservingSystem } from './handoff-filters';
import { descriptografar } from '../lib/crypto';

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
// MAPEAMENTO STATUS → AGENTE
// ====================================

type TipoAgente = 'OPENER' | 'PRESENTER' | 'ADMIN';

const STATUS_FASE_HUMANA = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO']);

function fasePorStatus(statusLead?: string): string {
    if (!statusLead) return 'FASE1_QUALIFICACAO';
    if (['NOVO', 'QUALIFICADO'].includes(statusLead)) return 'FASE1_QUALIFICACAO';
    if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'CONTATANDO', 'AVALIACAO_EM_ANDAMENTO'].includes(statusLead)) return 'FASE2_DIAGNOSTICO_SPIN';
    if (['DOCUMENTACAO', 'EM_NEGOCIACAO'].includes(statusLead)) return 'FASE3_DOCUMENTACAO_HUMANA';
    if (['ONBOARDING'].includes(statusLead)) return 'FASE4_ONBOARDING';
    if (['CAPTADO'].includes(statusLead)) return 'CARTEIRA';
    return 'DESCONHECIDA';
}

function shortId(valor?: string): string | null {
    if (!valor) return null;
    return valor.length > 8 ? `${valor.substring(0, 8)}...` : valor;
}

/**
 * Gera fallback contextual baseado no estado real da conversa.
 * NUNCA pergunta algo que o lead já respondeu.
 */
function gerarFallbackContextual(
    estado: ReturnType<typeof extrairEstadoConversa>,
    agente: string
): string {
    const temIntencao = !!estado.intencao;
    const temValor = !!estado.valorPretendido;
    const temOcupacao = !!estado.ocupacao;
    const temMetragem = !!estado.metragem;
    const jaDecidiu = estado.jaRespondeuDecisao;

    // Se já temos dados suficientes → empurrar para apresentação
    if (temIntencao && (temValor || jaDecidiu)) {
        return 'Entendi seu cenário completo! Posso te mostrar como a gente trabalha pra conseguir vender mais rápido?';
    }

    // Perguntar o que FALTA (ordem de prioridade)
    if (!temIntencao) {
        return 'Pra eu entender melhor: você tá pensando em vender ou alugar?';
    }
    if (!temOcupacao) {
        return 'E sobre o imóvel: ele tá ocupado ou vazio no momento?';
    }
    if (!temValor) {
        return 'Legal! E você tem algum valor em mente pra venda?';
    }

    // Caso geral com dados parciais
    return 'Entendi! Posso te mostrar como a gente trabalha pra conseguir mais visitas qualificadas no seu imóvel?';
}

function extrairEstadoConversa(mensagens: Array<{ role: 'user' | 'assistant'; content: string }>) {
    const textoUsuarios = mensagens
        .filter((m) => m.role === 'user')
        .map((m) => m.content || '')
        .join(' \n ')
        .toLowerCase();

    const textoAssistente = mensagens
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content || '')
        .join(' \n ')
        .toLowerCase();

    const intencao = /\bvender\b/.test(textoUsuarios)
        ? 'vender'
        : /\balugar|loca(ç|c)(ã|a)o\b/.test(textoUsuarios)
            ? 'alugar'
            : null;

    const metragemMatch = textoUsuarios.match(/\b(\d{2,3})\s?m2?|\b(\d{2,3})\s?m²/i);
    const metragem = metragemMatch ? Number((metragemMatch[1] || metragemMatch[2])) : null;

    const ocupacao = /desocupad|vazio/.test(textoUsuarios)
        ? 'vazio'
        : /morando|ocupad/.test(textoUsuarios)
            ? 'ocupado'
            : null;

    const valorMatch = textoUsuarios.match(/(\d{3,4})\s?(k|mil)|r\$\s?([\d\.]{3,7})/i);
    const valorPretendido = valorMatch ? valorMatch[0] : null;

    const jaRespondeuDecisao =
        /ja\s+estou\s+anunciando|ja\s+decidi|decidid[oa]\s+a\s+vend|estou\s+decidid[oa]\s+a\s+vend|esta\s+decido\s+a\s+vend|preciso\s+(de\s+)?vender|quero\s+vender|tenho\s+que\s+vender|necessidade\s+de\s+vender|tenho\s+interesse\s+em\s+vender|vender\s+mesmo|sim.*\bvend/.test(textoUsuarios);

    const perguntasJaFeitas = {
        prioridade: /posso\s+te\s+fazer\s+uma\s+pergunta\s+r[aá]pida/.test(textoAssistente),
        decisaoVenda: /j[aá]\s+decidiu\s+vender|ainda\s+t[aá]\s+s[oó]\s+avaliando/.test(textoAssistente),
        valor: /j[aá]\s+tem\s+algum\s+valor\s+em\s+mente/.test(textoAssistente)
    };

    return {
        intencao,
        metragem,
        ocupacao,
        valorPretendido,
        jaRespondeuDecisao,
        perguntasJaFeitas
    };
}

function respostaRepetePerguntaCritica(
    resposta: string,
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>
): boolean {
    const respostaNorm = normalizarTexto(resposta);
    if (!respostaNorm) return false;

    const ultimasAssistente = mensagens
        .filter((m) => m.role === 'assistant')
        .slice(-6)
        .map((m) => normalizarTexto(m.content));

    const repetiuMesmoTexto = ultimasAssistente.includes(respostaNorm);

    const repetiuPerguntaPrioridade =
        /posso te fazer uma pergunta rapida/.test(respostaNorm) &&
        ultimasAssistente.some((t) => /posso te fazer uma pergunta rapida/.test(t));

    const repetiuPerguntaDecisao =
        /ja decidiu vender|ainda ta so avaliando/.test(respostaNorm) &&
        ultimasAssistente.some((t) => /ja decidiu vender|ainda ta so avaliando/.test(t));

    return repetiuMesmoTexto || repetiuPerguntaPrioridade || repetiuPerguntaDecisao;
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

// 🔑 Cache em memória: último agente que respondeu por contato
// Resolve o problema de statusLead nunca ser atualizado no BD
const ultimoAgentePorContato = new Map<string, TipoAgente>();

function normalizarTexto(texto?: string): string {
    return (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function respostaPositivaCurta(texto?: string): boolean {
    const t = normalizarTexto(texto);
    if (!t) return false;

    if (/\b(nao|agora nao|depois|talvez)\b/.test(t)) return false;

    return /^(sim|pode|pode sim|pode ser|claro|ok|okay|beleza|bora|vamos|fechado|quero|com certeza|manda)(\b|$)/.test(t);
}

function deveForcarTransicaoParaPresenter(mensagens: Array<{ role: 'user' | 'assistant'; content: string }>): boolean {
    if (!mensagens || mensagens.length < 2) return false;

    let idxUltimaUser = -1;
    for (let i = mensagens.length - 1; i >= 0; i--) {
        if (mensagens[i].role === 'user') {
            idxUltimaUser = i;
            break;
        }
    }

    if (idxUltimaUser <= 0) return false;

    let ultimaAssistente = '';
    for (let i = idxUltimaUser - 1; i >= 0; i--) {
        if (mensagens[i].role === 'assistant') {
            ultimaAssistente = mensagens[i].content;
            break;
        }
    }

    if (!ultimaAssistente) return false;

    const perguntaTransicao = normalizarTexto(ultimaAssistente);
    const ehPerguntaPrioridade =
        /posso te fazer uma pergunta rapida/.test(perguntaTransicao) ||
        /entender sua prioridade/.test(perguntaTransicao) ||
        /prioridade agora/.test(perguntaTransicao);

    if (!ehPerguntaPrioridade) return false;

    return respostaPositivaCurta(mensagens[idxUltimaUser].content);
}

function determinarAgente(statusLead?: string, contatoId?: string, agentePersistido?: TipoAgente): TipoAgente {
    if (agentePersistido) {
        console.log(`[ORCHESTRATOR] 🔐 Usando agente persistido no cache Redis: ${agentePersistido}`);
        return agentePersistido;
    }

    // Prioridade 1: Cache do último agente que respondeu (handoff persistido em memória)
    if (contatoId && ultimoAgentePorContato.has(contatoId)) {
        const cached = ultimoAgentePorContato.get(contatoId)!;
        console.log(`[ORCHESTRATOR] 🔑 Usando agente do cache: ${cached} (contatoId: ${contatoId.substring(0, 8)}...)`);
        return cached;
    }

    // Prioridade 2: Status do lead no BD
    if (!statusLead) return 'OPENER';

    const mapa: Record<string, TipoAgente> = {
        // Fase 1
        'NOVO': 'OPENER',
        'QUALIFICADO': 'PRESENTER',

        // Fase 2
        'TENTATIVA_AGENDAMENTO': 'PRESENTER',
        'VISITA_AGENDADA': 'PRESENTER',
        'CONTATANDO': 'PRESENTER',

        // Fase 3
        'AVALIACAO_EM_ANDAMENTO': 'PRESENTER',
        'DOCUMENTACAO': 'ADMIN',
        'EM_NEGOCIACAO': 'ADMIN',

        // Fase 4
        'ONBOARDING': 'ADMIN',

        // Pós-assinatura / carteira
        'CAPTADO': 'ADMIN'
    };

    return mapa[statusLead] || 'OPENER';
}

/**
 * Tipo base para agentes no sistema Elyon, permitindo outputs variados.
 */
type ElyonAgent = any;

// ====================================
// CRIAR AGENTE COM HANDOFFS NATIVOS
// ====================================

/**
 * Cria a cadeia completa de agentes com handoffs nativos do SDK.
 * Retorna o agente RAIZ (baseado no status do lead).
 * 
 * Cadeia: Opener → Presenter → Admin
 * O SDK gerencia as transferências via tools transfer_to_*.
 */
function criarCadeiaAgentes(
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa
): Record<TipoAgente, any> {
    const baseConfig = {
        nomeAgente: config.nomeAgente,
        genero: config.genero,
        nomeImobiliaria: config.nomeImobiliaria
    };

    // BYOK: resolver modelo para cada agente (menor para admin, maior para os demais)
    // Se NãO houver BYOK, usa os modelos padrão originais
    const modeloPrincipal = config.llmModelo || 'gpt-4.1';
    const modeloAdmin = config.llmModelo || 'gpt-4.1-mini'; // Admin pode usar modelo menor

    // Build bottom-up: Admin → Presenter → Opener
    const adminAgent = criarAdminAgent({
        ...baseConfig,
        tipoAutorizacao: contexto.tipoAutorizacao,
        comissaoAcordada: contexto.comissaoAcordada,
        prazoTrabalho: contexto.prazoTrabalho,
        model: modeloAdmin,
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
    });

    const presenterAgent = criarPresenterAgent({
        ...baseConfig,
        diferenciais: config.diferenciais,
        situacaoAtual: contexto.situacaoAtual,
        model: modeloPrincipal,
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
        tools: [knowledgeAgent.asTool({
            toolDescription: 'Consulte o estrategista de vendas quando o lead apresentar qualquer dúvida técnica ou objeção.'
        })]
    }) as any;
    const h_presenter_to_admin = handoff(adminAgent as any, {
        toolDescriptionOverride: 'Transferir para onboarding operacional quando houver necessidade de coleta cadastral e dados pós-assinatura.',
        inputFilter: (data: any) => {
            const history = Array.isArray(data.inputHistory) ? data.inputHistory : [];
            const clean = filterHistoryByQuery(history, [
                /transferindo|vou\s+te\s+passar|aguarde\s+um\s+instante|especialista/i
            ], 'Presenter→Admin');
            return { ...data, inputHistory: clean };
        }
    });
    (h_presenter_to_admin as any).strictJsonSchema = false;
    (h_presenter_to_admin as any).inputJsonSchema.additionalProperties = true;
    presenterAgent.handoffs = [h_presenter_to_admin];

    const openerAgent = criarOpenerAgent({
        ...baseConfig,
        cidade: config.cidade,
        empreendimento: contexto.empreendimento,
        comissaoPadrao: config.comissaoPadrao,
        prazoContrato: config.prazoContrato,
        model: modeloPrincipal,
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
        tools: [knowledgeAgent.asTool({
            toolDescription: 'Consulte o estrategista de vendas quando o lead apresentar qualquer dúvida técnica ou objeção.'
        })]
    }) as any;
    const h_opener_to_presenter = handoff(presenterAgent as any, {
        toolDescriptionOverride: `TRANSFERIR_PARA_DIAGNOSTICO: Use esta função quando o proprietário demonstrar interesse real e estiver pronto para diagnóstico consultivo antes do fechamento.

SINAIS CLAROS DE INTERESSE:
- Respostas positivas como "sim", "pode", "faz sentido", "quero saber mais"
- Perguntas sobre o processo: "como funciona?", "pode explicar?", "qual é o método?"
- Demonstra curiosidade sobre o serviço
- Aceita ouvir como funciona após coleta de dados básicos

REQUISITOS ANTES DE TRANSFERIR:
- Já coletou: tipo de imóvel, quartos, metragem (se possível)
- Lead demonstrou interesse real (não apenas educado)
- Contexto da conversa indica prontidão para próxima fase

NÃO TRANSFERIR SE:
- Lead ainda está desconfiado ou fazendo perguntas de segurança
- Não coletou informações básicas do imóvel
- Resposta foi vaga ou neutra`,
        inputFilter: (data: any) => {
            const history = Array.isArray(data.inputHistory) ? data.inputHistory : [];
            // Preservar mais contexto - remover apenas ruídos específicos, manter histórico completo
            const clean = filterHistoryByQuery(history, [
                /quem\s+[eé]\s+voc[êe]|onde\s+voc[êe]\s+conseguiu|seu\s+nome\s+[ée]|quem\s+fala/i,
                /como\s+voc[êe]\s+conseguiu|meu\s+número\s+de\s+telefone|empresa\s+[ée]|de\s+qual\s+empresa/i
            ], 'Opener→Presenter');
            return { ...data, inputHistory: clean };
        }
    });
    (h_opener_to_presenter as any).strictJsonSchema = false;
    (h_opener_to_presenter as any).inputJsonSchema.additionalProperties = true;
    openerAgent.handoffs = [h_opener_to_presenter];

    // Lifecycle Hooks — métricas e logging
    const agentes: any[] = [openerAgent, presenterAgent, adminAgent];
    for (const ag of agentes) {
        const startTime = new Map<string, number>();
        ag.on('agent_start', (_ctx: any, agent: any) => {
            startTime.set(agent.name, Date.now());
            console.log(`[LIFECYCLE] ▶️ ${agent.name} iniciou`);
        });
        ag.on('agent_end', (_ctx: any, output: any) => {
            const elapsed = Date.now() - (startTime.get(ag.name) || Date.now());
            const outputText = typeof output === 'string' ? output : JSON.stringify(output);
            const linhas = outputText.split('\n').length;
            console.log(`[LIFECYCLE] ⏹️ ${ag.name} finalizou (${elapsed}ms, ${linhas} linhas)`);
        });
    }

    return {
        OPENER: openerAgent,
        PRESENTER: presenterAgent,
        ADMIN: adminAgent
    };
}

// Mantém retrocompatibilidade
function criarAgente(
    tipo: TipoAgente,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa
): ElyonAgent {
    const cadeia = criarCadeiaAgentes(config, contexto);
    return cadeia[tipo];
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

        const mapaAgentes: Record<string, TipoAgente> = {
            'opener_agent_v11': 'OPENER',
            'presenter_agent_v4': 'PRESENTER',
            'closer_agent_v5': 'PRESENTER',
            'admin_agent_v4': 'ADMIN',
            'knowledge_agent': 'OPENER' // Redireciona para o inicial se por acaso ele responder por último
        };

        const agenteQueRespondeuFormatado = nomeRealAgenteRespondeu ? (mapaAgentes[nomeRealAgenteRespondeu] || 'OPENER') : tipoAgente;

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

// ====================================
// BUSCAR CONFIGURAÇÃO DO TENANT
// ====================================

export async function buscarConfiguracaoTenant(tenantId: string): Promise<ConfiguracaoOrquestrador | null> {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                agentes: {
                    where: { estaAtivo: true },
                    take: 1
                }
            }
        });

        if (!tenant) return null;

        const agente = tenant.agentes[0];
        const diferenciais = tenant.diferenciais as string[] || [];

        const perfilVenda = tenant.perfilVenda as any || {};

        // RAG do perfil: prioriza o do agente (mais completo), fallback para o do tenant
        const ragPerfilTexto = (agente as any)?.ragPerfilTexto || (tenant as any).ragPerfilTexto || undefined;

        // BYOK: descriptografar API Key do tenant, se configurada
        let llmApiKey: string | undefined;
        if ((tenant as any).llmApiKeyCriptografada) {
            try {
                llmApiKey = descriptografar((tenant as any).llmApiKeyCriptografada);
            } catch {
                console.warn('[ORCHESTRATOR] ⚠️ Falha ao descriptografar llmApiKey do tenant — usando padrão');
            }
        }

        return {
            tenantId,
            nomeAgente: agente?.nome || 'Sofia',
            genero: agente?.genero || 'feminino',
            nomeImobiliaria: tenant.nome,
            cidade: tenant.cidade || undefined,
            diferenciais: diferenciais.length > 0 ? diferenciais : undefined,
            comissaoPadrao: perfilVenda.comissaoPadrao ? `${perfilVenda.comissaoPadrao}%`.replace('%%', '%') : '5%',
            prazoContrato: perfilVenda.prazoContrato ? Number(perfilVenda.prazoContrato) : 180,
            ragPerfilTexto,
            llmModelo: (tenant as any).llmModelo || undefined,
            llmBaseUrl: (tenant as any).llmBaseUrl || undefined,
            llmApiKey,
        };

    } catch (error) {
        console.error('[ORCHESTRATOR] Erro ao buscar config:', error);
        return null;
    }
}

// ====================================
// BUSCAR CONTEXTO DA CONVERSA
// ====================================

export async function buscarContextoConversa(
    telefone: string,
    tenantId: string
): Promise<ContextoConversa> {
    try {
        // Buscar lead existente pelo telefone
        const lead = await prisma.lead.findFirst({
            where: {
                telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                tenantId
            },
            select: {
                id: true,
                status: true,
                doresIdentificadas: true,
                tipoAutorizacao: true,
                comissaoAcordada: true,
                prazoTrabalho: true,
                campanhaOrigem: {
                    select: { nomeEmpreendimento: true }
                }
            }
        });

        // Buscar contato se não tem lead
        let contatoId: string | undefined;
        if (!lead) {
            const contato = await prisma.contato.findFirst({
                where: {
                    telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                    campanha: { tenantId }
                },
                select: { id: true }
            });
            contatoId = contato?.id;
        }

        return {
            telefone,
            contatoId,
            leadId: lead?.id,
            statusLead: lead?.status,
            doresIdentificadas: lead?.doresIdentificadas || [],
            empreendimento: lead?.campanhaOrigem?.nomeEmpreendimento || undefined
        };

    } catch (error) {
        console.error('[ORCHESTRATOR] Erro ao buscar contexto:', error);
        return { telefone };
    }
}

// ====================================
// EXPORTAR
// ====================================

export {
    determinarAgente,
    criarAgente,
    TipoAgente,
    ElyonAgent
};
