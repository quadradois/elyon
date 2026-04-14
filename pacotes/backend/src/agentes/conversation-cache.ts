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
import { logger } from '../lib/logger';
import type { AgentInputItem } from '@openai/agents';
import type { SchemaState } from './conversation-state';

type ConversationHistory = AgentInputItem[];

interface CacheEntry {
    history: ConversationHistory;
    lastAgent?: string;
    // not storing schema here to keep history backward-compatible; use separate key
}

// schema cache stored under a secondary key
interface SchemaEntry {
    schema: SchemaState;
    lastAccess: number;
}

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 horas
const MAX_HISTORY_ITEMS = 80;
const REDIS_PREFIX = 'elyon:conv:';

// Fallback em memória caso Redis esteja indisponível
const memoryFallback = new Map<string, { entry: CacheEntry | SchemaEntry; lastAccess: number }>();

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
            logger.debug(`[CONV-CACHE] 📡 Redis hit: ${entry.history.length} itens para ${contatoId.substring(0, 8)}...`);
            return entry.history;
        }
        return undefined;
    } catch (err) {
        // Fallback para memória
        const mem = memoryFallback.get(contatoId);
        if (mem && Date.now() - mem.lastAccess < CACHE_TTL_SECONDS * 1000) {
            mem.lastAccess = Date.now();
            logger.debug(`[CONV-CACHE] 💾 Memory fallback: ${(mem.entry as CacheEntry).history.length} itens para ${contatoId.substring(0, 8)}...`);
            return (mem.entry as CacheEntry).history;
        }
        return undefined;
    }
}

// ======== schema functions ========

/**
 * Retrieves stored schema state for a conversation.
 */
export async function getSchemaState(contatoId: string): Promise<SchemaState | undefined> {
    const key = `${REDIS_PREFIX}${contatoId}:schema`;
    try {
        const redis = await getRedisClient();
        const data = await redis.get(key);
        if (data) {
            const entry = JSON.parse(data);
            logger.debug(`[CONV-CACHE] 📡 Redis hit (schema) para ${contatoId.substring(0, 8)}...`);
            return entry.schema;
        }
    } catch (err) {
        const mem = memoryFallback.get(key);
        if (mem && Date.now() - mem.lastAccess < CACHE_TTL_SECONDS * 1000) {
            mem.lastAccess = Date.now();
            logger.debug(`[CONV-CACHE] 💾 Memory fallback (schema) para ${contatoId.substring(0, 8)}...`);
            return (mem.entry as SchemaEntry).schema;
        }
    }
    return undefined;
}

/**
 * Stores schema state for a conversation.
 */
export async function setSchemaState(contatoId: string, schema: SchemaState): Promise<void> {
    const key = `${REDIS_PREFIX}${contatoId}:schema`;
    const entry: SchemaEntry = { schema, lastAccess: Date.now() };
    try {
        const redis = await getRedisClient();
        await redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(entry));
        // FIX MEMORY LEAK: NÃO escrever no memoryFallback quando Redis está OK
        logger.debug(`[CONV-CACHE] 📡 Redis save (schema) para ${contatoId.substring(0, 8)}...`);
    } catch (err) {
        memoryFallback.set(key, { entry, lastAccess: Date.now() });
        logger.debug(`[CONV-CACHE] 💾 Memory save (schema) para ${contatoId.substring(0, 8)}...`);
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
        logger.debug(`[CONV-CACHE] 📡 Redis save: ${truncated.length} itens para ${contatoId.substring(0, 8)}... (agente: ${lastAgent || 'N/A'})`);
    } catch (err) {
        // Fallback para memória
        memoryFallback.set(contatoId, { entry, lastAccess: Date.now() });
        logger.warn(`[CONV-CACHE] ⚠️ Redis indisponível, usando memória para ${contatoId.substring(0, 8)}...`);
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
        return (mem?.entry as CacheEntry | undefined)?.lastAgent;
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
/**
 * Retorna estatísticas do cache para logging.
 */
export async function getCacheStats(): Promise<{ redisKeys: number; memoryKeys: number }> {
    let redisKeys = 0;
    try {
        const redis = await getRedisClient();
        // Substituído redis.keys por dbSize (O(1)) - CR-14
        redisKeys = await redis.dbSize();
    } catch { /* ignore */ }

    return {
        redisKeys,
        memoryKeys: memoryFallback.size
    };
}

// ====================================
// AGENTE ATIVO POR CONTATO (Q1)
// ====================================

const AGENT_PREFIX = 'elyon:agent:';
const AGENT_TTL_SECONDS = 24 * 60 * 60; // 24 horas (sobrevive restarts)

// Fallback em memória para o agente ativo
const agentMemoryFallback = new Map<string, { agente: string, lastAccess: number }>();

/**
 * Retorna o agente ativo persistido para um contato.
 * Redis primeiro, fallback para memória.
 */
export async function getActiveAgent(contatoId: string): Promise<string | undefined> {
    try {
        const redis = await getRedisClient();
        const agente = await redis.get(`${AGENT_PREFIX}${contatoId}`);
        if (agente) {
            logger.debug(`[AGENT-CACHE] 📡 Redis hit: agente ${agente} para ${contatoId.substring(0, 8)}...`);
            return agente;
        }
    } catch {
        const mem = agentMemoryFallback.get(contatoId);
        if (mem && Date.now() - mem.lastAccess < AGENT_TTL_SECONDS * 1000) {
            mem.lastAccess = Date.now();
            logger.debug(`[AGENT-CACHE] 💾 Memory fallback: agente ${mem.agente} para ${contatoId.substring(0, 8)}...`);
            return mem.agente;
        }
    }
    return undefined;
}

/**
 * Persiste o agente ativo de um contato no Redis.
 * Fallback para memória se Redis estiver indisponível.
 */
export async function setActiveAgent(contatoId: string, agente: string): Promise<void> {
    agentMemoryFallback.set(contatoId, { agente, lastAccess: Date.now() }); // sempre atualiza memória como backup
    try {
        const redis = await getRedisClient();
        await redis.setEx(`${AGENT_PREFIX}${contatoId}`, AGENT_TTL_SECONDS, agente);
        logger.debug(`[AGENT-CACHE] 📡 Redis save: agente ${agente} para ${contatoId.substring(0, 8)}...`);
    } catch {
        logger.warn(`[AGENT-CACHE] ⚠️ Redis indisponível, agente ${agente} salvo apenas em memória`);
    }
}

/**
 * Remove o agente ativo de um contato (ex: conversa encerrada).
 */
export async function clearActiveAgent(contatoId: string): Promise<void> {
    agentMemoryFallback.delete(contatoId);
    try {
        const redis = await getRedisClient();
        await redis.del(`${AGENT_PREFIX}${contatoId}`);
    } catch { /* ignore */ }
}

// Inicializar Garbage Collection dos Maps em memória (CR-02)
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memoryFallback.entries()) {
        if (now - v.lastAccess > CACHE_TTL_SECONDS * 1000) memoryFallback.delete(k);
    }
    for (const [k, v] of agentMemoryFallback.entries()) {
        if (now - v.lastAccess > AGENT_TTL_SECONDS * 1000) agentMemoryFallback.delete(k);
    }
}, 5 * 60 * 1000).unref(); // roda a cada 5 min sem travar o event loop
