import { prisma } from '../../lib/db';

export interface RegistrarOptoutInput {
    contatoId: string;
    motivo: 'NAO_INCOMODAR' | 'JA_TEM_IMOBILIARIA' | 'SEM_INTERESSE_AGORA' | 'IMOVEL_VENDIDO' | 'NAO_E_PROPRIETARIO' | 'OUTRO';
}

export interface RegistrarOptoutOutput {
    success: boolean;
    message?: string;
    error?: string;
}

export class RegistrarOptoutUseCase {
    async execute(input: RegistrarOptoutInput): Promise<RegistrarOptoutOutput> {
        try {
            console.log(`[UseCase] registrar_optout - Contato ${input.contatoId}`);

            // Tentar como Contato
            try {
                await prisma.contato.update({
                    where: { id: input.contatoId },
                    data: {
                        statusProspeccao: 'OPTOUT',
                        motivoDesinteresse: input.motivo,
                        observacoes: `Opt-out: ${input.motivo}`,
                        atualizadoEm: new Date()
                    }
                });
            } catch {
                // Tentar como Lead
                await prisma.lead.update({
                    where: { id: input.contatoId },
                    data: {
                        status: 'PERDIDO',
                        ultimaInteracao: new Date()
                    }
                });
            }

            // Encerrar conversa ativa
            await prisma.conversa.updateMany({
                where: { leadId: input.contatoId, estadoConversa: 'ativa' },
                data: { estadoConversa: 'concluida', finalizadaEm: new Date() }
            });

            console.log(`[UseCase] registrar_optout - Sucesso!`);

            return {
                success: true,
                message: 'Opt-out registrado. O contato não receberá mais mensagens.'
            };
        } catch (error: any) {
            console.error('[UseCase] registrar_optout - Erro:', error);
            return {
                success: false,
                error: error.message || 'Erro ao registrar opt-out'
            };
        }
    }
}
