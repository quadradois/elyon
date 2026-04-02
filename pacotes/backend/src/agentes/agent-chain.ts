/**
 * AGENT CHAIN — Criação e roteamento da cadeia de agentes
 * 
 * Extraído do orchestrator.ts para separação de responsabilidades.
 * Contém:
 * - Mapeamento status → agente (OPENER/PRESENTER/ADMIN)
 * - Cache em memória do último agente por contato
 * - Criação da cadeia com handoffs nativos do SDK
 * 
 * @version 1.0
 * @date 04/03/2026
 */

import { handoff } from '@openai/agents';
import { criarOpenerAgent } from './opener-agent';
import { criarPresenterAgent } from './presenter-agent';
import { criarAdminAgent } from './admin-agent';
import { criarKnowledgeAgent } from './knowledge-agent';
import { filterHistoryByQuery } from './handoff-filters';
import { getActiveAgent, setActiveAgent } from './conversation-cache';
import type { ConfiguracaoOrquestrador, ContextoConversa } from './orchestrator';
import { logger } from '../lib/logger';

// ====================================
// TIPOS
// ====================================

export type TipoAgente = 'OPENER' | 'PRESENTER' | 'ADMIN';

/** Tipo base para agentes no sistema Elyon, permitindo outputs variados. */
export type ElyonAgent = any;

// ====================================
// CONSTANTES
// ====================================

export const STATUS_FASE_HUMANA = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO']);

// 🔑 Cache em memória local: fallback síncrono para acesso imediato
// A fonte de verdade agora é o Redis (via getActiveAgent/setActiveAgent)
export const ultimoAgentePorContato = new Map<string, TipoAgente>();

/**
 * Persiste o agente ativo para um contato no Redis + memória local.
 * Chame sempre que o agente mudar após uma mensagem processada.
 */
export async function persistirAgente(contatoId: string, agente: TipoAgente): Promise<void> {
    ultimoAgentePorContato.set(contatoId, agente); // memória local imediata
    await setActiveAgent(contatoId, agente);        // Redis persistido
}

/**
 * Lê o agente ativo de um contato: Redis primeiro, fallback para memória local.
 */
export async function lerAgentePersistido(contatoId: string): Promise<TipoAgente | undefined> {
    const fromRedis = await getActiveAgent(contatoId);
    if (fromRedis) {
        ultimoAgentePorContato.set(contatoId, fromRedis as TipoAgente); // sincroniza memória local
        return fromRedis as TipoAgente;
    }
    return ultimoAgentePorContato.get(contatoId); // fallback síncrono
}

// ====================================
// MAPEAMENTO STATUS → AGENTE
// ====================================

export function fasePorStatus(statusLead?: string): string {
    if (!statusLead) return 'FASE1_QUALIFICACAO';
    if (['NOVO', 'QUALIFICADO'].includes(statusLead)) return 'FASE1_QUALIFICACAO';
    if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'CONTATANDO', 'AVALIACAO_EM_ANDAMENTO'].includes(statusLead)) return 'FASE2_DIAGNOSTICO_SPIN';
    if (['DOCUMENTACAO', 'EM_NEGOCIACAO'].includes(statusLead)) return 'FASE3_DOCUMENTACAO_HUMANA';
    if (['ONBOARDING'].includes(statusLead)) return 'FASE4_ONBOARDING';
    if (['CAPTADO'].includes(statusLead)) return 'CARTEIRA';
    return 'DESCONHECIDA';
}

