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
        const diferenciais = resolverDiferenciais(tenant.diferenciais as string[] || []);

        const perfilVenda = (tenant.perfilVenda as Record<string, unknown>) || {};

        // RAG do perfil: prioriza o do agente (mais completo), fallback para o do tenant
        const ragPerfilTexto = agente?.ragPerfilTexto || tenant.ragPerfilTexto || undefined;

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
        };

    } catch (error) {
        logger.warn({ err: error }, '[ORCHESTRATOR-QUERIES] Erro ao buscar configuração do tenant');
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
        logger.warn({ err: error }, '[ORCHESTRATOR-QUERIES] Erro ao buscar contexto da conversa');
        return { telefone };
    }
}
