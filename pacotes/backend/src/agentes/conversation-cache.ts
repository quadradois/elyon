/**
 * CONVERSATION CACHE — Cache de histórico SDK por contato (Redis + fallback em memória)
 * 
 * Armazena `result.history` (AgentInputItem[]) entre turnos de conversa,
 * preservando tool calls, handoffs e system messages do SDK.
 * 
 * Backend primário: Redis (sobrevive a restarts)
 * Fallback: Map em memória (se Redis falhar)
 * TTL: 6 horas
 * Limite: últimos 50 itens por conversa
 * 
 * @version 2.0
 */

import { getRedisClient } from '../lib/redis';

type ConversationHistory = any[];

interface CacheEntry {
    history: ConversationHistory;
    lastAgent?: string;
}

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 horas
const MAX_HISTORY_ITEMS = 50;
const REDIS_PREFIX = 'elyon:conv:';

// Fallback em memória caso Redis esteja indisponível
const memoryFallback = new Map<string, { entry: CacheEntry; lastAccess: number }>();

/**
 * Recupera o histórico SDK de uma conversa.
 * Tenta Redis primeiro, fallback para memória.
 */
export async function getHistory(contatoId: string): Promise<ConversationHistory | undefined> {
    try {
        const redis = await getRedisClient();
        const data = await redis.get(`${REDIS_PREFIX}${contatoId}`);
        if (data) {
            const entry: CacheEntry = JSON.parse(data);
            console.log(`[CONV-CACHE] 📡 Redis hit: ${entry.history.length} itens para ${contatoId.substring(0, 8)}...`);
            return entry.history;
        }
        return undefined;
    } catch (err) {
        // Fallback para memória
        const mem = memoryFallback.get(contatoId);
        if (mem && Date.now() - mem.lastAccess < CACHE_TTL_SECONDS * 1000) {
            mem.lastAccess = Date.now();
            console.log(`[CONV-CACHE] 💾 Memory fallback: ${mem.entry.history.length} itens para ${contatoId.substring(0, 8)}...`);
            return mem.entry.history;
        }
        return undefined;
    }
}

/**
 * Salva o histórico SDK de uma conversa.
 * Persiste em Redis com TTL, fallback para memória.
 */
export async function setHistory(
    contatoId: string,
    history: ConversationHistory,
    lastAgent?: string
): Promise<void> {
    // Truncar se exceder o limite
    const truncated = history.length > MAX_HISTORY_ITEMS
        ? history.slice(-MAX_HISTORY_ITEMS)
        : history;

    const entry: CacheEntry = { history: truncated, lastAgent };

    try {
        const redis = await getRedisClient();
        await redis.setEx(
            `${REDIS_PREFIX}${contatoId}`,
            CACHE_TTL_SECONDS,
            JSON.stringify(entry)
        );
        console.log(`[CONV-CACHE] 📡 Redis save: ${truncated.length} itens para ${contatoId.substring(0, 8)}... (agente: ${lastAgent || 'N/A'})`);
    } catch (err) {
        // Fallback para memória
        memoryFallback.set(contatoId, { entry, lastAccess: Date.now() });
        console.warn(`[CONV-CACHE] ⚠️ Redis indisponível, usando memória para ${contatoId.substring(0, 8)}...`);
    }
}

/**
 * Retorna o último agente que respondeu para o contato.
 */
export async function getLastAgent(contatoId: string): Promise<string | undefined> {
    try {
        const redis = await getRedisClient();
        const data = await redis.get(`${REDIS_PREFIX}${contatoId}`);
        if (data) {
            const entry: CacheEntry = JSON.parse(data);
            return entry.lastAgent;
        }
    } catch {
        const mem = memoryFallback.get(contatoId);
        return mem?.entry.lastAgent;
    }
    return undefined;
}

/**
 * Limpa o cache de um contato específico.
 */
export async function clearHistory(contatoId: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        await redis.del(`${REDIS_PREFIX}${contatoId}`);
    } catch { /* ignore */ }
    memoryFallback.delete(contatoId);
}

/**
 * Retorna estatísticas do cache para logging.
 */
export async function getCacheStats(): Promise<{ redisKeys: number; memoryKeys: number }> {
    let redisKeys = 0;
    try {
        const redis = await getRedisClient();
        const keys = await redis.keys(`${REDIS_PREFIX}*`);
        redisKeys = keys.length;
    } catch { /* ignore */ }

    return {
        redisKeys,
        memoryKeys: memoryFallback.size
    };
}
