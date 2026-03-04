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

        // RAG do perfil: prioriza o do agente (mais completo), fallback para o do tenant
        const ragPerfilTexto = (agente as any)?.ragPerfilTexto || (tenant as any).ragPerfilTexto || undefined;

        // BYOK: descriptografar API Key do tenant, se configurada
        let llmApiKey: string | undefined;
        if ((tenant as any).llmApiKeyCriptografada) {
            try {
                llmApiKey = descriptografar((tenant as any).llmApiKeyCriptografada);
            } catch {
                console.warn('[ORCHESTRATOR] ⚠️ Falha ao descriptografar llmApiKey do tenant — usando padrão');
            }
        }

        return {
            tenantId,
            nomeAgente: agente?.nome || 'Sofia',
            genero: agente?.genero || 'feminino',
            nomeImobiliaria: tenant.nome,
            cidade: tenant.cidade || undefined,
            diferenciais: diferenciais.length > 0 ? diferenciais : undefined,
            comissaoPadrao: perfilVenda.comissaoPadrao ? `${perfilVenda.comissaoPadrao}%`.replace('%%', '%') : '5%',
            prazoContrato: perfilVenda.prazoContrato ? Number(perfilVenda.prazoContrato) : 180,
            ragPerfilTexto,
            llmModelo: (tenant as any).llmModelo || undefined,
            llmBaseUrl: (tenant as any).llmBaseUrl || undefined,
            llmApiKey,
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
