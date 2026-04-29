/**
 * JOB DE REENVIO DE LEADS COM FALHA NO CRM
 *
 * Varre leads com crmSyncStatus='failed' e tenta reenviar com backoff.
 * Deve ser executado a cada 30 min via cron ou agendador.
 *
 * Limita a 20 reenvios por execução para evitar flood no CRM externo.
 */

import { prisma } from '../lib/db';
import { reenviarParaCrm } from '../servicos/crm-service';

const LIMITE_POR_EXECUCAO = 20;
// Só retentar após pelo menos 10 min da última tentativa
const JANELA_MIN_ENTRE_TENTATIVAS = 10;

export async function executarReenviosCrmFalhos(): Promise<{
    processados: number;
    sucesso: number;
    falha: number;
}> {
    const limiteData = new Date(Date.now() - JANELA_MIN_ENTRE_TENTATIVAS * 60 * 1000);

    const leads = await prisma.lead.findMany({
        where: {
            crmSyncStatus: 'failed',
            enviadoParaCrmEm: { lt: limiteData },
        },
        select: { id: true, tenantId: true, nome: true, crmSyncError: true },
        orderBy: { enviadoParaCrmEm: 'asc' },
        take: LIMITE_POR_EXECUCAO,
    });

    let sucesso = 0;
    let falha = 0;

    for (const lead of leads) {
        try {
            console.log(`[JOB-CRM] Reenvio lead=${lead.id} tenant=${lead.tenantId}`);
            const resultado = await reenviarParaCrm(lead.id);
            if (resultado.success) {
                sucesso++;
                console.log(`[JOB-CRM] ✅ lead=${lead.id} code=${resultado.property_code}`);
            } else {
                falha++;
                console.warn(`[JOB-CRM] ❌ lead=${lead.id} erro=${resultado.error}`);
            }
        } catch (err: any) {
            falha++;
            console.error(`[JOB-CRM] Exceção lead=${lead.id}:`, err.message);
        }
    }

    console.log(`[JOB-CRM] Concluído: ${sucesso} ok, ${falha} falha de ${leads.length} processados`);
    return { processados: leads.length, sucesso, falha };
}
