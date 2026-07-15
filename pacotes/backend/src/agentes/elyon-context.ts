/**
 * ELYON CONTEXT — Contexto tipado compartilhado entre agentes, tools e guardrails
 * 
 * Este é o objeto de injeção de dependência do SDK OpenAI Agents.
 * É criado no Orchestrator e passado ao run(), ficando disponível
 * em todas as tools, guardrails, e hooks via RunContext<ElyonContext>.
 * 
 * @version 1.0
 * @date 23/02/2026
 */

import type { PrismaClient, Lead } from '@prisma/client';
import { OpenAIChatCompletionsModel } from '@openai/agents-openai';
import { OpenAI } from 'openai';
import { logger } from '../lib/logger';
import { MODELO_PADRAO_PRINCIPAL } from './byok-resolver';
import type { SchemaState } from './conversation-state';

// ====================================
// CONFIGURAÇÃO BYOK (Bring Your Own Key)
// ====================================

export interface ByokConfig {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
}

/**
 * Cria instância de modelo OpenAI com suporte a BYOK.
 * Se apiKey é fornecida, cria um client customizado.
 * Caso contrário, usa o modelo padrão do ambiente.
 * 
 * Nota: Apenas provedores OpenAI-compatible são suportados (OpenAI, OpenRouter).
 * O customFetch com reasoning_content injection foi REMOVIDO — não há mais
 * provedores incompatíveis que exigiam esse workaround.
 */
export function criarModeloBYOK(
    config: ByokConfig,
    defaultModel: string = MODELO_PADRAO_PRINCIPAL
): string | OpenAIChatCompletionsModel {
    const modelName = config.model || defaultModel;

    logger.debug({ 
        model: modelName, 
        hasCustomKey: !!config.apiKey,
        baseUrl: config.baseUrl ? '***(masked)' : 'default'
    }, '[BYOK] Instanciando modelo');

    if (config.apiKey) {
        const client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });

        return new OpenAIChatCompletionsModel(client, modelName);
    }

    return modelName;
}

// ====================================
// CONTEXTO PRINCIPAL
// ====================================

/**
 * Contexto compartilhado entre todos os agentes, tools e guardrails.
 * Acessível via `ctx.context` em qualquer tool ou guardrail do SDK.
 */
export interface ElyonContext {
    // Identificadores
    tenantId: string;
    contatoId?: string;
    leadId?: string;
    telefone: string;
    ultimaInteracao?: string;
    // toda a ficha CADASTRAL do lead (quando disponível)
    leadRecord?: Lead | null;

    // Status do lead no funil
    statusLead?: string;
    doresIdentificadas?: string[];
    empreendimento?: string;
    situacaoAtual?: string;

    // Configuração do tenant/agente
    nomeAgente: string;
    genero: string;
    nomeImobiliaria: string;
    cidade?: string;
    diferenciais?: string[];
    comissaoPadrao?: string;
    prazoContrato?: number;

    // RAG e briefing
    ragPerfilTexto?: string;
    briefingEmpreendimento?: string;
    knowledgeBase?: string;

    // estado persistido de coleta (schema)
    schemaState?: SchemaState;

    // Admin-specific
    tipoAutorizacao?: string;
    comissaoAcordada?: string;
    prazoTrabalho?: number;

    // Banco de dados (injeção de dependência)
    prisma: PrismaClient;
    /** Fence duravel do lote inbound; tools devem validar antes de efeitos. */
    assertFencing?: () => Promise<void>;
    withFencedTransaction?: <T>(command: () => Promise<T>) => Promise<T>;
}
