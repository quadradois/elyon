/**
 * Resolvedor de Instância WhatsApp Multi-Tenant
 * 
 * Busca a instância WhatsApp correta baseada no Tenant (e opcionalmente Campanha).
 * Elimina a dependência de variáveis de ambiente globais.
 */

import { prisma } from '../lib/db';

interface ResolucaoInstancia {
    instanceName: string;
    sessaoId?: string;
    fonte: 'banco' | 'campanha' | 'env_fallback';
}

/**
 * Resolve a instância WhatsApp para um Tenant.
 * 
 * Ordem de prioridade:
 * 1. Campanha específica (se campanhaId fornecido e campanha tem sessão vinculada)
 * 2. Sessão ativa do Tenant (primeira encontrada com status CONECTADO)
 * 3. Qualquer sessão do Tenant (fallback)
 * 4. Variável de ambiente (último recurso)
 */
export async function resolverInstanciaWhatsapp(
    tenantId: string,
    campanhaId?: string
): Promise<ResolucaoInstancia> {

    // 1. Se campanhaId fornecido, verificar se campanha tem sessão vinculada
    // (Futuro: Implementar campo sessaoWhatsappId na Campanha)

    // 2. Buscar sessão ativa do Tenant
    const sessaoAtiva = await prisma.sessaoWhatsapp.findFirst({
        where: {
            tenantId,
            status: 'CONECTADO'
        },
        select: {
            id: true,
            instanceName: true
        }
    });

    if (sessaoAtiva) {
        console.log(`[WhatsApp] Usando sessão ativa do banco: ${sessaoAtiva.instanceName}`);
        return {
            instanceName: sessaoAtiva.instanceName,
            sessaoId: sessaoAtiva.id,
            fonte: 'banco'
        };
    }

    // 3. Fallback: Qualquer sessão do Tenant (mesmo desconectada)
    const qualquerSessao = await prisma.sessaoWhatsapp.findFirst({
        where: { tenantId },
        select: {
            id: true,
            instanceName: true
        }
    });

    if (qualquerSessao) {
        console.log(`[WhatsApp] Usando sessão do banco (sem status ativo): ${qualquerSessao.instanceName}`);
        return {
            instanceName: qualquerSessao.instanceName,
            sessaoId: qualquerSessao.id,
            fonte: 'banco'
        };
    }

    // 4. Último recurso: Variável de ambiente global
    const envInstance = process.env.EVOLUTION_INSTANCE_NAME || 'elyon_main';
    console.warn(`[WhatsApp] ATENÇÃO: Nenhuma sessão encontrada para tenant ${tenantId}. Usando fallback: ${envInstance}`);

    return {
        instanceName: envInstance,
        fonte: 'env_fallback'
    };
}

/**
 * Versão simplificada para uso rápido (retorna apenas o nome)
 */
export async function getInstanceName(tenantId: string): Promise<string> {
    const resolucao = await resolverInstanciaWhatsapp(tenantId);
    return resolucao.instanceName;
}
