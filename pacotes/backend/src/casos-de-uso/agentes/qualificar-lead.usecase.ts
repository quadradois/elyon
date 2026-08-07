import { prisma } from '../../lib/db';
import { mergeSchemaStateComSources } from './source-of-truth';
import {
    aplicarBooleanComEvidencia,
    normalizarPrazoEUrgencia,
    temTexto,
    valorComEvidencia
} from './governanca-campos';

export interface QualificarLeadInput {
    contatoId?: string;
    leadId?: string;
    temperatura: 'FRIO' | 'MORNO' | 'QUENTE';
    interesse: string;
    timeline?: string;
    observacoes?: string;
    // Dados SPIN coletados na conversa
    // S - Situação
    situacaoAtual?: string;
    tempoDecisao?: string;
    tentativasAnteriores?: string;
    comCorretorAtualmente?: boolean;
    comCorretorAtualmenteEvidencia?: string;
    // P - Problema
    doresIdentificadas?: string[];
    motivacaoVenda?: string;
    // I - Implicação
    prazoDesejado?: string;
    consequencias?: string;
    custosAtuais?: string;
    pressaoTempo?: boolean;
    pressaoTempoEvidencia?: string;
    // N - Necessidade
    expectativaServico?: string;
    objecoes?: string[];
    interesseAvaliacao?: boolean;
    interesseAvaliacaoEvidencia?: string;
    // Dados do imóvel
    enderecoImovel?: string;
    tipoImovel?: string;
    areaImovel?: string;
    quartosImovel?: number;
    vagasImovel?: number;
    valorPretendido?: string;
    ocupacaoImovel?: string;
    // Qualificação adicional do imóvel
    estadoConservacao?: string;
    situacaoFinanceira?: string;
    temDividas?: boolean;
    temDividasEvidencia?: string;
}

export interface QualificarLeadOutput {
    success: boolean;
    leadId?: string;
    leadCriado?: boolean;
    temperatura?: string;
    statusLead?: string;
    prontidaoQualificacao?: 'PARCIAL' | 'COMPLETA';
    camposAtualizados?: string[];
    camposFaltantesCriticos?: string[];
    message?: string;
    error?: string;
}

