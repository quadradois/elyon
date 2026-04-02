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
        const itemAny = item as any;
        if (itemAny.role === 'system') {
            return true;
        }

        if (typeof itemAny.content === 'string') {
            const matchedPattern = patterns.find(p => p.test(itemAny.content as string));
            if (matchedPattern) {
                removidos.push(`"${(itemAny.content as string).substring(0, 40)}..." (${matchedPattern.source})`);
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
 */
export function sliceHistoryPreservingSystem(
    history: AgentInputItem[],
    turnsToKeep: number,
    context?: string
): AgentInputItem[] {
    const systemItems = history.filter(item => {
        const itemAny = item as any;
        return itemAny.role === 'system';
    });
    
    // NOTA: tool_call_item e tool_call_output_item são EXCLUÍDOS do histórico persistido.
    // Motivo: modelos thinking (ex: kimi-k2-thinking) exigem reasoning_content em mensagens
    // de tool call. O SDK @openai/agents não preserva esse campo ao serializar result.history,
    // causando BadRequestError 400 na turn seguinte. O contexto da tool já está refletido
    // na mensagem de texto do assistant que veio após o tool call.
    const nonSystemItems = history.filter(item => {
        const itemAny = item as any;
        return itemAny.role !== 'system' && 
               itemAny.type !== 'tool_call_item' && 
               itemAny.type !== 'tool_call_output_item';
    });

    // Aumentar o número de turnos preservados para manter mais contexto
    const effectiveTurnsToKeep = Math.max(turnsToKeep, 15); // Garantir pelo menos 15 turnos
    const strategyItems = nonSystemItems.slice(-effectiveTurnsToKeep);

    // 📊 Métricas
    const removidos = nonSystemItems.length - strategyItems.length;
    if (removidos > 0) {
        logger.debug(`[HANDOFF-FILTER] 📊 ${context || 'Slice'}: ${nonSystemItems.length} → ${strategyItems.length} turnos (${removidos} antigos descartados, ${systemItems.length} system, tool calls excluídos do cache)`);
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
    config?: any
): Promise<AgentInputItem | null> {
    try {
        // Extrair mensagens legíveis (user/assistant) E dados de tool calls para o resumo
        const mensagensFormatadas: string[] = [];
        
        // Processar últimas 15 mensagens para mais contexto
        const ultimasMensagens = history.slice(-15);
        
        for (const item of ultimasMensagens) {
            const itemAny = item as any;
            
            // Tool calls PRIMEIRO (podem ter role 'assistant' junto)
            if (itemAny.type === 'tool_call_item') {
                const toolName = itemAny.toolName || itemAny.name || 'tool_desconhecida';
                const args = itemAny.args || itemAny.parameters || {};
                mensagensFormatadas.push(`[TOOL EXECUTADA: ${toolName}] Parâmetros: ${JSON.stringify(args)}`);
            } else if (itemAny.type === 'tool_call_output_item') {
                const toolName = itemAny.toolName || itemAny.name || 'tool_desconhecida';
                const output = itemAny.output || itemAny.result || {};
                const outputResumido = typeof output === 'string' && output.length > 100 ? 
                    output.substring(0, 100) + '...' : JSON.stringify(output);
                mensagensFormatadas.push(`[RESULTADO TOOL: ${toolName}] ${outputResumido}`);
            } else if (itemAny.role === 'user') {
                const conteudo = typeof itemAny.content === 'string' ? itemAny.content : JSON.stringify(itemAny.content);
                mensagensFormatadas.push(`PROPRIETÁRIO: ${conteudo}`);
            } else if (itemAny.role === 'assistant') {
                const conteudo = typeof itemAny.content === 'string' ? itemAny.content : JSON.stringify(itemAny.content);
                mensagensFormatadas.push(`AGENTE: ${conteudo}`);
            }
        }
        
        const mensagens = mensagensFormatadas.join('\n');

        if (!mensagens || mensagens.length < 50) {
            return null; // Conversa muito curta para resumir
        }

        // Resolvendo BYOK
        const resolvedor = require('./byok-resolver');
        const byok = resolvedor.resolverChaveAgentes(config as any);
        
        const openai = new OpenAI({
             apiKey: byok.apiKey || process.env.OPENAI_API_KEY,
             baseURL: byok.baseUrl || undefined
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            temperature: 0.3,
            max_tokens: 300,
            messages: [
                {
                    role: 'system',
                    content: `Você é um analista de vendas imobiliárias. Gere um BRIEFING ESTRATÉGICO conciso (máximo 5 linhas) para o próximo agente da cadeia de captação.

O agente "${agenteOrigem}" está transferindo o lead para o agente "${agenteDestino}".

Seu briefing deve conter:
1. Resumo do perfil emocional do lead (receptivo/resistente/urgente)
2. Dores ou objeções identificadas
3. O que funcionou na conversa até agora
4. O que evitar (pontos sensíveis)
5. Próximo passo recomendado

Seja DIRETO e TÁTICO. Não use introduções. Comece direto com os fatos.`
                },
                {
                    role: 'user',
                    content: `Conversa até o momento:\n\n${mensagens}`
                }
            ]
        });

        const briefing = response.choices[0]?.message?.content;
        if (!briefing) return null;

        logger.debug(`[HANDOFF-FILTER] 🧠 Briefing LLM gerado (${agenteOrigem} → ${agenteDestino}): ${briefing.substring(0, 80)}...`);

        // Retornar como mensagem developer para injetar no histórico
        return {
            role: 'system',
            content: `BRIEFING ESTRATÉGICO (${agenteOrigem} → ${agenteDestino}):\n${briefing}`
        } as any;

    } catch (err) {
        logger.warn("[erro capturado]");
        return null;
    }
}
