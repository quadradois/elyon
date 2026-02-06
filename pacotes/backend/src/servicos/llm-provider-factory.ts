/**
 * LLM PROVIDER FACTORY
 * 
 * Factory para criar providers de LLM baseado na configuração do tenant.
 * Suporta BYOK (Bring Your Own Key) com múltiplos providers via LiteLLM.
 * 
 * @version 1.0
 * @date 2026-02-06
 */

import { prisma } from '../lib/db';
import { TipoLLM } from '@prisma/client';
import crypto from 'crypto';

// ====================================
// TYPES
// ====================================

export interface LLMProviderConfig {
    modelString: string;       // String para passar ao Agent (ex: "litellm/anthropic/claude-haiku-4-5")
    apiKey: string;            // API Key descriptografada
    baseUrl?: string;          // URL customizada se houver
    providerType: TipoLLM;     // Tipo do provider
}

export interface LLMUsageMetrics {
    tokensInput: number;
    tokensOutput: number;
    custoEstimado: number;
}

// ====================================
// ENCRYPTION UTILS
// ====================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'elyon-default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

/**
 * Descriptografa uma API key
 */
function decryptApiKey(encryptedKey: string): string {
    try {
        const [ivHex, encrypted] = encryptedKey.split(':');
        if (!ivHex || !encrypted) {
            // Se não está no formato esperado, pode ser plain text (legacy)
            console.warn('[LLMProviderFactory] API Key não está criptografada, usando como está');
            return encryptedKey;
        }

        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('[LLMProviderFactory] Erro ao descriptografar API Key:', error);
        throw new Error('Falha ao descriptografar API Key do tenant');
    }
}

/**
 * Criptografa uma API key para armazenamento
 */
export function encryptApiKey(plainKey: string): string {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
}

// ====================================
// MODEL MAPPING
// ====================================

/**
 * Mapeia TipoLLM + modelo para string LiteLLM
 */
function getLiteLLMModelString(provider: TipoLLM, modelo: string): string {
    // Mapeamento de provider para prefixo LiteLLM
    // Documentação: https://docs.litellm.ai/docs/providers
    const providerPrefixes: Record<TipoLLM, string> = {
        OPENAI: '',                           // OpenAI não precisa de prefixo
        ANTHROPIC: 'anthropic/',              // ex: anthropic/claude-3-5-sonnet-20240620
        AZURE_OPENAI: 'azure/',               // ex: azure/gpt-4
        GOOGLE_VERTEX: 'vertex_ai/',          // ex: vertex_ai/gemini-pro
        GROQ: 'groq/',                         // ex: groq/llama3-70b-8192
        MISTRAL: 'mistral/',                  // ex: mistral/mistral-large-latest
        TOGETHER: 'together_ai/',             // ex: together_ai/llama-3-70b
        DEEPSEEK: 'deepseek/',                // ex: deepseek/deepseek-chat
    };

    const prefix = providerPrefixes[provider] || '';
    return `${prefix}${modelo}`;
}

/**
 * Retorna a ENV var padrão do sistema para cada provider
 */
function getSystemDefaultApiKey(provider: TipoLLM): string | null {
    const envVars: Record<TipoLLM, string> = {
        OPENAI: 'OPENAI_API_KEY',
        ANTHROPIC: 'ANTHROPIC_API_KEY',
        AZURE_OPENAI: 'AZURE_API_KEY',
        GOOGLE_VERTEX: 'VERTEX_API_KEY',
        GROQ: 'GROQ_API_KEY',
        MISTRAL: 'MISTRAL_API_KEY',
        TOGETHER: 'TOGETHER_API_KEY',
        DEEPSEEK: 'DEEPSEEK_API_KEY',
    };

    const envVar = envVars[provider];
    return process.env[envVar] || null;
}

// ====================================
// MAIN FACTORY CLASS
// ====================================

class LLMProviderFactory {

