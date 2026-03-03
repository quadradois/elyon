import { prisma } from '../../lib/db';

export interface QualificarLeadInput {
    contatoId: string;
    temperatura: 'FRIO' | 'MORNO' | 'QUENTE';
    interesse: string;
    timeline: string;
    observacoes?: string;
    // Dados SPIN coletados na conversa
    doresIdentificadas?: string[];
    motivacaoVenda?: string;
    situacaoAtual?: string;
    prazoDesejado?: string;
    consequencias?: string;
    custosAtuais?: string;
    expectativaServico?: string;
    comCorretorAtualmente?: boolean;
    tentativasAnteriores?: string;
    // Dados do imóvel
    enderecoImovel?: string;
    tipoImovel?: string;
    areaImovel?: string;
    quartosImovel?: number;
    vagasImovel?: number;
    valorPretendido?: string;
    ocupacaoImovel?: string;
}

export interface QualificarLeadOutput {
    success: boolean;
    leadId?: string;
    leadCriado?: boolean;
    temperatura?: string;
    prontidaoQualificacao?: 'PARCIAL' | 'COMPLETA';
    camposAtualizados?: string[];
    camposFaltantesCriticos?: string[];
    message?: string;
    error?: string;
}

function temTexto(valor?: string | null): boolean {
    return typeof valor === 'string' && valor.trim().length > 0;
}

function camposCriticosFaltantes(snapshot: {
    interesseEm?: string | null;
    tipoImovel?: string | null;
    areaImovel?: string | null;
    ocupacaoImovel?: string | null;
    valorPretendido?: string | null;
    doresIdentificadas?: string[] | null;
    situacaoAtual?: string | null;
    motivacaoVenda?: string | null;
    consequencias?: string | null;
    custosAtuais?: string | null;
}): string[] {
    const faltantes: string[] = [];

    if (!temTexto(snapshot.interesseEm)) faltantes.push('interesseEm');
    if (!temTexto(snapshot.tipoImovel)) faltantes.push('tipoImovel');
    if (!temTexto(snapshot.areaImovel)) faltantes.push('areaImovel');
    if (!temTexto(snapshot.ocupacaoImovel)) faltantes.push('ocupacaoImovel');
    if (!temTexto(snapshot.valorPretendido)) faltantes.push('valorPretendido');
    if (!snapshot.doresIdentificadas || snapshot.doresIdentificadas.length === 0) faltantes.push('doresIdentificadas');
    if (!temTexto(snapshot.situacaoAtual)) faltantes.push('situacaoAtual');
    if (!temTexto(snapshot.motivacaoVenda)) faltantes.push('motivacaoVenda');

    const temImplicacao = temTexto(snapshot.consequencias) || temTexto(snapshot.custosAtuais);
    if (!temImplicacao) faltantes.push('implicacao');

    return faltantes;
}

/**
 * Derivar urgência do timeline
 */
function derivarUrgencia(timeline: string): 'BAIXA' | 'MEDIA' | 'ALTA' {
    const tl = timeline.toLowerCase();
    if (tl.includes('urgente') || tl.includes('imediato') || tl.includes('1 mês') || tl.includes('1 mes') || tl.includes('já') || tl.includes('ja')) {
        return 'ALTA';
    }
    if (tl.includes('2') || tl.includes('3') || tl.includes('trimestre') || tl.includes('breve')) {
        return 'MEDIA';
    }
    return 'BAIXA';
}