function pareceValorMonetario(texto?: string | null): boolean {
    const t = (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    if (!t) return false;

    if (/r\$\s*\d/.test(t)) return true;
    if (/\b\d+(?:[.,]\d+)?\s*(k|mil|mi|milhao|milhoes|reais?)\b/.test(t)) return true;
    if (
        /\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/.test(t)
        && !/\b(m2|m²|metros?|metro\s+quadrado|metros\s+quadrados)\b/.test(t)
    ) {
        return true;
    }
    return false;
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

export class QualificarLeadUseCase {
    async execute(input: QualificarLeadInput): Promise<QualificarLeadOutput> {
        try {
            const db: any = prisma;

            const idEntradaResolvido = input.leadId || input.contatoId;
            if (!idEntradaResolvido) {
                return { success: false, error: 'Lead não informado' };
            }

            // Contato foi unificado em Lead. `contatoId` permanece somente como
            // alias compatível do contrato da tool, sem depender da tabela legada.
            const leadBase = await db.lead.findUnique({
                where: { id: idEntradaResolvido },
                select: { id: true, enderecoImovel: true, tipoImovel: true }
            });
            if (!leadBase) return { success: false, error: 'Lead não encontrado' };

            const leadId: string = idEntradaResolvido;
            const leadCriado = false;

            const areaImovelInformada = temTexto(input.areaImovel) ? input.areaImovel!.trim() : undefined;
            const areaPareceValor = pareceValorMonetario(areaImovelInformada);
            const areaImovelNormalizada = areaPareceValor ? undefined : areaImovelInformada;
            const valorPretendidoNormalizado = temTexto(input.valorPretendido)
                ? input.valorPretendido!.trim()
                : areaPareceValor
                    ? areaImovelInformada
                    : undefined;
            const { timelineEhConfiavel, prazoDesejadoNormalizado, urgencia } = normalizarPrazoEUrgencia({
                timeline: input.timeline,
                prazoDesejado: input.prazoDesejado
            });

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
                    objecoes: true,
                    motivacaoVenda: true,
                    situacaoAtual: true,
                    tempoDecisao: true,
                    tentativasAnteriores: true,
                    consequencias: true,
                    custosAtuais: true,
                    pressaoTempo: true,
                    expectativaServico: true,
                    comCorretorAtualmente: true,
                    interesseAvaliacao: true,
                    prazoDesejado: true,
                    urgencia: true,
                    schemaState: true,
                    status: true
                }
            });

            // Montar update com todos os dados disponíveis
            const updateData: any = {
                temperatura: input.temperatura,
                ultimaInteracao: new Date(),
                interesseEm: input.interesse,
                respondeu: true,
                manifestouInteresse: true,
                statusProspeccao: 'INTERESSADO',
                estagio: 'qualificado_sdr',
            };

            const camposAtualizados = ['temperatura', 'interesseEm', 'respondeu', 'manifestouInteresse', 'statusProspeccao', 'estagio'];
            if (urgencia) {
                updateData.urgencia = urgencia;
                camposAtualizados.push('urgencia');
            }
            if (prazoDesejadoNormalizado) {
                updateData.prazoDesejado = prazoDesejadoNormalizado;
                camposAtualizados.push('prazoDesejado');
            }

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
            aplicarBooleanComEvidencia({
                campo: 'comCorretorAtualmente',
                valor: input.comCorretorAtualmente,
                evidencia: input.comCorretorAtualmenteEvidencia,
                updateData,
                camposAtualizados,
                warningTag: 'GOV-03B',
            });
            if (input.tentativasAnteriores) {
                updateData.tentativasAnteriores = input.tentativasAnteriores;
                camposAtualizados.push('tentativasAnteriores');
            }
            if (input.tempoDecisao) {
                updateData.tempoDecisao = input.tempoDecisao;
                camposAtualizados.push('tempoDecisao');
            }
            aplicarBooleanComEvidencia({
                campo: 'pressaoTempo',
                valor: input.pressaoTempo,
                evidencia: input.pressaoTempoEvidencia,
                updateData,
                camposAtualizados,
                warningTag: 'GOV-04',
            });
            if (input.objecoes?.length) {
                const anterioresObj = Array.isArray((leadAtual as any)?.objecoes) ? (leadAtual as any).objecoes : [];
                updateData.objecoes = Array.from(new Set([...anterioresObj, ...input.objecoes]));
                camposAtualizados.push('objecoes');
            }
            aplicarBooleanComEvidencia({
                campo: 'interesseAvaliacao',
                valor: input.interesseAvaliacao,
                evidencia: input.interesseAvaliacaoEvidencia,
                updateData,
                camposAtualizados,
                warningTag: 'GOV-04',
            });
            if (input.observacoes) {
                updateData.observacoesSpin = input.observacoes;
                camposAtualizados.push('observacoesSpin');
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
            if (areaImovelNormalizada) {
                updateData.areaImovel = areaImovelNormalizada;
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
            if (valorPretendidoNormalizado) {
                updateData.valorPretendido = valorPretendidoNormalizado;
                camposAtualizados.push('valorPretendido');
            }
            if (input.ocupacaoImovel) {
                updateData.ocupacaoImovel = input.ocupacaoImovel;
                camposAtualizados.push('ocupacaoImovel');
            }
            if (input.estadoConservacao) {
                updateData.estadoConservacao = input.estadoConservacao;
                camposAtualizados.push('estadoConservacao');
            }
            if (input.situacaoFinanceira) {
                updateData.situacaoFinanceira = input.situacaoFinanceira;
                camposAtualizados.push('situacaoFinanceira');
            }
            aplicarBooleanComEvidencia({
                campo: 'temDividas',
                valor: input.temDividas,
                evidencia: input.temDividasEvidencia,
                updateData,
                camposAtualizados,
                warningTag: 'GOV-03B',
            });

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
            const schemaUpdatesTool = Object.fromEntries(
                Object.entries(updateData).filter(([campo, valor]) => campo !== 'ultimaInteracao' && valor !== undefined)
            );
            let schemaStateAtualizado = mergeSchemaStateComSources(
                leadAtual?.schemaState,
                schemaUpdatesTool,
                'tool_confirmada',
                'coletado em qualificar_lead'
            );
            if (updateData.comCorretorAtualmente !== undefined && temTexto(input.comCorretorAtualmenteEvidencia)) {
                schemaStateAtualizado = mergeSchemaStateComSources(
                    schemaStateAtualizado,
                    { comCorretorAtualmente: updateData.comCorretorAtualmente },
                    'tool_confirmada',
                    input.comCorretorAtualmenteEvidencia!.trim()
                );
            }
            if (updateData.temDividas !== undefined && temTexto(input.temDividasEvidencia)) {
                schemaStateAtualizado = mergeSchemaStateComSources(
                    schemaStateAtualizado,
                    { temDividas: updateData.temDividas },
                    'tool_confirmada',
                    input.temDividasEvidencia!.trim()
                );
            }
            if (updateData.pressaoTempo !== undefined && temTexto(input.pressaoTempoEvidencia)) {
                schemaStateAtualizado = mergeSchemaStateComSources(
                    schemaStateAtualizado,
                    { pressaoTempo: updateData.pressaoTempo },
                    'tool_confirmada',
                    input.pressaoTempoEvidencia!.trim()
                );
            }
            if (updateData.interesseAvaliacao !== undefined && temTexto(input.interesseAvaliacaoEvidencia)) {
                schemaStateAtualizado = mergeSchemaStateComSources(
                    schemaStateAtualizado,
                    { interesseAvaliacao: updateData.interesseAvaliacao },
                    'tool_confirmada',
                    input.interesseAvaliacaoEvidencia!.trim()
                );
            }

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
            const statusAtual = (leadAtual as any)?.status as string | undefined;
            const statusNaoRebaixar = new Set([
                'TENTATIVA_AGENDAMENTO',
                'VISITA_AGENDADA',
                'AVALIACAO_EM_ANDAMENTO',
                'DOCUMENTACAO',
                'EM_NEGOCIACAO',
                'ONBOARDING',
                'CAPTADO',
                'PERDIDO',
                'ARQUIVADO',
            ]);

            let statusLead: string = statusAtual || 'NOVO';
            if (prontidaoQualificacao === 'COMPLETA') {
                await db.lead.update({ where: { id: leadId }, data: { statusProspeccao: 'LEAD' } });
                if (!camposAtualizados.includes('statusProspeccao')) camposAtualizados.push('statusProspeccao');
                if (!statusAtual || !statusNaoRebaixar.has(statusAtual)) {
                    statusLead = 'QUALIFICADO';
                }
            } else if (leadCriado) {
                // Novo lead com dados incompletos deve permanecer como NOVO até completar SPIN.
                statusLead = 'NOVO';
            }

            if (statusLead !== statusAtual) {
                await db.lead.update({
                    where: { id: leadId },
                    data: { status: statusLead }
                });
                camposAtualizados.push('status');
                schemaStateAtualizado = mergeSchemaStateComSources(
                    schemaStateAtualizado,
                    { status: statusLead },
                    'sistema',
                    'status calculado por prontidão de qualificação'
                );
            }

            if (Object.keys(schemaUpdatesTool).length > 0 || statusLead !== statusAtual) {
                await db.lead.update({
                    where: { id: leadId },
                    data: { schemaState: schemaStateAtualizado as any }
                });
            }

            // Registrar atividade com detalhes completos
            const detalhes = [
                `Interesse: ${input.interesse}`,
                `Prontidão: ${prontidaoQualificacao}`,
                `Status Lead: ${statusLead}`,
            ];
            if (timelineEhConfiavel) detalhes.push(`Timeline: ${input.timeline}`);
            if (urgencia) detalhes.push(`Urgência: ${urgencia}`);
            if (input.doresIdentificadas?.length) detalhes.push(`Dores: ${input.doresIdentificadas.join(', ')}`);
            if (input.motivacaoVenda) detalhes.push(`Motivação: ${input.motivacaoVenda}`);
            if (input.situacaoAtual) detalhes.push(`Situação: ${input.situacaoAtual}`);
            if (input.tipoImovel) detalhes.push(`Imóvel: ${input.tipoImovel}`);
            if (input.quartosImovel) detalhes.push(`Quartos: ${input.quartosImovel}`);
            if (valorPretendidoNormalizado) detalhes.push(`Valor pretendido: ${valorPretendidoNormalizado}`);
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
                statusLead,
                prontidaoQualificacao,
                camposAtualizados: Array.from(new Set(camposAtualizados)),
                camposFaltantesCriticos: faltantesCriticos,
                message: `Lead ${leadCriado ? 'criado e ' : ''}processado como ${input.temperatura}. Prontidão: ${prontidaoQualificacao}. Status: ${statusLead}.`
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
