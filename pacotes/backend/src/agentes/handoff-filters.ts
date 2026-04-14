/**
 * HANDOFF FILTERS — Utilitários de manipulação de histórico para transferências
 * 
 * Responsável por filtrar e limpar o histórico de conversas durante
 * os handoffs entre agentes especialistas, otimizando contexto e tokens.
 * 
 * Inclui:
 * - Filtragem por regex com métricas
 * - Slice de histórico preservando system messages
 * - Remoção de narração de handoff
 * - Geração de briefing estratégico via LLM (gpt-4.1-mini)
 * 
 * @version 2.0
 */

import { AgentInputItem } from '@openai/agents';
import OpenAI from 'openai';
import { logger } from '../lib/logger';
import { resolverChaveAgentes, MODELO_PADRAO_AUXILIAR, type TenantBYOK } from './byok-resolver';

const logParams = { context: 'Handoff Filters' };

/**
 * Filtra o histórico por palavras-chave ou padrões de ruído.
 * Loga métricas de filtragem para ajuste fino.
 */
export function filterHistoryByQuery(
    history: AgentInputItem[],
    patterns: RegExp[],
    context?: string // Nome do filtro para logging
): AgentInputItem[] {
    const antes = history.length;
    const removidos: string[] = [];

    const filtered = history.filter(item => {
        const rec = item as Record<string, unknown>;
        if (rec.role === 'system') {
            return true;
        }

        if (typeof rec.content === 'string') {
            const content = rec.content;
            const matchedPattern = patterns.find(p => p.test(content));
            if (matchedPattern) {
                removidos.push(`"${content.substring(0, 40)}..." (${matchedPattern.source})`);
                return false;
            }
        }

        return true;
    });

    // 📊 Métricas de filtragem
    if (removidos.length > 0) {
        logger.debug(`[HANDOFF-FILTER] 📊 ${context || 'Filtro'}: ${antes} → ${filtered.length} itens (${removidos.length} removidos)`);
        removidos.forEach(r => logger.debug(`  ❌ ${r}`));
    }

    return filtered;
}

/**
 * Mantém apenas os últimos N turnos de conversa, mas SEMPRE preserva
 * a(s) primeira(s) mensagem(ns) que costuma(m) ser de sistema/contexto.
 * 
 * Com provedores 100% OpenAI-compatible, tool_call_item e tool_call_output_item
 * são PRESERVADOS no histórico (essenciais para context fidelity e function continuity).
 */
export function sliceHistoryPreservingSystem(
    history: AgentInputItem[],
    turnsToKeep: number,
    context?: string
): AgentInputItem[] {
    const systemItems = history.filter(item => {
        return (item as Record<string, unknown>).role === 'system';
    });
    
    const nonSystemItems = history.filter(item => {
        return (item as Record<string, unknown>).role !== 'system';
    });

    // Aumentar o número de turnos preservados para manter mais contexto
    const effectiveTurnsToKeep = Math.max(turnsToKeep, 15); // Garantir pelo menos 15 turnos
    const strategyItems = nonSystemItems.slice(-effectiveTurnsToKeep);

    // 📊 Métricas
    const removidos = nonSystemItems.length - strategyItems.length;
    if (removidos > 0) {
        logger.debug(`[HANDOFF-FILTER] 📊 ${context || 'Slice'}: ${nonSystemItems.length} → ${strategyItems.length} turnos (${removidos} antigos descartados, ${systemItems.length} system preservados)`);
    }

    return [...systemItems, ...strategyItems];
}

/**
 * Remove mensagens que são puramente "narração de handoff" do histórico persistido.
 */
export function removeHandoffNarration(history: AgentInputItem[]): AgentInputItem[] {
    const padroesHandoff = [
        /transferindo/i,
        /aguard[ea]\s+um\s+instante/i,
        /vou\s+te\s+passar/i,
        /j[aá]\s+estou\s+aqui/i,
        /pronto.*aqui/i
    ];

    return filterHistoryByQuery(history, padroesHandoff, 'Anti-Narração');
}

/**
 * 🧠 Gera um briefing estratégico via LLM para injetar no handoff.
 * O novo agente recebe um "prontuário" narrativo do lead.
 * Usa gpt-4o-mini ou o modelo configurado no BYOK para custo mínimo.
 */
