/**
 * ORCHESTRATOR QUERIES — Consultas de BD para o orquestrador
 * 
 * Extraído do orchestrator.ts para separação de responsabilidades.
 * Contém as funções de busca de configuração e contexto do Prisma.
 * 
 * @version 1.0
 * @date 04/03/2026
 */

import { prisma } from '../lib/db';
import { descriptografar } from '../lib/crypto';
import type { ConfiguracaoOrquestrador, ContextoConversa } from './orchestrator';
import { logger } from '../lib/logger';
import {
    resolverComissaoPadrao,
    resolverDiferenciais,
    resolverPrazoContrato
} from './commercial-policy';

function normalizarPoliticaContratoNoRag(texto?: string | null): string | undefined {
    if (!texto) return undefined;

    let normalizado = texto;

    // Remove construções antigas que induzem "dois modelos" / "contrato simples".
    normalizado = normalizado.replace(
        /- Oferecemos a opção de contrato exclusivo \(prazo padrão: 180 dias\)\.\s*/gi,
        ''
    );
    normalizado = normalizado.replace(
        /- A exclusividade é opcional, mas garante maior dedicação e melhores resultados\.\s*/gi,
        ''
    );
    normalizado = normalizado.replace(
        /- Também trabalhamos com imóveis sem exclusividade\.\s*/gi,
        ''
    );

    if (!/REGRA DE COMUNICAÇÃO SOBRE CONTRATO/i.test(normalizado)) {
        normalizado += `\n- ⚠️ REGRA DE COMUNICAÇÃO SOBRE CONTRATO: NUNCA use o termo "contrato simples" e NUNCA apresente "duas opções de contrato". Use "autorização de venda" e explique que os detalhes de formato/prazo/rescisão são alinhados no atendimento consultivo com o especialista.\n`;
    }

    return normalizado;
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
        const tenantVersion = ((tenant as any).atualizadoEm || (tenant as any).updatedAt || '').toString();
        const agenteVersion = agente ? (((agente as any).atualizadoEm || (agente as any).updatedAt || '').toString()) : '';
        const configVersionToken = `${tenantVersion}|${agenteVersion}|${tenant.llmModelo || ''}|${tenant.llmBaseUrl || ''}`;
        const diferenciais = resolverDiferenciais(tenant.diferenciais as string[] || []);

        const perfilVenda = (tenant.perfilVenda as Record<string, unknown>) || {};

        // RAG do perfil: prioriza o do agente (mais completo), fallback para o do tenant
        const ragPerfilTexto = normalizarPoliticaContratoNoRag(
            agente?.ragPerfilTexto || tenant.ragPerfilTexto || undefined
        );

        // BYOK: descriptografar API Key do tenant, se configurada (Para retrocompatibilidade no context-builder)
        let llmApiKey: string | undefined;
        if (tenant.llmApiKeyCriptografada) {
            try {
                llmApiKey = descriptografar(tenant.llmApiKeyCriptografada);
            } catch {
                logger.warn('[ORCHESTRATOR] ⚠️ Falha ao descriptografar llmApiKey do tenant — usando padrão');
            }
        }

        return {
            tenantId,
            nomeAgente: agente?.nome || 'Sofia',
            genero: agente?.genero || 'feminino',
            nomeImobiliaria: tenant.nome || 'Imobiliária',
            cidade: tenant.cidade || undefined,
            diferenciais,
            comissaoPadrao: resolverComissaoPadrao(perfilVenda.comissaoPadrao as string | number | null | undefined),
            prazoContrato: resolverPrazoContrato(perfilVenda.prazoContrato as string | number | null | undefined),
            ragPerfilTexto,

            // Retrocompatibilidade de chaves prontas para as chains antigas
            llmApiKey,

            // BYOK Pass-through (para byok-resolver)
            llmProvedor: tenant.llmProvedor,
            llmModelo: tenant.llmModelo,
            llmApiKeyCriptografada: tenant.llmApiKeyCriptografada,
            llmBaseUrl: tenant.llmBaseUrl,
            configVersionToken,
        };

    } catch (error) {
        logger.warn({ err: error }, '[ORCHESTRATOR-QUERIES] Erro ao buscar configuração do tenant');
        return null;
    }
}

// ====================================
// RESOLVER LEAD ID CANÔNICO (tenant-safe)
// ====================================