export class QualificarLeadUseCase {
    async execute(input: QualificarLeadInput): Promise<QualificarLeadOutput> {
        try {
            const db: any = prisma;

            let leadId: string | undefined = undefined;
            let leadCriado = false;

            // Buscar contato
            const contato = await db.contato.findUnique({
                where: { id: input.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return { success: false, error: 'Contato não encontrado' };
            }

            // Se contato já tem Lead, usar esse ID
            if (contato.leadId) {
                leadId = contato.leadId;
            } else {
                // Criar novo Lead com dados enriquecidos
                const novoLead = await db.lead.create({
                    data: {
                        tenantId: contato.campanha.tenantId,
                        nome: contato.nome,
                        telefone: contato.telefone,
                        email: contato.email,
                        cpf: contato.cpf,
                        enderecoPrincipal: contato.enderecoImovel || contato.endereco,
                        origem: 'prospeccao_ativa',
                        campanhaOrigemId: contato.campanhaId,
                        status: 'QUALIFICADO',
                        temperatura: input.temperatura,
                        estagio: 'qualificado_sdr',
                        primeiroContato: contato.criadoEm,
                        ultimaInteracao: new Date(),
                        // Dados do imóvel (conversa + fallback Contato)
                        enderecoImovel: input.enderecoImovel || contato.enderecoImovel || undefined,
                        tipoImovel: input.tipoImovel || contato.tipoImovel || undefined,
                        areaImovel: input.areaImovel || undefined,
                        quartosImovel: input.quartosImovel || undefined,
                        vagasImovel: input.vagasImovel || undefined,
                        valorPretendido: input.valorPretendido || undefined,
                        ocupacaoImovel: input.ocupacaoImovel || undefined,
                    }
                });

                leadId = novoLead.id;
                leadCriado = true;

                await db.contato.update({
                    where: { id: input.contatoId },
                    data: {
                        virouLead: true,
                        leadId: novoLead.id,
                        virouLeadEm: new Date(),
                        statusProspeccao: 'LEAD',
                        manifestouInteresse: true
                    }
                });
            }

            const leadAtual = await db.lead.findUnique({
                where: { id: leadId },
                select: {
                    interesseEm: true,
                    tipoImovel: true,
                    areaImovel: true,
                    quartosImovel: true,
                    vagasImovel: true,
                    valorPretendido: true,
                    ocupacaoImovel: true,
                    enderecoImovel: true,
                    doresIdentificadas: true,
                    motivacaoVenda: true,
                    situacaoAtual: true,
                    consequencias: true,
                    custosAtuais: true,
                    expectativaServico: true,
                    comCorretorAtualmente: true,
                    tentativasAnteriores: true,
                    prazoDesejado: true,
                    urgencia: true
                }
            });

            // Derivar urgência
            const urgencia = derivarUrgencia(input.timeline);

            // Montar update com todos os dados disponíveis
            const updateData: any = {
                temperatura: input.temperatura,
                status: 'QUALIFICADO',
                ultimaInteracao: new Date(),
                interesseEm: input.interesse,
                urgencia,
                prazoDesejado: input.prazoDesejado || input.timeline,
            };

            const camposAtualizados = ['temperatura', 'status', 'interesseEm', 'urgencia', 'prazoDesejado'];

            // Dados SPIN (só atualiza se fornecido)
            if (input.doresIdentificadas?.length) {
                const anteriores = Array.isArray(leadAtual?.doresIdentificadas) ? leadAtual.doresIdentificadas : [];
                updateData.doresIdentificadas = Array.from(new Set([...anteriores, ...input.doresIdentificadas]));
                camposAtualizados.push('doresIdentificadas');
            }
            if (input.motivacaoVenda) {
                updateData.motivacaoVenda = input.motivacaoVenda;
                camposAtualizados.push('motivacaoVenda');
            }
            if (input.situacaoAtual) {
                updateData.situacaoAtual = input.situacaoAtual;
                camposAtualizados.push('situacaoAtual');
            }
            if (input.consequencias) {
                updateData.consequencias = input.consequencias;
                camposAtualizados.push('consequencias');
            }
            if (input.custosAtuais) {
                updateData.custosAtuais = input.custosAtuais;
                camposAtualizados.push('custosAtuais');
            }
            if (input.expectativaServico) {
                updateData.expectativaServico = input.expectativaServico;
                camposAtualizados.push('expectativaServico');
            }
            if (input.comCorretorAtualmente !== undefined) {
                updateData.comCorretorAtualmente = input.comCorretorAtualmente;
                camposAtualizados.push('comCorretorAtualmente');
            }
            if (input.tentativasAnteriores) {
                updateData.tentativasAnteriores = input.tentativasAnteriores;
                camposAtualizados.push('tentativasAnteriores');
            }

            // Dados do imóvel (só atualiza se fornecido)
            if (input.enderecoImovel) {
                updateData.enderecoImovel = input.enderecoImovel;
                camposAtualizados.push('enderecoImovel');
            }
            if (input.tipoImovel) {
                updateData.tipoImovel = input.tipoImovel;
                camposAtualizados.push('tipoImovel');
            }
            if (input.areaImovel) {
                updateData.areaImovel = input.areaImovel;
                camposAtualizados.push('areaImovel');
            }
            if (input.quartosImovel !== undefined) {
                updateData.quartosImovel = input.quartosImovel;
                camposAtualizados.push('quartosImovel');
            }
            if (input.vagasImovel !== undefined) {
                updateData.vagasImovel = input.vagasImovel;
                camposAtualizados.push('vagasImovel');
            }
            if (input.valorPretendido) {
                updateData.valorPretendido = input.valorPretendido;
                camposAtualizados.push('valorPretendido');
            }
            if (input.ocupacaoImovel) {
                updateData.ocupacaoImovel = input.ocupacaoImovel;
                camposAtualizados.push('ocupacaoImovel');
            }

            // Atualizar lead
            const leadAtualizado = await db.lead.update({
                where: { id: leadId },
                data: updateData,
                select: {
                    interesseEm: true,
                    tipoImovel: true,
                    areaImovel: true,
                    valorPretendido: true,
                    ocupacaoImovel: true,
                    doresIdentificadas: true,
                    situacaoAtual: true,
                    motivacaoVenda: true,
                    consequencias: true,
                    custosAtuais: true
                }
            });

            const faltantesCriticos = camposCriticosFaltantes({
                interesseEm: leadAtualizado.interesseEm,
                tipoImovel: leadAtualizado.tipoImovel,
                areaImovel: leadAtualizado.areaImovel,
                valorPretendido: leadAtualizado.valorPretendido,
                ocupacaoImovel: leadAtualizado.ocupacaoImovel,
                doresIdentificadas: leadAtualizado.doresIdentificadas,
                situacaoAtual: leadAtualizado.situacaoAtual,
                motivacaoVenda: leadAtualizado.motivacaoVenda,
                consequencias: leadAtualizado.consequencias,
                custosAtuais: leadAtualizado.custosAtuais
            });

            const prontidaoQualificacao: 'PARCIAL' | 'COMPLETA' = faltantesCriticos.length === 0 ? 'COMPLETA' : 'PARCIAL';

            // Registrar atividade com detalhes completos
            const detalhes = [
                `Interesse: ${input.interesse}`,
                `Timeline: ${input.timeline}`,
                `Urgência: ${urgencia}`,
            ];
            if (input.doresIdentificadas?.length) detalhes.push(`Dores: ${input.doresIdentificadas.join(', ')}`);
            if (input.motivacaoVenda) detalhes.push(`Motivação: ${input.motivacaoVenda}`);
            if (input.situacaoAtual) detalhes.push(`Situação: ${input.situacaoAtual}`);
            if (input.tipoImovel) detalhes.push(`Imóvel: ${input.tipoImovel}`);
            if (input.quartosImovel) detalhes.push(`Quartos: ${input.quartosImovel}`);
            if (input.valorPretendido) detalhes.push(`Valor pretendido: ${input.valorPretendido}`);
            if (input.observacoes) detalhes.push(`Obs: ${input.observacoes}`);

            await db.atividade.create({
                data: {
                    leadId: leadId,
                    tipo: 'NOTA',
                    titulo: `Lead qualificado como ${input.temperatura}`,
                    descricao: detalhes.join('\n'),
                    criadoPor: 'ai_agent',
                    completadoEm: new Date()
                }
            });

            console.log(`[UseCase] qualificar_lead - Lead ${input.temperatura} qualificado com dados enriquecidos`);

            return {
                success: true,
                leadId,
                leadCriado,
                temperatura: input.temperatura,
                prontidaoQualificacao,
                camposAtualizados: Array.from(new Set(camposAtualizados)),
                camposFaltantesCriticos: faltantesCriticos,
                message: `Lead ${leadCriado ? 'criado e ' : ''}qualificado como ${input.temperatura}. Prontidão: ${prontidaoQualificacao}.`
            };
        } catch (error: any) {
            console.error('[UseCase] qualificar_lead - Erro:', error);
            return {
                success: false,
                error: error.message || 'Erro ao qualificar lead'
            };
        }
    }
}