export async function gerarBriefingHandoff(
    history: AgentInputItem[],
    agenteOrigem: string,
    agenteDestino: string,
    config?: TenantBYOK | null
): Promise<AgentInputItem | null> {
    try {
        // Extrair mensagens legíveis (user/assistant) E dados de tool calls para o resumo
        const mensagensFormatadas: string[] = [];
        
        // Processar últimas 15 mensagens para mais contexto
        const ultimasMensagens = history.slice(-15);
        
        for (const item of ultimasMensagens) {
            const rec = item as Record<string, unknown>;
            
            // Tool calls PRIMEIRO (podem ter role 'assistant' junto)
            if (rec.type === 'tool_call_item') {
                const toolName = rec.toolName || rec.name || 'tool_desconhecida';
                const args = rec.args || rec.parameters || {};
                mensagensFormatadas.push(`[TOOL EXECUTADA: ${toolName}] Parâmetros: ${JSON.stringify(args)}`);
            } else if (rec.type === 'tool_call_output_item') {
                const toolName = rec.toolName || rec.name || 'tool_desconhecida';
                const output = rec.output || rec.result || {};
                const outputResumido = typeof output === 'string' && output.length > 100 ? 
                    output.substring(0, 100) + '...' : JSON.stringify(output);
                mensagensFormatadas.push(`[RESULTADO TOOL: ${toolName}] ${outputResumido}`);
            } else if (rec.role === 'user') {
                const conteudo = typeof rec.content === 'string' ? rec.content : JSON.stringify(rec.content);
                mensagensFormatadas.push(`PROPRIETÁRIO: ${conteudo}`);
            } else if (rec.role === 'assistant') {
                const conteudo = typeof rec.content === 'string' ? rec.content : JSON.stringify(rec.content);
                mensagensFormatadas.push(`AGENTE: ${conteudo}`);
            }
        }
        
        const mensagens = mensagensFormatadas.join('\n');

        if (!mensagens || mensagens.length < 50) {
            return null; // Conversa muito curta para resumir
        }

        // Resolvendo BYOK
        const byok = resolverChaveAgentes(config ?? null);
        
        const openai = new OpenAI({
             apiKey: byok.apiKey || process.env.OPENAI_API_KEY,
             baseURL: byok.baseUrl || undefined
        });

        const response = await openai.chat.completions.create({
            model: MODELO_PADRAO_AUXILIAR,
            temperature: 0.3,
            max_completion_tokens: 300,
            messages: [
                {
                    role: 'system',
                    content: `Você é um analista de vendas imobiliárias montando um DOSSIÊ TÁTICO do lead para o CORRETOR HUMANO que vai assumir agora.
Seja EXTREMAMENTE objetivo — esse corretor não vai ter tempo de ler texto longo. Ele precisa entrar na conversa já sabendo tudo.

Monte o dossiê EXATAMENTE neste formato (use cada seção, sem abreviações):

🏠 LEAD: [Nome/apelido se disponível] | [Tipo e metragem] | [Valor pretendido]
📍 SITUAÇÃO: [Status atual: anunciando há X tempo / imóvel parado / 1ª tentativa]
🔥 NÍVEL DE URGÊNCIA: [Alta / Média / Baixa — justifique em 1 linha]
💢 DORES PRINCIPAIS: [Liste 2-3 pontos de dor já confirmados pelo lead]
🛡️ OBJEÇÕES TRATADAS: [Quais foram levantadas e como o lead reagiu]
✅ O QUE FUNCIONOU: [Argumento ou abordagem que gerou mais engajamento]
⚠️ PONTOS SENSÍVEIS: [O que evitar, o que ainda não foi respondido]
🎯 POR ONDE COMEÇAR: [Instrução direta ao corretor: qual pergunta ou afirmação abrir a conversa]

Base: conversa entre ${agenteOrigem} e o lead.`
                },
                {
                    role: 'user',
                    content: `Conversa até o momento:\n\n${mensagens}`
                }
            ]
        });

        const briefing = response.choices[0]?.message?.content;
        if (!briefing) return null;

        logger.debug(`[HANDOFF-FILTER] 🧠 Dossiê de Closer gerado (${agenteOrigem} → ${agenteDestino}): ${briefing.substring(0, 80)}...`);

        // Retornar como mensagem system para injetar no histórico do Closer
        return {
            role: 'system' as const,
            content: `📋 DOSSIÊ DO LEAD (${agenteOrigem} → ${agenteDestino}):\n${briefing}\n\n⚡ INSTRUÇÃO: Assuma a conversa sem fazê-lo repetir dados. Comece pela instrução "Por onde Começar" acima.`
        } as AgentInputItem;

    } catch (err) {
        logger.warn({ err }, '[HANDOFF-FILTERS] Erro ao gerar briefing de handoff');
        return null;
    }
}
