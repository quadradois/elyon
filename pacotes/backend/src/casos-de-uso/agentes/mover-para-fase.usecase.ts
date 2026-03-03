import { prisma } from '../../lib/db';

export interface MoverParaFaseInput {
    leadId: string;
    faseDestino: 'FASE1' | 'FASE2' | 'FASE3' | 'FASE4' | 'CAPTADO';
    motivo: string;
    dadosAdicionais?: {
        tipoAutorizacao?: 'exclusiva' | 'simples' | null;
        prazoTrabalho?: number | null;
        comissaoAcordada?: string | null;
    } | null;
}

export interface MoverParaFaseOutput {
    success: boolean;
    faseAnterior?: string;
    novoStatus?: string;
    motivo?: string;
    error?: string;
}

export class MoverParaFaseUseCase {
    async execute(input: MoverParaFaseInput): Promise<MoverParaFaseOutput> {
        try {
            const db: any = prisma;

            console.log(`[UseCase] mover_para_fase - Lead ${input.leadId} → ${input.faseDestino}`);

            const faseParaStatus: Record<string, string> = {
                'FASE1': 'NOVO',
                'FASE2': 'TENTATIVA_AGENDAMENTO',
                'FASE3': 'DOCUMENTACAO',
                'FASE4': 'ONBOARDING',
                'CAPTADO': 'CAPTADO'
            };

            const novoStatus = faseParaStatus[input.faseDestino];

            if (!novoStatus) {
                return { success: false, error: 'Fase inválida' };
            }

            const updateData: any = {
                status: novoStatus,
                ultimaInteracao: new Date(),
                ultimaAcaoIA: `Movido para ${input.faseDestino}: ${input.motivo}`,
                ultimaAcaoIAEm: new Date()
            };

            if (input.dadosAdicionais) {
                if (input.dadosAdicionais.tipoAutorizacao) updateData.tipoAutorizacao = input.dadosAdicionais.tipoAutorizacao;
                if (input.dadosAdicionais.prazoTrabalho) updateData.prazoTrabalho = input.dadosAdicionais.prazoTrabalho;
                if (input.dadosAdicionais.comissaoAcordada) updateData.comissaoAcordada = input.dadosAdicionais.comissaoAcordada;
            }

            await db.lead.update({
                where: { id: input.leadId },
                data: updateData
            });

            if (novoStatus === 'CAPTADO') {
                try {
                    const clienteExistente = await db.cliente.findUnique({
                        where: { origemLeadId: input.leadId }
                    });

                    if (!clienteExistente) {
                        const leadCompleto = await db.lead.findUnique({
                            where: { id: input.leadId }
                        });

                        if (leadCompleto) {
                            await db.cliente.create({
                                data: {
                                    tenantId: leadCompleto.tenantId,
                                    nome: leadCompleto.nome,
                                    cpf: leadCompleto.cpf,
                                    email: leadCompleto.email,
                                    telefone: leadCompleto.telefone,
                                    endereco: leadCompleto.enderecoPrincipal,
                                    origemLeadId: leadCompleto.id,
                                    status: 'ATIVO'
                                }
                            });
                            console.log(`[UseCase] mover_para_fase - Cliente criado com sucesso para o lead ${input.leadId}`);
                        }
                    }
                } catch (err: any) {
                    console.error('[UseCase] Erro ao criar registro de Cliente:', err);
                }
            }

            console.log(`[UseCase] mover_para_fase - Sucesso: ${input.leadId} agora em ${novoStatus}`);

            return {
                success: true,
                faseAnterior: input.faseDestino,
                novoStatus,
                motivo: input.motivo
            };

        } catch (error: any) {
            console.error(`[UseCase] mover_para_fase - Erro:`, error);
            return {
                success: false,
                error: error.message || 'Erro ao mover lead'
            };
        }
    }
}