/**
 * Resolve o Lead.id canônico para um telefone dentro de um tenant.
 * 
 * Regras:
 * 1. Busca Lead por telefone normalizado no tenant, SEM filtrar por statusProspeccao.
 * 2. Se exatamente 1 Lead → retorna Lead.id.
 * 3. Se múltiplos Leads → falha fechada (ambiguidade).
 * 4. Se nenhum Lead → falha fechada, sem consultar identidade legada de Contato.
 * 5. É PROIBIDO criar Lead silenciosamente.
 */
export async function resolverLeadIdCanonico(
    telefone: string,
    tenantId: string
): Promise<string | null> {
    const digitos = telefone.replace(/\D/g, '');
    const telefoneNacional = digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)
        ? digitos.slice(2)
        : digitos;

    if (telefoneNacional.length !== 10 && telefoneNacional.length !== 11) {
        logger.warn({ tamanho: telefoneNacional.length }, '[ORCHESTRATOR-QUERIES] Telefone brasileiro invalido para resolucao canonica');
        return null;
    }

    const variantes = new Set<string>([telefoneNacional]);
    if (telefoneNacional.length === 10) {
        variantes.add(`${telefoneNacional.slice(0, 2)}9${telefoneNacional.slice(2)}`);
    } else if (telefoneNacional[2] === '9') {
        variantes.add(`${telefoneNacional.slice(0, 2)}${telefoneNacional.slice(3)}`);
    }

    const telefones = [...variantes];
    const camposTelefone = ['telefone', 'telefone2', 'telefone3', 'telefone4', 'telefone5'] as const;
    const filtrosTelefone = camposTelefone.flatMap((campo) =>
        telefones.map((numero) => ({ [campo]: { contains: numero } }))
    );

    // 1. Buscar Leads por telefone no tenant (independente de statusProspeccao)
    const leads = await prisma.lead.findMany({
        where: {
            tenantId,
            OR: filtrosTelefone,
        },
        select: { id: true },
    });

    if (leads.length === 1) {
        return leads[0].id;
    }

    if (leads.length > 1) {
        // Ambiguidade: múltiplos Leads para o mesmo telefone no mesmo tenant
        logger.warn({
            tenantId,
            count: leads.length,
        }, '[ORCHESTRATOR-QUERIES] Ambiguidade: múltiplos Leads para telefone no tenant — falha fechada');
        return null;
    }

    return null;
}

// ====================================
// BUSCAR CONTEXTO DA CONVERSA
// ====================================

export async function buscarContextoConversa(
    telefone: string,
    tenantId: string,
    leadIdResolvido?: string
): Promise<ContextoConversa> {
    try {
        // Se leadId já foi resolvido pelo resolvedor canônico, usar ele
        let leadId: string | undefined = leadIdResolvido;
        let lead: any = null;

        if (leadId) {
            lead = await prisma.lead.findFirst({
                where: { id: leadId, tenantId },
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
        } else {
            // Fallback para compatibilidade com callers legados (ex: testes)
            lead = await prisma.lead.findFirst({
                where: {
                    telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                    tenantId,
                    statusProspeccao: null
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
        }

        // Buscar lead de prospecção se não tem lead CRM (compatibilidade legada)
        let contatoId: string | undefined;
        if (!lead && !leadId) {
            const leadProspeccao = await prisma.lead.findFirst({
                where: {
                    telefone: { contains: telefone.replace(/\D/g, '').slice(-11) },
                    tenantId,
                    statusProspeccao: { not: null }
                },
                select: { id: true }
            });
            contatoId = leadProspeccao?.id;
        }

        return {
            telefone,
            contatoId,
            leadId: lead?.id ?? leadId,
            statusLead: lead?.status,
            doresIdentificadas: lead?.doresIdentificadas || [],
            empreendimento: lead?.campanhaOrigem?.nomeEmpreendimento || undefined,
            tipoAutorizacao: lead?.tipoAutorizacao || undefined,
            comissaoAcordada: lead?.comissaoAcordada || undefined,
            prazoTrabalho: lead?.prazoTrabalho || undefined
        };

    } catch (error) {
        logger.warn({ err: error }, '[ORCHESTRATOR-QUERIES] Erro ao buscar contexto da conversa');
        return { telefone };
    }
}
