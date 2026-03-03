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

    // Admin-specific
    tipoAutorizacao?: string;
    comissaoAcordada?: string;
    prazoTrabalho?: number;

    // Banco de dados (injeção de dependência)
    prisma: PrismaClient;
}
