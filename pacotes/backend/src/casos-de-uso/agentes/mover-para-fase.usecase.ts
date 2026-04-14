import { prisma } from '../../lib/db';
import { logger } from '../../lib/logger';

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
    reasonCode?: 'INVALID_PHASE' | 'LEAD_NOT_FOUND' | 'SPIN_QUALIFICATION_REQUIRED' | 'PHASE_TRANSITION_BLOCKED' | 'INTERNAL_ERROR';
    camposFaltantesQualificacao?: string[];
    gateDetalhes?: string;
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

const faseParaStatus: Record<MoverParaFaseInput['faseDestino'], string> = {
    FASE1: 'NOVO',
    FASE2: 'TENTATIVA_AGENDAMENTO',
    FASE3: 'DOCUMENTACAO',
    FASE4: 'ONBOARDING',
    CAPTADO: 'CAPTADO'
};

const ordemFluxoPorStatus: Record<string, number> = {
    NOVO: 1,
    QUALIFICADO: 1,
    TENTATIVA_AGENDAMENTO: 2,
    VISITA_AGENDADA: 2,
    CONTATANDO: 2,
    AVALIACAO_EM_ANDAMENTO: 2,
    DOCUMENTACAO: 3,
    EM_NEGOCIACAO: 3,
    ONBOARDING: 4,
    CAPTADO: 5
};

function validarTransicaoFase(statusAtual: string | null | undefined, faseDestino: MoverParaFaseInput['faseDestino']) {
    if (!statusAtual) {
        return { permitido: true };
    }

    const ordemAtual = ordemFluxoPorStatus[statusAtual];
    const statusDestino = faseParaStatus[faseDestino];
    const ordemDestino = ordemFluxoPorStatus[statusDestino];

    // Se status atual não está no mapeamento legado, não bloqueia para evitar travar operações antigas.
    if (!ordemAtual || !ordemDestino) {
        return { permitido: true };
    }

    // Bloqueia apenas salto para frente maior que 1 etapa. Recuos seguem permitidos.
    if (ordemDestino > ordemAtual + 1) {
        return {
            permitido: false,
            detalhe: `Transição inválida: ${statusAtual} -> ${statusDestino}. Avance no máximo 1 etapa por vez.`
        };
    }

    return { permitido: true };
}

export class MoverParaFaseUseCase {
    async execute(input: MoverParaFaseInput): Promise<MoverParaFaseOutput> {
        try {
            const db: any = prisma;

            logger.info({
                useCase: 'mover_para_fase',
                fase: 'inicio',
                leadId: input.leadId,
                faseDestino: input.faseDestino,
                motivo: input.motivo
            }, '[GOV-09] mover_para_fase iniciado');

            const novoStatus = faseParaStatus[input.faseDestino];

            if (!novoStatus) {
                return { success: false, error: 'Fase inválida', reasonCode: 'INVALID_PHASE' };
            }

            const leadAtual = await db.lead.findUnique({
                where: { id: input.leadId },
                select: {
                    status: true,
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

            const gateTransicao = validarTransicaoFase(leadAtual.status, input.faseDestino);
            if (!gateTransicao.permitido) {
                    logger.warn({
                        useCase: 'mover_para_fase',
                        fase: 'gate_transicao',
                        leadId: input.leadId,
                        statusAtual: leadAtual.status,
                        faseDestino: input.faseDestino,
                        gateDetalhes: gateTransicao.detalhe
                    }, '[GOV-09] Gate de transição bloqueou avanço de fase');
                    return {
                        success: false,
                        error: 'Transição de fase bloqueada pelo gate de governança',
                    reasonCode: 'PHASE_TRANSITION_BLOCKED',
                    gateDetalhes: gateTransicao.detalhe
                };
            }

            if (input.faseDestino === 'FASE3' || input.faseDestino === 'FASE4' || input.faseDestino === 'CAPTADO') {
                const prontidao = avaliarProntidaoSpin(leadAtual);
                if (!prontidao.pronto) {
                    logger.warn({
                        useCase: 'mover_para_fase',
                        fase: 'gate_spin',
                        leadId: input.leadId,
                        faseDestino: input.faseDestino,
                        faltantes: prontidao.faltantes
                    }, '[GOV-09] Gate SPIN bloqueou avanço de fase');
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
                            logger.info({
                                useCase: 'mover_para_fase',
                                fase: 'cliente_criado',
                                leadId: input.leadId
                            }, '[GOV-09] Cliente criado após CAPTADO');
                        }
                    }
                } catch (err: any) {
                    console.error('[UseCase] Erro ao criar registro de Cliente:', err);
                }
            }

            logger.info({
                useCase: 'mover_para_fase',
                fase: 'sucesso',
                leadId: input.leadId,
                novoStatus,
                faseDestino: input.faseDestino
            }, '[GOV-09] mover_para_fase concluído');

            return {
                success: true,
                faseAnterior: input.faseDestino,
                novoStatus,
                motivo: input.motivo
            };

        } catch (error: any) {
            logger.error({
                useCase: 'mover_para_fase',
                fase: 'erro',
                leadId: input.leadId,
                erro: error?.message || 'erro desconhecido'
            }, '[GOV-09] mover_para_fase falhou');
            return {
                success: false,
                error: error.message || 'Erro ao mover lead',
                reasonCode: 'INTERNAL_ERROR'
            };
        }
    }
}
