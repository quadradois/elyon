import { prisma } from '../../lib/db';

export interface AgendarFollowupInput {
    leadId: string;
    dataRecontato: string;
    motivo: string;
}

export interface AgendarFollowupOutput {
    success: boolean;
    message?: string;
    dataRecontato?: string;
    error?: string;
}

export class AgendarFollowupUseCase {
    async execute(input: AgendarFollowupInput): Promise<AgendarFollowupOutput> {
        try {
            console.log(`[UseCase] agendar_followup - Lead ${input.leadId}`);

            const [dia, mes, ano] = input.dataRecontato.split('/').map(Number);
            const dataAgendamento = new Date(ano, mes - 1, dia, 9, 0);

            if (isNaN(dataAgendamento.getTime())) {
                return { success: false, error: 'Data inválida. Use DD/MM/YYYY' };
            }

            await prisma.lead.update({
                where: { id: input.leadId },
                data: {
                    statusProspeccao: 'MORNO_FUTURO',
                    dataRecontato: dataAgendamento,
                    motivoRecontato: input.motivo,
                    observacoes: `Futuro: ${input.motivo}`
                }
            });

            console.log(`[UseCase] agendar_followup - Recontato em ${input.dataRecontato}`);

            return {
                success: true,
                message: `Recontato agendado para ${input.dataRecontato}`,
                dataRecontato: dataAgendamento.toISOString()
            };
        } catch (error: any) {
            console.error('[UseCase] agendar_followup - Erro:', error);
            return {
                success: false,
                error: error.message || 'Erro ao agendar follow-up'
            };
        }
    }
}
