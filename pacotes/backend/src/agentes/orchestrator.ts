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
import { criarOpenerAgent } from './opener-agent';
import { criarPresenterAgent } from './presenter-agent';
import { criarCloserAgent } from './closer-agent';
import { criarAdminAgent } from './admin-agent';

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
}

export interface ResultadoProcessamento {
    sucesso: boolean;
    resposta?: string;
    agenteUsado?: string;
    guardrailAcionado?: GuardrailResult;
    erro?: string;
}

// ====================================
// MAPEAMENTO STATUS → AGENTE
// ====================================

type TipoAgente = 'OPENER' | 'PRESENTER' | 'CLOSER' | 'ADMIN';

function determinarAgente(statusLead?: string): TipoAgente {
    if (!statusLead) return 'OPENER';

    const mapa: Record<string, TipoAgente> = {
        // Fase 1
        'NOVO': 'OPENER',
        'QUALIFICADO': 'OPENER',

        // Fase 2
        'TENTATIVA_AGENDAMENTO': 'PRESENTER',
        'VISITA_AGENDADA': 'PRESENTER',
        'CONTATANDO': 'PRESENTER',

        // Fase 3
        'AVALIACAO_EM_ANDAMENTO': 'CLOSER',
        'DOCUMENTACAO': 'CLOSER',
        'EM_NEGOCIACAO': 'CLOSER',

        // Fase 4
        'ONBOARDING': 'ADMIN'
    };

    return mapa[statusLead] || 'OPENER';
}

// ====================================
// CRIAR AGENTE POR TIPO
// ====================================

function criarAgente(
    tipo: TipoAgente,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa
): Agent {
    const baseConfig = {
        nomeAgente: config.nomeAgente,
        genero: config.genero,
        nomeImobiliaria: config.nomeImobiliaria
    };

    switch (tipo) {
        case 'OPENER':
            return criarOpenerAgent({
                ...baseConfig,
                cidade: config.cidade,
                empreendimento: contexto.empreendimento
            });

        case 'PRESENTER':
            return criarPresenterAgent({
                ...baseConfig,
                diferenciais: config.diferenciais,
                situacaoAtual: contexto.situacaoAtual || undefined // Vem do OPENER (tem_corretor, sozinho, etc)
            });

        case 'CLOSER':
            return criarCloserAgent({
                ...baseConfig,
                comissaoPadrao: config.comissaoPadrao,
                prazoContrato: config.prazoContrato,
                doresIdentificadas: contexto.doresIdentificadas,
                diferenciais: config.diferenciais
            });

        case 'ADMIN':
            return criarAdminAgent({
                ...baseConfig,
                tipoAutorizacao: contexto.tipoAutorizacao,
                comissaoAcordada: contexto.comissaoAcordada,
                prazoTrabalho: contexto.prazoTrabalho
            });

        default:
            return criarOpenerAgent(baseConfig);
    }
}

// ====================================
// PROCESSAR MENSAGEM
// ====================================

