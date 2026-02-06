/**
 * ORCHESTRATOR - Orquestrador dos 4 Agentes de Captação
 * 
 * Responsável por:
 * 1. Executar guardrails de entrada
 * 2. Determinar qual agente deve atender baseado no status do lead
 * 3. Processar a mensagem com o agente correto
 * 4. Gerenciar handoffs silenciosos entre agentes
 * 
 * @version 1.0
 * @date 16/12/2025
 */

import { Agent, run } from '@openai/agents';
import { prisma } from '../lib/db';
import { executarGuardrails, GuardrailResult, MensagemContext } from './guardrails';
import { agentBuilder } from '../servicos/agent-builder';
import { AgentConfigFactory } from '../servicos/agent-config-factory';
import { llmProviderFactory } from '../servicos/llm-provider-factory';
// Importções antigas mantidas apenas se necessário (mas o objetivo é remover o uso delas)
// import { criarOpenerAgent } from './opener-agent'; 
// ...

// ====================================
// TIPOS
// ====================================

export interface ConfiguracaoOrquestrador {
    tenantId: string;
    nomeAgente: string;
    genero: string;
    nomeImobiliaria: string;
    cidade?: string;
    diferenciais?: string[];
    comissaoPadrao?: string;
    prazoContrato?: number;
    regrasNegocio?: Record<string, any>;
}

export interface ContextoConversa {
    telefone: string;
    contatoId?: string;
    leadId?: string;
    statusLead?: string;
    doresIdentificadas?: string[];
    empreendimento?: string;
    situacaoAtual?: string; // "tem_corretor", "sozinho", "desistiu_corretor"
    tipoAutorizacao?: string;
    comissaoAcordada?: string;
    prazoTrabalho?: number;
    resumoConversa?: string;
    campanha?: {
        tipo: string;
        nomeEmpreendimento?: string;
        briefingCompleto?: string;
    };
}

// ====================================
// FUNÇÕES PRINCIPAIS
// ====================================

export async function buscarConfiguracaoTenant(tenantId: string): Promise<ConfiguracaoOrquestrador | null> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
    });

    if (!tenant) return null;

    // Tentar buscar configuração de agente (SDR)
    const agenteConfig = await prisma.configuracaoAgente.findFirst({
        where: {
            tenantId,
            tipoAgente: 'SDR_CAPTACAO',
            estaAtivo: true
        }
    });

    return {
        tenantId: tenant.id,
        nomeAgente: agenteConfig?.nome || 'Assistente',
        genero: agenteConfig?.genero || 'feminino',
        nomeImobiliaria: tenant.nome,
        cidade: tenant.cidade || 'Goiânia',
        diferenciais: (tenant.diferenciais as string[]) || [], // Cast JSON
        comissaoPadrao: (tenant.perfilVenda as any)?.comissaoPadrao || '6%',
        regrasNegocio: (agenteConfig?.regrasNegocio as any) || {}
    };
}

