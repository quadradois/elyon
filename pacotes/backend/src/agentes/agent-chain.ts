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
import { knowledgeAgent } from './knowledge-agent';
import { filterHistoryByQuery } from './handoff-filters';
import type { ConfiguracaoOrquestrador, ContextoConversa } from './orchestrator';

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

// 🔑 Cache em memória: último agente que respondeu por contato
// Resolve o problema de statusLead nunca ser atualizado no BD
export const ultimoAgentePorContato = new Map<string, TipoAgente>();

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
export function criarCadeiaAgentes(
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa
): Record<TipoAgente, any> {
    const baseConfig = {
        nomeAgente: config.nomeAgente,
        genero: config.genero,
        nomeImobiliaria: config.nomeImobiliaria
    };

    // BYOK: resolver modelo para cada agente (menor para admin, maior para os demais)
    const modeloPrincipal = config.llmModelo || 'gpt-4.1';
    const modeloAdmin = config.llmModelo || 'gpt-4.1-mini';

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

/**
 * Cria um agente específico pela cadeia completa.
 * Mantém retrocompatibilidade.
 */
export function criarAgente(
    tipo: TipoAgente,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa
): ElyonAgent {
    const cadeia = criarCadeiaAgentes(config, contexto);
    return cadeia[tipo];
}
