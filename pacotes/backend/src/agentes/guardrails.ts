/**
 * GUARDRAILS - Sistema de 4 Agentes de Captação
 * 
 * Guardrails de entrada que verificam condições antes
 * de processar mensagens pelos agentes.
 * 
 * @version 1.0
 * @date 16/12/2025
 */

import { prisma } from '../lib/db';
import { getRedisClient } from '../lib/redis';
import { logger } from '../lib/logger';
import { normalizarTexto } from './conversation-state';

// ====================================
// TIPOS
// ====================================

export interface GuardrailResult {
    permitido: boolean;
    tipo?: 'COMPRADOR' | 'FORA_HORARIO' | 'OPTOUT' | 'SPAM' | 'BLOQUEADO';
    mensagemFallback?: string;
    acao?: 'ENCAMINHAR_CORRETOR' | 'AGENDAR_RETORNO' | 'IGNORAR' | 'REGISTRAR_OPTOUT';
}

export interface MensagemContext {
    telefone: string;
    conteudo: string;
    tenantId: string;
    contatoId?: string;
    leadId?: string;
    timestamp: Date;
}

// ====================================
// DETECÇÃO DE COMPRADOR (vs Proprietário)
// ====================================

const GATILHOS_COMPRADOR = [
    // Intenção de compra/locação como inquilino (APENAS INTENÇÃO CLARA)
    'quero comprar',
    'quero adquirir',
    'busco comprar',
    'estou comprando',
    'preciso comprar',
    'gostaria de comprar',

    'procuro um imóvel',
    'procuro apartamento',
    'procuro casa',

    'preciso alugar',
    'quero alugar um',
    'busco alugar',
    'estou procurando para comprar',
    'estou procurando para alugar',

    'tenho interesse em comprar',
    'tenho interesse em alugar'
];

// Pré-normalizado em module load (evita normalizarTexto em cada .some())
const GATILHOS_COMPRADOR_NORM = GATILHOS_COMPRADOR.map(g => normalizarTexto(g));

export function detectarComprador(mensagem: string): boolean {
    const msgLower = normalizarTexto(mensagem);

    return GATILHOS_COMPRADOR_NORM.some(gatilho => msgLower.includes(gatilho));
}

// ====================================
// DETECÇÃO DE OPT-OUT
// ====================================

const GATILHOS_OPTOUT = [
    'não me ligue mais',
    'não quero mais mensagem',
    'pare de me mandar',
    'não incomode',
    'saia da minha lista',
    'remova meu numero',
    'remove meu número',
    'para de mandar',
    'bloqueia',
    'denunciar spam'
];

// Pré-normalizado em module load
const GATILHOS_OPTOUT_NORM = GATILHOS_OPTOUT.map(g => normalizarTexto(g));

export function detectarOptout(mensagem: string): boolean {
    const msgNormalizado = normalizarTexto(mensagem);

    // Ambiguidade comum de contexto comercial (evita falso positivo)
    // Ex.: "não tenho interesse em comprar, quero vender meu apto"
    if (msgNormalizado.includes('nao tenho interesse')) {
        const contextoVendedor = /(vender|venda|meu imovel|meu apto|meu apartamento|captacao)/.test(msgNormalizado);
        if (!contextoVendedor) {
            return true;
        }
    }

    return GATILHOS_OPTOUT_NORM.some(gatilho => msgNormalizado.includes(gatilho));
}

// ====================================
// VERIFICAÇÃO DE BLACKLIST
// ====================================

export async function verificarBlacklist(telefone: string, tenantId: string): Promise<boolean> {
    try {
        const telefoneNormalizado = telefone.replace(/\D/g, '');

        const bloqueado = await prisma.telefoneBlacklist.findFirst({
            where: {
                telefone: { contains: telefoneNormalizado.slice(-11) },
                tenantId
            }
        });

        return !!bloqueado;
    } catch (error) {
        logger.warn({ err: error }, '[GUARDRAILS] Erro ao verificar blacklist');
        return false;
    }
}

// ====================================
// ANTI-SPAM / ANTI-FLOOD
// ====================================

const recentMessages: Map<string, number[]> = new Map();
let spamCleanupInterval: NodeJS.Timeout | null = null;

export async function verificarSpam(telefone: string, intervaloMs: number = 30000): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        const key = `spam:${telefone}`;
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.expire(key, Math.ceil(intervaloMs / 1000));
        }
        return count > 3;
    } catch (err) {
        // Fallback local: com limpeza para evitar vazamento (CR-02)
        if (!spamCleanupInterval) {
            spamCleanupInterval = setInterval(() => {
                const now = Date.now();
                for (const [k, v] of recentMessages.entries()) {
                    const valid = v.filter(ts => (now - ts) < 300000);
                    if (valid.length === 0) recentMessages.delete(k);
                    else recentMessages.set(k, valid);
                }
            }, 60000).unref();
        }

        const agora = Date.now();
        const mensagensRecentes = recentMessages.get(telefone) || [];
        // Filtra ativamente mensagens antigas
        const mensagensValidas = mensagensRecentes.filter(ts => agora - ts < intervaloMs);
        
        mensagensValidas.push(agora);
        recentMessages.set(telefone, mensagensValidas);

        return mensagensValidas.length > 3;
    }
}

// ====================================
// GUARDRAIL PRINCIPAL
// ====================================

export async function executarGuardrails(ctx: MensagemContext): Promise<GuardrailResult> {
    logger.debug(`[GUARDRAIL] Verificando mensagem de ${ctx.telefone}`);

    // 1. Verificar Blacklist
    const bloqueado = await verificarBlacklist(ctx.telefone, ctx.tenantId);
    if (bloqueado) {
        logger.debug(`[GUARDRAIL] ❌ Telefone bloqueado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'BLOQUEADO',
            acao: 'IGNORAR'
        };
    }

    // 2. Verificar Spam/Flood
    const isSpam = await verificarSpam(ctx.telefone);
    if (isSpam) {
        logger.debug(`[GUARDRAIL] ⚠️ Spam detectado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'SPAM',
            acao: 'IGNORAR'
        };
    }

    // 3. Verificar Opt-out
    const isOptout = detectarOptout(ctx.conteudo);
    if (isOptout) {
        logger.debug(`[GUARDRAIL] 🚫 Opt-out detectado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'OPTOUT',
            mensagemFallback: 'Entendido! Removemos seu número da nossa lista. Desculpe qualquer incômodo. 🙏',
            acao: 'REGISTRAR_OPTOUT'
        };
    }

    // 4. Verificar se é Comprador (não Proprietário)
    const isComprador = detectarComprador(ctx.conteudo);
    if (isComprador) {
        logger.debug(`[GUARDRAIL] 🛒 Comprador detectado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'COMPRADOR',
            mensagemFallback: 'Que legal que você está interessado em comprar/alugar um imóvel! 🏠 Vou passar seu contato para um dos nossos corretores especialistas em vendas. Ele entrará em contato em breve para te ajudar a encontrar o imóvel perfeito!',
            acao: 'ENCAMINHAR_CORRETOR'
        };
    }

    // ✅ Todas as verificações passaram
    logger.debug(`[GUARDRAIL] ✅ Mensagem liberada: ${ctx.telefone}`);
    return {
        permitido: true
    };
}
