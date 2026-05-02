/**
 * JOB DE RETORNO AUTOMÁTICO HUMANO → IA
 *
 * Após o SLA de atendimento humano (padrão: 4h), se nenhuma mensagem humana
 * foi enviada ao contato, devolve o atendimento para a IA automaticamente.
 *
 * Lógica:
 *   - Busca contatos com modoAtendimento='HUMANO'
 *   - Filtra os que têm ultimaInteracaoHumanaEm < agora - SLA_HORAS
 *   - Atualiza modoAtendimento='IA' e registra no audit log
 *
 * Deve ser executado a cada 30 min via cron.
 */

import { prisma } from '../lib/db';
import { ServicoAuditoria } from '../servicos/servico-auditoria';

// Horas sem resposta humana antes de devolver para IA
const SLA_HORAS_PADRAO = 4;

export async function executarRetornoIa(slaHoras: number = SLA_HORAS_PADRAO): Promise<{
    processados: number;
    reativados: number;
    erros: number;
}> {
    const limiteData = new Date(Date.now() - slaHoras * 60 * 60 * 1000);

    const contatos = await (prisma.lead as any).findMany({
        where: {
            modoAtendimento: 'HUMANO',
            ultimaInteracao: { lt: limiteData },
        },
        select: { id: true, tenantId: true, leadId: true, nome: true, ultimaInteracao: true },
        take: 50,
    });

    let reativados = 0;
    let erros = 0;

    for (const contato of contatos) {
        try {
            await (prisma.lead as any).update({
                where: { id: contato.id },
                data: { modoAtendimento: 'IA' },
            });

            ServicoAuditoria.registrar({
                tenantId: contato.tenantId,
                acao: 'RETORNO_IA_AUTO',
                entidade: 'Contato',
                entidadeId: contato.id,
                ip: '127.0.0.1',
                detalhes: {
                    motivo: `SLA de ${slaHoras}h sem resposta humana`,
                    ultimaInteracao: contato.ultimaInteracao,
                    leadId: contato.leadId,
                },
            });

            console.log(`[JOB-IA] modoAtendimento=IA restaurado para contato=${contato.id} (lead=${contato.leadId})`);
            reativados++;
        } catch (err: any) {
            erros++;
            console.error(`[JOB-IA] Erro ao reativar contato=${contato.id}:`, err.message);
        }
    }

    console.log(`[JOB-IA] Concluído: ${reativados} reativados, ${erros} erros de ${contatos.length} processados`);
    return { processados: contatos.length, reativados, erros };
}