export async function processarMensagemOrquestrada(
    mensagens: { role: 'user' | 'assistant' | 'system'; content: string }[],
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa,
    profundidade: number,
    baseConhecimento?: string
): Promise<{ sucesso: boolean; resposta?: string; agenteUsado?: string; erro?: string }> {
    try {
        // 1. Definição do Agente via Factory (migração suave)
        const agenteConfig = AgentConfigFactory.createFromLegacy(config, contexto);

        // 2. Build do Agente
        const agente = await agentBuilder.build(agenteConfig);

        // 3. Execução (Mockada por enquanto usando OpenAI direto se não tiver runner completo, 
        // mas vamos assumir que existe um runner ou chamada direta)
        // Como o AgentBuilder retorna um prompt e tools, precisamos executar isso.
        // Vou simular/simplificar usando uma chamada direta ao provider de IA se não tivermos um runner centralizado ainda.
        // Mas espere, o import original tinha 'run' de '@openai/agents'.

        console.log(`[Orquestrador] Executando agente: ${agente.id} (Subtipo: ${agente.subtipo})`);

        // INJEÇÃO RAG NO PROMPT DO SISTEMA
        let systemPrompt = agente.systemPrompt;

        // Prioridade: baseConhecimento passada explicitamente > briefing da campanha
        const ragContent = baseConhecimento || contexto.campanha?.briefingCompleto;

        if (ragContent) {
            systemPrompt += `\n\n# BASE DE CONHECIMENTO (RAG)\nUse estas informações para responder:\n${ragContent}`;
        }

        // Executar
        // Corrigindo assinatura: run(agent, messages, tools) based on "Expected 2-3 arguments" error
        // Executar
        // Corrigindo uso: Instanciar Agent class e passar para run
        // BYOK: Buscar modelo do tenant (se configurado)
        let modelToUse = 'gpt-4o';  // Default
        try {
            const llmConfig = await llmProviderFactory.getProviderForTenant(config.tenantId);
            modelToUse = llmConfig.modelString;
            console.log(`[Orquestrador] 🌐 Usando modelo BYOK: ${modelToUse}`);
        } catch (e) {
            console.log('[Orquestrador] ⚠️ Sem config BYOK, usando modelo padrão');
        }

        const agentInstance = new Agent({
            instructions: systemPrompt,
            name: agenteConfig.parametrosGlobais.nomeAgente || 'Agent',
            model: modelToUse,  // Agora dinâmico via BYOK!
            tools: agente.tools
        });

        // Preparar input para o SDK - usar formato simplificado (string)
        // O SDK @openai/agents aceita string direta como input para mensagens simples
        const ultimaMensagem = mensagens[mensagens.length - 1];
        const inputString = typeof ultimaMensagem.content === 'string'
            ? ultimaMensagem.content
            : JSON.stringify(ultimaMensagem.content);

        console.log(`[Orquestrador] Input para SDK: "${inputString.substring(0, 50)}..."`);

        const resposta = await run(
            agentInstance,
            inputString  // SDK aceita string simples como input
        ) as any;

        // Extrair texto da resposta
        // Extrair texto da resposta com estratégia robusta
        let textoResposta = '';

        // Estratégia 1: Output direto do passo final (Baseado no dump fornecido)
        if (resposta?.state?.currentStep?.output) {
            textoResposta = resposta.state.currentStep.output;
        }
        // Estratégia 2: Histórico de mensagens do modelo (Canonical)
        else if (resposta?.state?.modelResponses?.length > 0) {
            const lastResponse = resposta.state.modelResponses[resposta.state.modelResponses.length - 1];
            // Tentar extrair de content[0].text ou output[0].content
            if (lastResponse.output?.[0]?.content?.[0]?.text) {
                textoResposta = lastResponse.output[0].content[0].text;
            } else if (typeof lastResponse.output === 'string') {
                textoResposta = lastResponse.output;
            }
        }
        // Estratégia 3: Formato legado de mensagens
        else if (resposta?.messages?.length > 0) {
            textoResposta = resposta.messages[resposta.messages.length - 1].content;
        }

        // Estratégia 4: BUSCA PROFUNDA (Deep Search) - Último recurso
        if (!textoResposta) {
            console.log('[Orquestrador] ⚠️ Iniciando Deep Search para encontrar resposta...');
            textoResposta = deepSearchResponse(resposta) || '';
            if (textoResposta) console.log('[Orquestrador] ✅ Resposta encontrada via Deep Search');
        }

        // Fallback: Se ainda estiver vazio ou for objeto, tenta stringificar de forma segura
        if (!textoResposta || typeof textoResposta !== 'string') {
            const dump = JSON.stringify(resposta);
            console.warn('[Orquestrador] ⚠️ Falha na extração. Dump:', dump.substring(0, 200));
            // Evitar enviar JSON bruto para o usuário. Tentar mensagem genérica se falhar tudo.
            if (dump.includes('currentStep')) { // Se parece ser um state object mas falhamos em parsear
                textoResposta = "Desculpe, processei sua mensagem mas tive um erro interno ao gerar a resposta. Pode tentar novamente?";
            } else {
                textoResposta = dump; // Último recurso: retorna o que tiver
            }
        }

        return {
            sucesso: true,
            resposta: typeof textoResposta === 'string' ? textoResposta : JSON.stringify(textoResposta),
            agenteUsado: agente.id
        };

    } catch (error: any) {
        console.error('[Orquestrador] Erro de execução:', error);
        return { sucesso: false, erro: error.message };
    }
}