export async function processarMensagemOrquestrada(
    mensagens: Array<{ role: 'user' | 'assistant'; content: string }>,
    config: ConfiguracaoOrquestrador,
    contexto: ContextoConversa,
    profundidade: number = 0
): Promise<ResultadoProcessamento> {
    try {
        // Evitar loops infinitos
        if (profundidade > 2) {
            console.log('[ORCHESTRATOR] 🛑 Limite de profundidade de handoff atingido');
            return { sucesso: false, erro: 'Loop de handoff detectado' };
        }

        console.log(`[ORCHESTRATOR] Processando mensagem para ${contexto.telefone} (Tentativa ${profundidade + 1})`);

        // 1. EXECUTAR GUARDRAILS (Apenas na primeira passada)
        if (profundidade === 0) {
            const ultimaMensagem = mensagens.filter(m => m.role === 'user').pop();
            if (ultimaMensagem) {
                const guardrailCtx: MensagemContext = {
                    telefone: contexto.telefone,
                    conteudo: ultimaMensagem.content,
                    tenantId: config.tenantId,
                    contatoId: contexto.contatoId,
                    leadId: contexto.leadId,
                    timestamp: new Date()
                };

                const guardrailResult = await executarGuardrails(guardrailCtx);

                if (!guardrailResult.permitido) {
                    console.log(`[ORCHESTRATOR] Guardrail acionado: ${guardrailResult.tipo}`);
                    return {
                        sucesso: true,
                        resposta: guardrailResult.mensagemFallback,
                        guardrailAcionado: guardrailResult
                    };
                }
            }
        }

        // 2. DETERMINAR AGENTE BASEADO NO STATUS
        const tipoAgente = determinarAgente(contexto.statusLead);
        console.log(`[ORCHESTRATOR] Agente selecionado: ${tipoAgente} (status: ${contexto.statusLead || 'sem lead'})`);

        // 3. CRIAR AGENTE
        const agente = criarAgente(tipoAgente, config, contexto);

        // 4. PREPARAR INPUT
        const historicoFormatado = mensagens
            .map(m => `${m.role === 'user' ? 'PROPRIETÁRIO' : 'VOCÊ'}: ${m.content}`)
            .join('\n');

        let inputCompleto = `HISTÓRICO DA CONVERSA:
${historicoFormatado}

CONTEXTO DO LEAD:
- ID: ${contexto.leadId || contexto.contatoId || 'N/A'}
- Status: ${contexto.statusLead || 'Novo contato'}
- Dores: ${contexto.doresIdentificadas?.join(', ') || 'Não identificadas'}

Responda à última mensagem do proprietário.`;

        // Se for um handoff (profundidade > 0), instruir o agente a se apresentar
        if (profundidade > 0) {
            inputCompleto += `\n\nATENÇÃO: Você acabou de assumir a conversa após uma transição de fase. Continue o fluxo como se fosse a mesma pessoa. NÃO se apresente novamente.`;
        }

        // 5. EXECUTAR AGENTE
        const result = await run(agente, inputCompleto);

        // 6. VERIFICAR SE HOUVE MUDANÇA DE FASE (HANDOFF)
        // Revalidar status no banco para ver se mudou durante a execução
        let novoStatus = contexto.statusLead;
        if (contexto.leadId) {
            const leadAtualizado = await prisma.lead.findUnique({
                where: { id: contexto.leadId }, select: { status: true }
            });
            novoStatus = leadAtualizado?.status || novoStatus;
        }

        // Se o status mudou E o agente mudou, fazer handoff silencioso
        const novoTipoAgente = determinarAgente(novoStatus);
        if (novoTipoAgente !== tipoAgente) {
            console.log(`[ORCHESTRATOR] 🔄 Handoff Detectado: ${tipoAgente} -> ${novoTipoAgente}`);

            // Recursão: Chamar o próximo agente IMEDIATAMENTE
            return processarMensagemOrquestrada(
                mensagens, // Mantém histórico original
                config,
                { ...contexto, statusLead: novoStatus }, // Atualiza status
                profundidade + 1
            );
        }

        // Extrair resposta normal
        const respostaFinal = typeof result.finalOutput === 'string'
            ? result.finalOutput
            : JSON.stringify(result.finalOutput);

        console.log(`[ORCHESTRATOR] Resposta gerada pelo ${tipoAgente}`);

        return {
            sucesso: true,
            resposta: respostaFinal,
            agenteUsado: tipoAgente
        };

    } catch (error: any) {
        console.error(`[ORCHESTRATOR] Erro:`, error);
        return {
            sucesso: false,
            erro: error.message || 'Erro desconhecido no orquestrador'
        };
    }
}

// ====================================
// BUSCAR CONFIGURAÇÃO DO TENANT
// ====================================

export async function buscarConfiguracaoTenant(tenantId: string): Promise<ConfiguracaoOrquestrador | null> {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                agentes: {
                    where: { estaAtivo: true },
                    take: 1
                }
            }
        });

        if (!tenant) return null;

        const agente = tenant.agentes[0];
        const diferenciais = tenant.diferenciais as string[] || [];

        const perfilVenda = tenant.perfilVenda as any || {};

        return {
            tenantId,
            nomeAgente: agente?.nome || 'Sofia',
            genero: agente?.genero || 'feminino',
            nomeImobiliaria: tenant.nome,
            cidade: tenant.cidade || undefined,
            diferenciais: diferenciais.length > 0 ? diferenciais : undefined,
            comissaoPadrao: perfilVenda.comissaoPadrao || '6%',
            prazoContrato: perfilVenda.prazoContrato ? Number(perfilVenda.prazoContrato) : 90
        };

    } catch (error) {
        console.error('[ORCHESTRATOR] Erro ao buscar config:', error);
        return null;
    }
}

// ====================================
// BUSCAR CONTEXTO DA CONVERSA
// ====================================

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
                    select: { nomeEmpreendimento: true }
                }
            }
        });

        // Buscar contato se não tem lead
        let contatoId: string | undefined;
        if (!lead) {
            const contato = await prisma.contato.findFirst({
                where: {
                    telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                    campanha: { tenantId }
                },
                select: { id: true }
            });
            contatoId = contato?.id;
        }

        return {
            telefone,
            contatoId,
            leadId: lead?.id,
            statusLead: lead?.status,
            doresIdentificadas: lead?.doresIdentificadas || [],
            empreendimento: lead?.campanhaOrigem?.nomeEmpreendimento || undefined
        };

    } catch (error) {
        console.error('[ORCHESTRATOR] Erro ao buscar contexto:', error);
        return { telefone };
    }
}

// ====================================
// EXPORTAR
// ====================================

export {
    determinarAgente,
    criarAgente,
    TipoAgente
};