export function determinarAgente(statusLead?: string, contatoId?: string, agentePersistido?: TipoAgente): TipoAgente {
    if (agentePersistido) {
        logger.debug(`[ORCHESTRATOR] 🔐 Usando agente persistido no cache Redis: ${agentePersistido}`);
        return agentePersistido;
    }

    // Prioridade 1: Cache do último agente que respondeu (handoff persistido em memória)
    if (contatoId && ultimoAgentePorContato.has(contatoId)) {
        const cached = ultimoAgentePorContato.get(contatoId)!;
        logger.debug(`[ORCHESTRATOR] 🔑 Usando agente do cache: ${cached} (contatoId: ${contatoId.substring(0, 8)}...)`);
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

// ====================================
// MAPA DE NOMES SDK → TIPO
// ====================================

export const MAPA_NOMES_AGENTES: Record<string, TipoAgente> = {
    'opener_agent_v11': 'OPENER',
    'presenter_agent_v4': 'PRESENTER',
    'closer_agent_v5': 'PRESENTER',
    'admin_agent_v4': 'ADMIN',
    'knowledge_agent': 'OPENER' // Redireciona para o inicial se por acaso ele responder por último
};

// ====================================
// CRIAÇÃO DA CADEIA DE AGENTES
// ====================================

/**
 * Cria a cadeia completa de agentes com handoffs nativos do SDK.
 * Retorna o agente RAIZ (baseado no status do lead).
 * 
 * Cadeia: Opener → Presenter → Admin
 * O SDK gerencia as transferências via tools transfer_to_*.
 */
const agentChainCache = new Map<string, Record<TipoAgente, any>>();

export function obterCadeiaAgentes(config: ConfiguracaoOrquestrador): Record<TipoAgente, any> {
    const cacheKey = `${config.tenantId}-${config.llmModelo || 'default'}-${config.llmApiKey ? 'custom' : 'default'}`;
    if (!agentChainCache.has(cacheKey)) {
        agentChainCache.set(cacheKey, criarCadeiaAgentes(config));
    }
    return agentChainCache.get(cacheKey)!;
}

/**
 * Fábrica genérica para filtros de handoff baseados em Regex (Fix CR-11)
 */
function createCleanInputFilter(padroes: RegExp[], direcao: string, contextMod?: (data: any, history: any[], clean: any[]) => any) {
    return (data: any) => {
        const history = Array.isArray(data.inputHistory) ? data.inputHistory : [];
        const clean = filterHistoryByQuery(history, padroes, direcao);
        
        if (contextMod) {
            return contextMod(data, history, clean);
        }
        return { ...data, inputHistory: clean };
    };
}

export function criarCadeiaAgentes(
    config: ConfiguracaoOrquestrador,
    _contexto?: ContextoConversa // Ignorado, os agentes agora lêem via ctx.context em runtime
): Record<TipoAgente, any> {
    const baseConfig = {
        nomeAgente: config.nomeAgente,
        genero: config.genero,
        nomeImobiliaria: config.nomeImobiliaria
    };

    // Normalizar null → undefined para compatibilidade com as interfaces dos agentes
    const llmApiKey = config.llmApiKey ?? undefined;
    const llmBaseUrl = config.llmBaseUrl ?? undefined;
    const llmModelo = config.llmModelo ?? undefined;

    // BYOK: resolver modelo para cada agente (menor para admin, maior para os demais)
    const modeloPrincipal = llmModelo || 'gpt-4.1';
    const modeloAdmin = llmModelo || 'gpt-4.1-mini';

    // Knowledge agent com BYOK do tenant
    const knowledgeAgent = criarKnowledgeAgent({
        model: llmModelo,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
    });

    // Build bottom-up: Admin → Presenter → Opener
    const adminAgent = criarAdminAgent({
        ...baseConfig,
        comissaoPadrao: config.comissaoPadrao,
        prazoContrato: config.prazoContrato,
        model: modeloAdmin,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
    });

    const presenterAgent = criarPresenterAgent({
        ...baseConfig,
        diferenciais: config.diferenciais,
        model: modeloPrincipal,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
        tools: [knowledgeAgent.asTool({
            toolDescription: 'Consulte o estrategista de vendas quando o lead apresentar qualquer dúvida técnica ou objeção.'
        })]
    }) as any;
    const h_presenter_to_admin = handoff(adminAgent as any, {
        toolDescriptionOverride: 'Transferir para onboarding operacional quando houver necessidade de coleta cadastral e dados pós-assinatura.',
        inputFilter: createCleanInputFilter([
            /transferindo|vou\s+te\s+passar|aguarde\s+um\s+instante|especialista/i
        ], 'Presenter→Admin')
    });
    // handoffs do Presenter serão atribuídos depois que Opener existir (reverse handoff)

    const openerAgent = criarOpenerAgent({
        ...baseConfig,
        cidade: config.cidade,
        comissaoPadrao: config.comissaoPadrao,
        prazoContrato: config.prazoContrato,
        model: modeloPrincipal,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
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
        inputFilter: createCleanInputFilter([
            /quem\s+[eé]\s+voc[êe]|onde\s+voc[êe]\s+conseguiu|seu\s+nome\s+[ée]|quem\s+fala/i,
            /como\s+voc[êe]\s+conseguiu|meu\s+número\s+de\s+telefone|empresa\s+[ée]|de\s+qual\s+empresa/i
        ], 'Opener→Presenter', (data, history, clean) => {
            // C3: Extrair leadId do contexto para garantir disponibilidade no Presenter
            const leadId = data.context?.leadId
                || history.find((m: any) => m?.leadId)?.leadId
                || undefined;

            // C3: Detectar se proprietário já está anunciando (Trilha A vs B)
            const historicoTexto = history.map((m: any) => m?.content || '').join(' ');
            const proprietarioAtivo = /anunciado|já\s+t[oô]\s+no|OLX|Zap|Viva[Rr]eal|portal|imobili[aá]ria|corretor/i.test(historicoTexto);

            return {
                ...data,
                inputHistory: clean,
                context: { ...data.context, leadId, proprietarioAtivo }
            };
        })
    });
    openerAgent.handoffs = [h_opener_to_presenter];

    // Reverse handoff: Presenter → Opener (lead transferido prematuramente)
    const h_presenter_to_opener = handoff(openerAgent as any, {
        toolDescriptionOverride: `DEVOLVER_PARA_ABERTURA: Use APENAS quando o lead claramente não está pronto para diagnóstico.

SINAIS DE TRANSFERÊNCIA PREMATURA:
- Lead responde com desconfiança: "quem é você?", "como conseguiu meu número?"
- Lead demonstra frieza ou hostilidade
- Respostas monossilábicas sem engajamento
- Lead pede para parar ou demonstra irritação

NÃO DEVOLVER SE:
- Lead fez apenas uma pergunta técnica (use knowledge tool)
- Lead está engajado mas inseguro (continue o diagnóstico)
- Lead pediu tempo para pensar (agende follow-up)`,
        inputFilter: createCleanInputFilter([
            /transferindo|vou\s+te\s+passar|aguarde\s+um\s+instante|especialista/i
        ], 'Presenter→Opener')
    });

    // Atribuir todos os handoffs do Presenter (incluindo reverse)
    presenterAgent.handoffs = [h_presenter_to_admin, h_presenter_to_opener];

    // Lifecycle Hooks — métricas e logging (atribuídos uma única vez por cache hit)
    const agentes: any[] = [openerAgent, presenterAgent, adminAgent];
    for (const ag of agentes) {
        ag.on('agent_start', (_ctx: any, agent: any) => {
            // Usa propriedade anexa no escopo do runner em vez de closure Map vazante
            _ctx._startTime = Date.now();
            logger.debug(`[LIFECYCLE] ▶️ ${agent.name} iniciou`);
        });
        ag.on('agent_end', (_ctx: any, output: any) => {
            const elapsed = Date.now() - (_ctx._startTime || Date.now());
            const outputText = typeof output === 'string' ? output : JSON.stringify(output);
            const linhas = outputText.split('\n').length;
            logger.debug(`[LIFECYCLE] ⏹️ ${ag.name} finalizou (${elapsed}ms, ${linhas} linhas)`);
        });
    }

    return {
        OPENER: openerAgent,
        PRESENTER: presenterAgent,
        ADMIN: adminAgent
    };
}

/**
 * Cria um agente específico pela cadeia completa.
 * Mantém retrocompatibilidade.
 */
export function criarAgente(
    tipo: TipoAgente,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa
): ElyonAgent {
    const cadeia = obterCadeiaAgentes(config);
    return cadeia[tipo];
}
