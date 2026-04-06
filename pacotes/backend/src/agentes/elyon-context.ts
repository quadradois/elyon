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

import type { PrismaClient } from '@prisma/client';
import { OpenAIChatCompletionsModel } from '@openai/agents-openai';
import { OpenAI } from 'openai';
import { logger } from '../lib/logger';

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
 */
export function criarModeloBYOK(
    config: ByokConfig,
    defaultModel: string = 'gpt-4.1'
): string | OpenAIChatCompletionsModel {
    const modelName = config.model || defaultModel;

    logger.debug({ 
        model: modelName, 
        hasCustomKey: !!config.apiKey,
        baseUrl: config.baseUrl ? '***(masked)' : 'default' // Nunca vazar a baseURL (CR-04)
    }, '[BYOK] Instanciando modelo');

    if (config.apiKey) {
        // Fetch wrapper para interceptar e injetar reasoning_content de forma segura (Fix CR-03)
        const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
            if (options && options.body && typeof options.body === 'string') {
                try {
                    const bodyObj = JSON.parse(options.body);
                    if (Array.isArray(bodyObj.messages)) {
                        bodyObj.messages = bodyObj.messages.map((msg: any) => {
                            if (
                                msg.role === 'assistant' &&
                                Array.isArray(msg.tool_calls) &&
                                msg.tool_calls.length > 0 &&
                                msg.reasoning_content == null
                            ) {
                                return { ...msg, reasoning_content: '' };
                            }
                            return msg;
                        });
                        options.body = JSON.stringify(bodyObj);
                    }
                } catch (e) {
                    logger.error({ err: e }, '[BYOK] Erro ao injetar reasoning_content no fetch wrapper');
                }
            }
            // Chama a API de fato com a promise
            return fetch(url, options);
        };

        const client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            fetch: customFetch
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
    leadRecord?: any;

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

    // estado persistido de coleta (schema) — livre para qualquer shape
    schemaState?: any;

    // Admin-specific
    tipoAutorizacao?: string;
    comissaoAcordada?: string;
    prazoTrabalho?: number;

    // Banco de dados (injeção de dependência)
    prisma: PrismaClient;
}
