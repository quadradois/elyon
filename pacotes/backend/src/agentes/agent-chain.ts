/**
 * AGENT CHAIN — Criação e roteamento da cadeia de agentes
 * 
 * Extraído do orchestrator.ts para separação de responsabilidades.
 * Contém:
 * - Mapeamento status → agente (SDR/ADMIN)
 * - Cache em memória do último agente por contato
 * - Criação da cadeia com handoffs nativos do SDK
 * 
 * @version 2.0 — Unificação SDR (Opener+Presenter merge)
 * @date 11/04/2026
 */

import { Agent, handoff, type HandoffInputData, type RunContext, type AgentInputItem } from '@openai/agents';
import { criarSdrAgent } from './sdr-agent';
import { criarAdminAgent } from './admin-agent';
import { criarKnowledgeAgent } from './knowledge-agent';
import { filterHistoryByQuery } from './handoff-filters';
import { getActiveAgent, setActiveAgent } from './conversation-cache';
import type { ConfiguracaoOrquestrador, ContextoConversa } from './orchestrator';
import type { ElyonContext } from './elyon-context';
import type { ElyonAgent } from './types';
import { logger } from '../lib/logger';
import { MODELO_PADRAO_PRINCIPAL, MODELO_PADRAO_AUXILIAR } from './byok-resolver';

// ====================================
// TIPOS
// ====================================

export type TipoAgente = 'SDR' | 'ADMIN';

/** Valores legados que podem existir no Redis/cache — mapeados para TipoAgente atual */
type TipoAgenteLegado = 'OPENER' | 'PRESENTER' | 'SDR' | 'ADMIN';

/** Converte valor legado (OPENER/PRESENTER) para o tipo atual */
function normalizarTipoAgente(valor: string): TipoAgente {
    if (valor === 'ADMIN') return 'ADMIN';
    return 'SDR'; // OPENER, PRESENTER, SDR → tudo vira SDR
}

// ====================================
// CONSTANTES
// ====================================

export const STATUS_FASE_HUMANA = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO']);

// 🔑 Cache em memória local: fallback síncrono para acesso imediato
// A fonte de verdade agora é o Redis (via getActiveAgent/setActiveAgent)
// FIX MEMORY LEAK: TTL de 6h para evitar crescimento monotônico
const AGENT_LOCAL_TTL_MS = 6 * 60 * 60 * 1000;
const ultimoAgentePorContatoInternal = new Map<string, { agente: TipoAgente; ts: number }>();

/** Proxy de leitura para manter API existente de testes */
export const ultimoAgentePorContato = {
  get(key: string): TipoAgente | undefined {
    const entry = ultimoAgentePorContatoInternal.get(key);
    return entry?.agente;
  },
  set(key: string, agente: TipoAgente): void {
    ultimoAgentePorContatoInternal.set(key, { agente, ts: Date.now() });
  },
  has(key: string): boolean {
    return ultimoAgentePorContatoInternal.has(key);
  },
  delete(key: string): boolean {
    return ultimoAgentePorContatoInternal.delete(key);
  },
  clear(): void {
    ultimoAgentePorContatoInternal.clear();
  },
  get size(): number {
    return ultimoAgentePorContatoInternal.size;
  },
};

// Cleanup periódico: evicta entradas mais antigas que 6h
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ultimoAgentePorContatoInternal) {
    if (now - v.ts > AGENT_LOCAL_TTL_MS) ultimoAgentePorContatoInternal.delete(k);
  }
}, 5 * 60 * 1000).unref();

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
        const normalizado = normalizarTipoAgente(fromRedis);
        ultimoAgentePorContato.set(contatoId, normalizado); // sincroniza memória local
        return normalizado;
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
    if (!statusLead) return 'SDR';

    // Apenas fases pós-assinatura/documental vão para ADMIN
    const statusAdmin = new Set(['DOCUMENTACAO', 'EM_NEGOCIACAO', 'ONBOARDING', 'CAPTADO']);
    if (statusAdmin.has(statusLead)) return 'ADMIN';

    // Tudo mais (NOVO, QUALIFICADO, TENTATIVA_AGENDAMENTO, VISITA_AGENDADA, CONTATANDO, AVALIACAO_EM_ANDAMENTO) → SDR
    return 'SDR';
}

// ====================================
// MAPA DE NOMES SDK → TIPO
// ====================================

export const MAPA_NOMES_AGENTES: Record<string, TipoAgente> = {
    // Agente atual
    'sdr_agent_v1': 'SDR',
    'admin_agent_v4': 'ADMIN',
    // Valores canônicos (Redis/cache)
    'SDR': 'SDR',
    'ADMIN': 'ADMIN',
    // Mapa legado — valores brutos que podem existir no Redis
    'OPENER': 'SDR',
    'PRESENTER': 'SDR',
    'CLOSER': 'SDR',
    // Mapa legado — versões SDK anteriores → SDR
    'opener_agent_v11': 'SDR',
    'opener_agent_v12': 'SDR',
    'opener_agent_v13': 'SDR',
    'presenter_agent_v4': 'SDR',
    'presenter_agent_v5': 'SDR',
    'presenter_agent_v6': 'SDR',
    'closer_agent_v5': 'SDR',
    'knowledge_agent': 'SDR', // Redireciona para o inicial se por acaso ele responder por último
};

// ====================================
// CRIAÇÃO DA CADEIA DE AGENTES
// ====================================

