import { descriptografar } from '../lib/crypto';
import { logger } from '../lib/logger';

// ====================================
// MODELOS PADRÃO DA PLATAFORMA (fonte única de verdade)
// Altere AQUI para mudar o default de TODOS os agentes.
// ====================================
export const MODELO_PADRAO_PRINCIPAL = process.env.LLM_MODELO_PRINCIPAL || 'gpt-4.1';
export const MODELO_PADRAO_AUXILIAR  = process.env.LLM_MODELO_AUXILIAR  || 'gpt-4.1-mini';

export interface TenantBYOK {
    llmProvedor?: string | null;
    llmModelo?: string | null;
    llmApiKeyCriptografada?: string | null;
    llmBaseUrl?: string | null;
}

export interface ResolvedKey {
    apiKey?: string;
    baseUrl?: string;
    modelo?: string;
    fonte: 'tenant' | 'plataforma';
}

/**
 * Descriptografa a chave do tenant de forma segura.
 * Retorna undefined se falhar (chave corrompida, formato inválido, etc.)
 */
function descriptografarSeguro(chaveCriptografada: string, contexto: string): string | undefined {
    try {
        return descriptografar(chaveCriptografada);
    } catch {
        logger.warn(`[BYOK] Falha ao descriptografar chave do tenant (${contexto}). Causa: formato inválido ou corrompido.`);
        return undefined;
    }
}

/**
 * Resolve a chave para QUALQUER serviço OpenAI-compatible (Agentes, Whisper, Embeddings, RAG).
 * 
 * Apenas provedores OpenAI-compatible são suportados (OpenAI, OpenRouter).
 * A mesma chave funciona para todos os serviços — não é mais necessário
 * distinguir entre chave "principal" e "secundária".
 */
export function resolverChaveAgentes(tenant: TenantBYOK | null): ResolvedKey {
    if (tenant?.llmApiKeyCriptografada && tenant.llmProvedor) {
        const apiKey = descriptografarSeguro(tenant.llmApiKeyCriptografada, 'agentes');

        if (apiKey) {
            return {
                apiKey,
                baseUrl: tenant.llmBaseUrl || undefined,
                modelo: tenant.llmModelo || undefined,
                fonte: 'tenant'
            };
        }
    }

    return {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: undefined,
        modelo: MODELO_PADRAO_PRINCIPAL,
        fonte: 'plataforma'
    };
}

/**
 * Resolve a chave para Whisper (transcrição de áudio).
 * Como só suportamos provedores OpenAI-compatible, a chave principal sempre funciona.
 */
export function resolverChaveWhisper(tenant: TenantBYOK | null): ResolvedKey {
    if (tenant?.llmApiKeyCriptografada && tenant.llmProvedor) {
        const apiKey = descriptografarSeguro(tenant.llmApiKeyCriptografada, 'whisper');
        if (apiKey) {
            return { apiKey, fonte: 'tenant' };
        }
    }
    return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
}

/**
 * Resolve a chave para Embeddings (RAG).
 * Como só suportamos provedores OpenAI-compatible, a chave principal sempre funciona.
 */
export function resolverChaveEmbeddings(tenant: TenantBYOK | null): ResolvedKey {
    // O modelo de embeddings atual é nativo da OpenAI. Chaves de provedores
    // compatíveis apenas com Chat Completions (ex.: OpenRouter) não podem ser
    // enviadas ao endpoint api.openai.com/v1/embeddings.
    const provedor = String(tenant?.llmProvedor || '').trim().toLowerCase();
    if (tenant?.llmApiKeyCriptografada && provedor === 'openai') {
        const apiKey = descriptografarSeguro(tenant.llmApiKeyCriptografada, 'embeddings');
        if (apiKey) {
            return { apiKey, fonte: 'tenant' };
        }
    }
    return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
}

