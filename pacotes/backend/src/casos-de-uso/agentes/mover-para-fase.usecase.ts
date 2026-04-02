import { prisma } from '../../lib/db';

export interface MoverParaFaseInput {
    leadId: string;
    faseDestino: 'FASE1' | 'FASE2' | 'FASE3' | 'FASE4' | 'CAPTADO';
    motivo: string;
    dadosAdicionais?: {
        tipoAutorizacao?: 'exclusiva' | 'simples' | null;
        prazoTrabalho?: number | null;
        comissaoAcordada?: string | null;
        autorizouAnuncio?: boolean | null;
    } | null;
}

export interface MoverParaFaseOutput {
    success: boolean;
    faseAnterior?: string;
    novoStatus?: string;
    motivo?: string;
    error?: string;
    reasonCode?: 'INVALID_PHASE' | 'LEAD_NOT_FOUND' | 'SPIN_QUALIFICATION_REQUIRED' | 'INTERNAL_ERROR';
    camposFaltantesQualificacao?: string[];
}

function temTexto(valor?: string | null): boolean {
    return typeof valor === 'string' && valor.trim().length > 0;
}

function avaliarProntidaoSpin(lead: {
    doresIdentificadas?: string[] | null;
    situacaoAtual?: string | null;
    motivacaoVenda?: string | null;
    consequencias?: string | null;
    custosAtuais?: string | null;
}) {
    const faltantes: string[] = [];
    const dores = Array.isArray(lead.doresIdentificadas) ? lead.doresIdentificadas.filter(Boolean) : [];

    if (dores.length < 2) faltantes.push('doresIdentificadas(>=2)');
    if (!temTexto(lead.situacaoAtual)) faltantes.push('situacaoAtual');
    if (!temTexto(lead.motivacaoVenda)) faltantes.push('motivacaoVenda');

    const temImplicacao = temTexto(lead.consequencias) || temTexto(lead.custosAtuais);
    if (!temImplicacao) faltantes.push('implicacao(custosAtuais|consequencias)');

    return {
        pronto: faltantes.length === 0,
        faltantes
    };
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
                return { success: false, error: 'Fase inválida', reasonCode: 'INVALID_PHASE' };
            }

            if (input.faseDestino === 'FASE3' || input.faseDestino === 'FASE4' || input.faseDestino === 'CAPTADO') {
                const leadAtual = await db.lead.findUnique({
                    where: { id: input.leadId },
                    select: {
                        doresIdentificadas: true,
                        situacaoAtual: true,
                        motivacaoVenda: true,
                        consequencias: true,
                        custosAtuais: true
                    }
                });

                if (!leadAtual) {
                    return {
                        success: false,
                        error: 'Lead não encontrado para validação de fase',
                        reasonCode: 'LEAD_NOT_FOUND'
                    };
                }

                const prontidao = avaliarProntidaoSpin(leadAtual);
                if (!prontidao.pronto) {
                    console.warn(
                        `[UseCase] mover_para_fase - Gate SPIN bloqueou transição do lead ${input.leadId} para ${input.faseDestino}. Faltantes: ${prontidao.faltantes.join(', ')}`
                    );
                    return {
                        success: false,
                        error: 'Qualificação SPIN incompleta para avançar de fase',
                        reasonCode: 'SPIN_QUALIFICATION_REQUIRED',
                        camposFaltantesQualificacao: prontidao.faltantes
                    };
                }
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
                if (input.dadosAdicionais.autorizouAnuncio !== undefined && input.dadosAdicionais.autorizouAnuncio !== null) {
                    updateData.autorizouAnuncio = input.dadosAdicionais.autorizouAnuncio;
                }
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
                error: error.message || 'Erro ao mover lead',
                reasonCode: 'INTERNAL_ERROR'
            };
        }
    }
}
