import { descriptografar } from '../lib/crypto';
import { logger } from '../lib/logger';

export interface TenantBYOK {
    llmProvedor: string | null;
    llmModelo: string | null;
    llmApiKeyCriptografada: string | null;
    llmBaseUrl: string | null;
    openaiApiKeyCriptografada: string | null;
    usarChavePrincipalParaAudio: boolean;
    usarChavePrincipalParaRag: boolean;
}

export interface ResolvedKey {
    apiKey?: string;
    baseUrl?: string;
    modelo?: string;
    fonte: 'tenant_principal' | 'tenant_openai' | 'plataforma';
}

/**
 * Resolve a chave para os serviços principais (Agentes, Briefing, Fiscalização, Chunks)
 * Como todos esses usam o padrão chat.completions, são compatíveis com qualquer provedor
 */
export function resolverChaveAgentes(tenant: TenantBYOK | null): ResolvedKey {
    if (tenant?.llmApiKeyCriptografada && tenant.llmProvedor) {
        let apiKey;
        try {
            apiKey = descriptografar(tenant.llmApiKeyCriptografada);
        } catch {
            logger.warn('[BYOK] Falha ao descriptografar chave principal do tenant. Causa: formato inválido ou corrompido.');
        }

        if (apiKey) {
            return {
                apiKey,
                baseUrl: tenant.llmBaseUrl || undefined,
                modelo: tenant.llmModelo || undefined,
                fonte: 'tenant_principal'
            };
        }
    }

    return {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: undefined,
        modelo: 'gpt-4.1', // Default plataforma
        fonte: 'plataforma'
    };
}

/**
 * Resolve a chave para Whisper (Serviço de gravação/áudio)
 * Exclusivo OpenAI. O resolvedor evita o vazamento para BYOK incompatível.
 */
export function resolverChaveWhisper(tenant: TenantBYOK | null): ResolvedKey {
    if (!tenant) {
        return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
    }

    if (tenant.usarChavePrincipalParaAudio) {
        // Se a instrução é usar a chave principal, só podemos se o provedor for OpenAI
        if (tenant.llmProvedor === 'openai' && tenant.llmApiKeyCriptografada) {
            try {
                const apiKey = descriptografar(tenant.llmApiKeyCriptografada);
                return { apiKey, fonte: 'tenant_principal' };
            } catch {
                // silencioso
            }
        }
        // Se o tenant marcou "usar principal" mas configurou Groq/Moonshot, nós DEGRADAMOS
        // para a chave da plataforma para não falhar a transcrição (Whisper quebra)
        return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
    }

    // Se marcou false, usamos a chave secundária dedicada
    if (tenant.openaiApiKeyCriptografada) {
        try {
            const apiKey = descriptografar(tenant.openaiApiKeyCriptografada);
            return { apiKey, fonte: 'tenant_openai' };
        } catch {
            // silencioso
        }
    }

    // Fallback absoluto
    return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
}

/**
 * Resolve a chave para Embeddings (RAG)
 * Exclusivo OpenAI.
 */
export function resolverChaveEmbeddings(tenant: TenantBYOK | null): ResolvedKey {
    if (!tenant) {
        return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
    }

    if (tenant.usarChavePrincipalParaRag) {
        if (tenant.llmProvedor === 'openai' && tenant.llmApiKeyCriptografada) {
            try {
                const apiKey = descriptografar(tenant.llmApiKeyCriptografada);
                return { apiKey, fonte: 'tenant_principal' };
            } catch {}
        }
        return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
    }

    if (tenant.openaiApiKeyCriptografada) {
        try {
            const apiKey = descriptografar(tenant.openaiApiKeyCriptografada);
            return { apiKey, fonte: 'tenant_openai' };
        } catch {}
    }

    return { apiKey: process.env.OPENAI_API_KEY, fonte: 'plataforma' };
}