export async function buscarContextoConversa(
    telefone: string,
    tenantId: string
): Promise<ContextoConversa> {
    try {
        // Buscar lead existente pelo telefone
        const lead = await prisma.lead.findFirst({
            where: {
                telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                tenantId
            },
            select: {
                id: true,
                status: true,
                doresIdentificadas: true,
                tipoAutorizacao: true,
                comissaoAcordada: true,
                prazoTrabalho: true,
                campanhaOrigem: {
                    select: {
                        tipo: true,
                        nomeEmpreendimento: true,
                        briefingCompleto: true
                    }
                }
            }
        });

        // Buscar contato se não tem lead
        let contatoId: string | undefined;
        let campanhaContato: any = undefined;

        if (!lead) {
            const contato = await prisma.contato.findFirst({
                where: {
                    telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                    campanha: { tenantId }
                },
                select: {
                    id: true,
                    campanha: {
                        select: {
                            tipo: true,
                            nomeEmpreendimento: true,
                            briefingCompleto: true
                        }
                    }
                }
            });
            contatoId = contato?.id;
            campanhaContato = contato?.campanha;
        }

        return {
            telefone,
            contatoId,
            leadId: lead?.id,
            statusLead: lead?.status,
            doresIdentificadas: lead?.doresIdentificadas || [],
            empreendimento: lead?.campanhaOrigem?.nomeEmpreendimento || campanhaContato?.nomeEmpreendimento || undefined,
            campanha: lead?.campanhaOrigem || campanhaContato || undefined
        };

    } catch (error) {
        console.error('[ORCHESTRATOR] Erro ao buscar contexto:', error);
        return { telefone };
    }
}



// ====================================
// LEGADO (MANTIDO PARA COMPATIBILIDADE)
// ====================================

export enum TipoAgente {
    OPENER = 'OPENER',
    PRESENTER = 'PRESENTER',
    CLOSER = 'CLOSER'
}

export async function determinarAgente(contexto: ContextoConversa): Promise<TipoAgente> {
    return TipoAgente.OPENER; // Stub
}

export async function criarAgente(tipo: TipoAgente, config: ConfiguracaoOrquestrador) {
    return null; // Stub
}

/**
 * Busca recursiva por uma string de resposta válida em chaves comuns
 */
function deepSearchResponse(obj: any, depth = 0): string | null {
    if (!obj || depth > 20) return null;

    // IMPORTANTE: Não retornar string direto aqui, pois captura valores de chaves irrelevantes (ex: name: "Assistente")
    // A string só deve ser retornada se vier de uma chave TARGET validada abaixo.

    const targetKeys = ['output', 'text', 'content', 'value'];

    // 1. Tentar encontrar string direta nas chaves alvo
    for (const key of targetKeys) {
        if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 2) {
            if (!obj[key].trim().startsWith('{') && !obj[key].includes('schemaVersion')) {
                return obj[key];
            }
        }
    }

    // 2. Busca recursiva
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const found = deepSearchResponse(item, depth + 1);
            if (found) return found;
        }
    } else if (typeof obj === 'object') {
        const keys = Object.keys(obj).sort((a, b) => {
            const scoreA = targetKeys.includes(a) ? 1 : 0;
            const scoreB = targetKeys.includes(b) ? 1 : 0;
            return scoreB - scoreA;
        });

        for (const key of keys) {
            // Ignorar metadados e identificadores que podem conter strings curtas
            if (['usage', 'inputTokensDetails', 'providerData', 'originalInput', 'instructions', 'name', 'role', 'id', 'type', 'refusal'].includes(key)) continue;

            // BLACKLIST DE CONTEÚDO: Ignorar strings que são nomes de roles ou sistema
            const val = obj[key];
            if (typeof val === 'string') {
                const lower = val.toLowerCase().trim();
                if (['assistente', 'assistant', 'system', 'user', 'function'].includes(lower)) continue;
            }

            const found = deepSearchResponse(obj[key], depth + 1);
            if (found) return found;
        }
    }
    return null;
}