    /**
     * Obtém a configuração de LLM para um tenant
     * 
     * Ordem de prioridade:
     * 1. Configuração BYOK do tenant (se existir e ativo)
     * 2. Chave padrão do sistema (env vars)
     */
    async getProviderForTenant(tenantId: string): Promise<LLMProviderConfig> {
        console.log(`[LLMProviderFactory] Buscando provider para tenant ${tenantId}`);

        // 1. Buscar configuração BYOK do tenant
        const configTenant = await prisma.configuracaoLLM.findFirst({
            where: {
                tenantId,
                ativo: true
            },
            orderBy: { priorizacao: 'asc' }  // Menor prioridade = mais importante
        });

        if (configTenant && configTenant.apiKeyCriptografada) {
            console.log(`[LLMProviderFactory] ✅ Usando BYOK do tenant: ${configTenant.tipoProvider}`);

            const apiKey = decryptApiKey(configTenant.apiKeyCriptografada);

            return {
                modelString: getLiteLLMModelString(configTenant.tipoProvider, configTenant.modeloPreferido),
                apiKey,
                baseUrl: configTenant.baseUrl || undefined,
                providerType: configTenant.tipoProvider
            };
        }

        // 2. Usar configuração padrão do sistema
        console.log('[LLMProviderFactory] ⚠️ Tenant sem BYOK, usando chave do sistema');
        return this.getSystemDefaultProvider();
    }

    /**
     * Retorna o provider padrão do sistema (Anthropic Claude)
     */
    getSystemDefaultProvider(): LLMProviderConfig {
        // Prioridade: Anthropic > OpenAI
        const anthropicKey = getSystemDefaultApiKey('ANTHROPIC');
        if (anthropicKey) {
            return {
                modelString: 'anthropic/claude-haiku-4-5-20251001',
                apiKey: anthropicKey,
                providerType: 'ANTHROPIC'
            };
        }

        const openaiKey = getSystemDefaultApiKey('OPENAI');
        if (openaiKey) {
            return {
                modelString: 'gpt-4o-mini',
                apiKey: openaiKey,
                providerType: 'OPENAI'
            };
        }

        throw new Error('Nenhuma API key de LLM configurada no sistema. Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY.');
    }

    /**
     * Registra métricas de uso de um tenant
     */
    async registrarUso(tenantId: string, metrics: LLMUsageMetrics): Promise<void> {
        try {
            const config = await prisma.configuracaoLLM.findFirst({
                where: { tenantId, ativo: true }
            });

            if (config) {
                await prisma.configuracaoLLM.update({
                    where: { id: config.id },
                    data: {
                        totalChamadas: { increment: 1 },
                        totalTokensInput: { increment: BigInt(metrics.tokensInput) },
                        totalTokensOutput: { increment: BigInt(metrics.tokensOutput) },
                        custoEstimado: { increment: metrics.custoEstimado },
                        ultimoUsoEm: new Date()
                    }
                });
            }
        } catch (error) {
            console.error('[LLMProviderFactory] Erro ao registrar métricas:', error);
            // Não lança erro para não interromper o fluxo
        }
    }

    /**
     * Testa conectividade com um provider
     */
    async testarConexao(tenantId: string, tipoProvider: TipoLLM): Promise<{ sucesso: boolean; erro?: string }> {
        try {
            const config = await prisma.configuracaoLLM.findUnique({
                where: { tenantId_tipoProvider: { tenantId, tipoProvider } }
            });

            if (!config || !config.apiKeyCriptografada) {
                return { sucesso: false, erro: 'Configuração não encontrada' };
            }

            // TODO: Implementar teste real de conexão com cada provider
            // Por enquanto, apenas valida que a key existe
            const apiKey = decryptApiKey(config.apiKeyCriptografada);
            const sucesso = apiKey.length > 10;

            await prisma.configuracaoLLM.update({
                where: { id: config.id },
                data: {
                    ultimoTesteEm: new Date(),
                    ultimoTesteOk: sucesso,
                    ultimoErro: sucesso ? null : 'API Key muito curta'
                }
            });

            return { sucesso };
        } catch (error: any) {
            return { sucesso: false, erro: error.message };
        }
    }

    /**
     * Lista todos os providers disponíveis para um tenant
     */
    async listarProvidersDisponiveis(tenantId: string): Promise<Array<{
        tipo: TipoLLM;
        configurado: boolean;
        ativo: boolean;
        modelo: string;
    }>> {
        const configs = await prisma.configuracaoLLM.findMany({
            where: { tenantId }
        });

        const allProviders: TipoLLM[] = [
            'OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'GOOGLE_VERTEX',
            'GROQ', 'MISTRAL', 'TOGETHER', 'DEEPSEEK'
        ];

        return allProviders.map(tipo => {
            const config = configs.find(c => c.tipoProvider === tipo);
            return {
                tipo,
                configurado: !!config,
                ativo: config?.ativo ?? false,
                modelo: config?.modeloPreferido ?? ''
            };
        });
    }
}

// ====================================
// SINGLETON EXPORT
// ====================================

export const llmProviderFactory = new LLMProviderFactory();
export default llmProviderFactory;