/**
 * Cria a cadeia completa de agentes com handoffs nativos do SDK.
 * Retorna os agentes disponíveis.
 * 
 * Cadeia: SDR → Admin
 * O SDK gerencia as transferências via tools transfer_to_*.
 */
const AGENT_CHAIN_MAX_SIZE = 50;
const AGENT_CHAIN_TTL_MS = 30 * 60 * 1000; // 30 min
const agentChainCache = new Map<string, { agents: Record<TipoAgente, ElyonAgent>; lastAccess: number }>();

// Cleanup periódico: evicta entradas mais velhas que 30 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of agentChainCache) {
    if (now - v.lastAccess > AGENT_CHAIN_TTL_MS) agentChainCache.delete(k);
  }
}, 5 * 60 * 1000).unref();

/** Gera hash curto (djb2) para strings longas usadas na chave de cache */
function hashCurto(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return (hash >>> 0).toString(36);
}

export function obterCadeiaAgentes(config: ConfiguracaoOrquestrador): Record<TipoAgente, ElyonAgent> {
    const cacheKey = [
        config.tenantId,
        config.configVersionToken || '',
        config.nomeAgente || '',
        config.nomeImobiliaria || '',
        config.llmModelo || 'default',
        config.llmApiKey ? 'custom' : 'default',
        config.ragPerfilTexto ? hashCurto(config.ragPerfilTexto) : '',
        config.comissaoPadrao || '',
        config.prazoContrato ?? '',
        config.cidade || '',
        config.briefingEmpreendimento ? hashCurto(config.briefingEmpreendimento) : '',
        config.diferenciais ? hashCurto(config.diferenciais.join(',')) : '',
    ].join('-');
    const cached = agentChainCache.get(cacheKey);
    if (cached) {
        cached.lastAccess = Date.now();
        return cached.agents;
    }
    const agents = criarCadeiaAgentes(config);
    agentChainCache.set(cacheKey, { agents, lastAccess: Date.now() });
    // LRU eviction: remover entrada mais antiga se exceder limite
    if (agentChainCache.size > AGENT_CHAIN_MAX_SIZE) {
        let oldest: string | null = null, oldestTime = Infinity;
        for (const [k, v] of agentChainCache) {
            if (v.lastAccess < oldestTime) { oldest = k; oldestTime = v.lastAccess; }
        }
        if (oldest) agentChainCache.delete(oldest);
    }
    return agents;
}

/**
 * Fábrica genérica para filtros de handoff baseados em Regex (Fix CR-11)
 */
function createCleanInputFilter(
    padroes: RegExp[],
    direcao: string,
    contextMod?: (data: HandoffInputData, history: AgentInputItem[], clean: AgentInputItem[]) => HandoffInputData
) {
    return (data: HandoffInputData): HandoffInputData => {
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
): Record<TipoAgente, ElyonAgent> {
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
    const modeloPrincipal = llmModelo || MODELO_PADRAO_PRINCIPAL;
    const modeloAdmin = llmModelo || MODELO_PADRAO_AUXILIAR;

    // Knowledge agent com BYOK do tenant
    const knowledgeAgent = criarKnowledgeAgent({
        model: llmModelo,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
    });

    // Build bottom-up: Admin → SDR
    const adminAgent = criarAdminAgent({
        ...baseConfig,
        comissaoPadrao: config.comissaoPadrao,
        prazoContrato: config.prazoContrato,
        model: modeloAdmin,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
    });

    const sdrAgent = criarSdrAgent({
        ...baseConfig,
        cidade: config.cidade,
        comissaoPadrao: config.comissaoPadrao,
        prazoContrato: config.prazoContrato,
        diferenciais: config.diferenciais,
        model: modeloPrincipal,
        apiKey: llmApiKey,
        baseUrl: llmBaseUrl,
        tools: [knowledgeAgent.asTool({
            toolDescription: 'Consulte o estrategista de vendas quando o lead apresentar qualquer dúvida técnica ou objeção.'
        })]
    });

    // Único handoff: SDR → Admin (para onboarding/documentação pós-assinatura)
    const h_sdr_to_admin = handoff(adminAgent as Agent<ElyonContext>, {
        toolDescriptionOverride: 'Transferir para onboarding operacional quando houver necessidade de coleta cadastral e dados pós-assinatura.',
        inputFilter: createCleanInputFilter([
            /transferindo|vou\s+te\s+passar|aguarde\s+um\s+instante|especialista/i
        ], 'SDR→Admin')
    });
    sdrAgent.handoffs = [h_sdr_to_admin];

    // Lifecycle Hooks — métricas e logging
    const agentes: ElyonAgent[] = [sdrAgent, adminAgent];
    for (const ag of agentes) {
        ag.on('agent_start', (_ctx: RunContext<ElyonContext>, agent: Agent<ElyonContext>) => {
            (_ctx as unknown as Record<string, unknown>)._startTime = Date.now();
            logger.debug(`[LIFECYCLE] ▶️ ${agent.name} iniciou`);
        });
        ag.on('agent_end', (_ctx: RunContext<ElyonContext>, output: string) => {
            const elapsed = Date.now() - ((_ctx as unknown as Record<string, unknown>)._startTime as number || Date.now());
            const linhas = output.split('\n').length;
            logger.debug(`[LIFECYCLE] ⏹️ ${ag.name} finalizou (${elapsed}ms, ${linhas} linhas)`);
        });
    }

    return {
        SDR: sdrAgent,
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
