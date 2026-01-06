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

export function detectarComprador(mensagem: string): boolean {
    const msgLower = mensagem.toLowerCase();

    return GATILHOS_COMPRADOR.some(gatilho => msgLower.includes(gatilho));
}

// ====================================
// VERIFICAÇÃO DE HORÁRIO COMERCIAL
// ====================================

export async function verificarHorarioComercial(tenantId: string): Promise<{ permitido: boolean; horarioRetorno?: string }> {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                expedienteSemanal: true,
                horarioAtendimento: true,
                atendeFinalDeSemana: true
            }
        });

        if (!tenant) {
            return { permitido: true }; // Fallback: permite se não encontrar config
        }

        const agora = new Date();
        const diaSemana = agora.getDay(); // 0 = Domingo, 6 = Sábado
        const horaAtual = agora.getHours();
        const minutoAtual = agora.getMinutes();
        const horaDecimal = horaAtual + (minutoAtual / 60);

        // Se tiver expediente semanal configurado (formato JSON)
        if (tenant.expedienteSemanal) {
            const config = tenant.expedienteSemanal as any;
            const diaConfig = config.dias?.find((d: any) => d.diaSemana === diaSemana);

            if (!diaConfig || !diaConfig.ativo) {
                return {
                    permitido: false,
                    horarioRetorno: 'amanhã às 8h'
                };
            }

            // Verificar horário
            const [inicioH, inicioM] = diaConfig.inicio.split(':').map(Number);
            const [fimH, fimM] = diaConfig.fim.split(':').map(Number);
            const inicioDecimal = inicioH + (inicioM / 60);
            const fimDecimal = fimH + (fimM / 60);

            // Verificar se está no horário de almoço
            if (config.almocoInicio && config.almocoFim) {
                const [almocoInicioH, almocoInicioM] = config.almocoInicio.split(':').map(Number);
                const [almocoFimH, almocoFimM] = config.almocoFim.split(':').map(Number);
                const almocoInicioDecimal = almocoInicioH + (almocoInicioM / 60);
                const almocoFimDecimal = almocoFimH + (almocoFimM / 60);

                if (horaDecimal >= almocoInicioDecimal && horaDecimal < almocoFimDecimal) {
                    return {
                        permitido: false,
                        horarioRetorno: `às ${config.almocoFim}`
                    };
                }
            }

            if (horaDecimal < inicioDecimal || horaDecimal >= fimDecimal) {
                return {
                    permitido: false,
                    horarioRetorno: horaDecimal < inicioDecimal ? `às ${diaConfig.inicio}` : 'amanhã às 8h'
                };
            }

            return { permitido: true };
        }

        // Fallback: usar horarioAtendimento simples (ex: "08:00 às 18:00")
        const horarioSimples = tenant.horarioAtendimento || '08:00 às 18:00';
        const match = horarioSimples.match(/(\d{1,2}):(\d{2})\s*[àa]s?\s*(\d{1,2}):(\d{2})/i);

        if (match) {
            const inicioDecimal = parseInt(match[1]) + (parseInt(match[2]) / 60);
            const fimDecimal = parseInt(match[3]) + (parseInt(match[4]) / 60);

            // Verificar fim de semana
            if ((diaSemana === 0 || diaSemana === 6) && !tenant.atendeFinalDeSemana) {
                return {
                    permitido: false,
                    horarioRetorno: 'segunda-feira às 8h'
                };
            }

            if (horaDecimal < inicioDecimal || horaDecimal >= fimDecimal) {
                return {
                    permitido: false,
                    horarioRetorno: horaDecimal < inicioDecimal ? `às ${match[1]}:${match[2]}` : 'amanhã às 8h'
                };
            }
        }

        return { permitido: true };

    } catch (error) {
        console.error('[GUARDRAIL] Erro ao verificar horário:', error);
        return { permitido: true }; // Fallback: permite em caso de erro
    }
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
    'não tenho interesse',
    'para de mandar',
    'bloqueia',
    'denunciar spam'
];

export function detectarOptout(mensagem: string): boolean {
    const msgLower = mensagem.toLowerCase();

    return GATILHOS_OPTOUT.some(gatilho => msgLower.includes(gatilho));
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
        console.error('[GUARDRAIL] Erro ao verificar blacklist:', error);
        return false;
    }
}

// ====================================
// ANTI-SPAM / ANTI-FLOOD
// ====================================

const recentMessages: Map<string, number[]> = new Map();

export function verificarSpam(telefone: string, intervaloMs: number = 30000): boolean {
    const agora = Date.now();
    const mensagensRecentes = recentMessages.get(telefone) || [];

    // Limpar mensagens antigas (> 5 minutos)
    const mensagensFiltradas = mensagensRecentes.filter(ts => agora - ts < 300000);

    // Verificar se tem muitas mensagens em intervalo curto
    const mensagensNoIntervalo = mensagensFiltradas.filter(ts => agora - ts < intervaloMs);

    // Atualizar mapa
    mensagensFiltradas.push(agora);
    recentMessages.set(telefone, mensagensFiltradas);

    // Se mais de 3 mensagens no intervalo, é spam
    return mensagensNoIntervalo.length > 3;
}

// ====================================
// GUARDRAIL PRINCIPAL
// ====================================

export async function executarGuardrails(ctx: MensagemContext): Promise<GuardrailResult> {
    console.log(`[GUARDRAIL] Verificando mensagem de ${ctx.telefone}`);

    // 1. Verificar Blacklist
    const bloqueado = await verificarBlacklist(ctx.telefone, ctx.tenantId);
    if (bloqueado) {
        console.log(`[GUARDRAIL] ❌ Telefone bloqueado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'BLOQUEADO',
            acao: 'IGNORAR'
        };
    }

    // 2. Verificar Spam/Flood
    const isSpam = verificarSpam(ctx.telefone);
    if (isSpam) {
        console.log(`[GUARDRAIL] ⚠️ Spam detectado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'SPAM',
            acao: 'IGNORAR'
        };
    }

    // 3. Verificar Opt-out
    const isOptout = detectarOptout(ctx.conteudo);
    if (isOptout) {
        console.log(`[GUARDRAIL] 🚫 Opt-out detectado: ${ctx.telefone}`);
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
        console.log(`[GUARDRAIL] 🛒 Comprador detectado: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'COMPRADOR',
            mensagemFallback: 'Que legal que você está interessado em comprar/alugar um imóvel! 🏠 Vou passar seu contato para um dos nossos corretores especialistas em vendas. Ele entrará em contato em breve para te ajudar a encontrar o imóvel perfeito!',
            acao: 'ENCAMINHAR_CORRETOR'
        };
    }

    // 5. Verificar Horário Comercial (DESATIVADO - Agente deve atender 24/7)
    // O horário só deve restringir agendamentos, o que será validado pela tool agendar_avaliacao
    /* 
    const horario = await verificarHorarioComercial(ctx.tenantId);
    if (!horario.permitido) {
        console.log(`[GUARDRAIL] 🕐 Fora do horário: ${ctx.telefone}`);
        return {
            permitido: false,
            tipo: 'FORA_HORARIO',
            mensagemFallback: `Olá! 😊 Estamos fora do horário de atendimento no momento. Retornaremos ${horario.horarioRetorno}. Sua mensagem foi registrada e responderemos assim que possível!`,
            acao: 'AGENDAR_RETORNO'
        };
    }
    */

    // ✅ Todas as verificações passaram
    console.log(`[GUARDRAIL] ✅ Mensagem liberada: ${ctx.telefone}`);
    return {
        permitido: true
    };
}
