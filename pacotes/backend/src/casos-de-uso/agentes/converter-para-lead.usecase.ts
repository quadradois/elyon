import { prisma } from '../../lib/db';
import { ragConversasService } from '../../servicos/rag-conversas';

export interface ConverterParaLeadInput {
    contatoId: string;
    temperatura: 'MORNO' | 'QUENTE';
    tipoInteresse: 'VENDA' | 'LOCACAO' | 'AMBOS';
    timeline: string;
    // Dados do imóvel coletados na conversa
    enderecoImovel?: string;
    tipoImovel?: string;
    areaImovel?: string;
    quartosImovel?: number;
    vagasImovel?: number;
    valorPretendido?: string;
    ocupacaoImovel?: string;
    // Qualificação SPIN
    motivacaoVenda?: string;
    situacaoAtual?: string;
    prazoDesejado?: string;
    doresIdentificadas?: string[];
}

export interface ConverterParaLeadOutput {
    success: boolean;
    leadId?: string;
    temperatura?: string;
    message?: string;
    error?: string;
    reasonCode?:
        | 'CONVERTED'
        | 'CONTACT_NOT_FOUND'
        | 'ALREADY_LEAD'
        | 'MISSING_CAMPAIGN_TENANT'
        | 'DB_ERROR';
}

/**
 * Derivar urgência do timeline informado pelo lead
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

export class ConverterParaLeadUseCase {
    async execute(input: ConverterParaLeadInput): Promise<ConverterParaLeadOutput> {
        try {
            console.log(`[UseCase] converter_para_lead - Contato ${input.contatoId}`);

            const contato = await prisma.contato.findUnique({
                where: { id: input.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return {
                    success: false,
                    error: 'Contato não encontrado',
                    reasonCode: 'CONTACT_NOT_FOUND'
                };
            }

            if (contato.virouLead || !!contato.leadId) {
                return {
                    success: false,
                    error: 'Contato já é lead',
                    leadId: contato.leadId || undefined,
                    reasonCode: 'ALREADY_LEAD'
                };
            }

            if (!contato.campanha?.tenantId) {
                return {
                    success: false,
                    error: 'Contato sem tenant de campanha para conversão',
                    reasonCode: 'MISSING_CAMPAIGN_TENANT'
                };
            }

            // Derivar urgência a partir do timeline
            const urgencia = derivarUrgencia(input.timeline);

            // Mapear interesse para o enum esperado
            const interesseMap: Record<string, string> = {
                'VENDA': 'vender',
                'LOCACAO': 'alugar',
                'AMBOS': 'ambos'
            };

            // Criar Lead com TODOS os dados coletados na conversa + herdados do Contato
            const novoLead = await prisma.lead.create({
                data: {
                    tenantId: contato.campanha.tenantId,
                    nome: contato.nome,
                    telefone: contato.telefone,
                    email: contato.email,
                    cpf: contato.cpf,
                    enderecoPrincipal: contato.endereco,
                    origem: 'prospeccao_ativa',
                    campanhaOrigemId: contato.campanhaId,
                    status: 'NOVO',
                    temperatura: input.temperatura,
                    estagio: 'qualificado_sdr',
                    primeiroContato: contato.criadoEm,
                    ultimaInteracao: new Date(),

                    // Dados do imóvel — prioriza conversa, fallback para Contato
                    enderecoImovel: input.enderecoImovel || (contato as any).enderecoImovel || undefined,
                    tipoImovel: input.tipoImovel || (contato as any).tipoImovel || undefined,
                    areaImovel: input.areaImovel || undefined,
                    quartosImovel: input.quartosImovel || undefined,
                    vagasImovel: input.vagasImovel || undefined,
                    valorPretendido: input.valorPretendido || undefined,
                    ocupacaoImovel: input.ocupacaoImovel || undefined,
                    interesseEm: interesseMap[input.tipoInteresse] || input.tipoInteresse.toLowerCase(),

                    // Qualificação SPIN
                    motivacaoVenda: input.motivacaoVenda || undefined,
                    situacaoAtual: input.situacaoAtual || undefined,
                    prazoDesejado: input.prazoDesejado || input.timeline,
                    urgencia,
                    doresIdentificadas: input.doresIdentificadas || [],
                }
            });

            // Atualizar Contato
            await prisma.contato.update({
                where: { id: input.contatoId },
                data: {
                    virouLead: true,
                    leadId: novoLead.id,
                    virouLeadEm: new Date(),
                    statusProspeccao: 'LEAD',
                    manifestouInteresse: true
                }
            });

            // Registrar atividade
            const detalhes = [
                `Interesse: ${input.tipoInteresse}`,
                `Timeline: ${input.timeline}`,
                `Temperatura: ${input.temperatura}`,
                `Urgência: ${urgencia}`,
            ];
            if (input.tipoImovel) detalhes.push(`Tipo: ${input.tipoImovel}`);
            if (input.quartosImovel) detalhes.push(`Quartos: ${input.quartosImovel}`);
            if (input.areaImovel) detalhes.push(`Área: ${input.areaImovel}`);
            if (input.valorPretendido) detalhes.push(`Valor pretendido: ${input.valorPretendido}`);
            if (input.ocupacaoImovel) detalhes.push(`Ocupação: ${input.ocupacaoImovel}`);
            if (input.motivacaoVenda) detalhes.push(`Motivação: ${input.motivacaoVenda}`);
            if (input.doresIdentificadas?.length) detalhes.push(`Dores: ${input.doresIdentificadas.join(', ')}`);

            await prisma.atividade.create({
                data: {
                    leadId: novoLead.id,
                    tipo: 'NOTA',
                    titulo: '🎯 Lead qualificado via prospecção ativa',
                    descricao: detalhes.join('\n'),
                    criadoPor: 'sdr_ia',
                    completadoEm: new Date()
                }
            });

            // Se QUENTE, criar tarefa urgente
            if (input.temperatura === 'QUENTE') {
                await prisma.atividade.create({
                    data: {
                        leadId: novoLead.id,
                        tipo: 'TAREFA',
                        titulo: '🔥 URGENTE: Contato com lead quente!',
                        descricao: `Timeline: ${input.timeline}\nEntrar em contato o mais rápido possível!`,
                        criadoPor: 'sdr_ia'
                    }
                });
            }

            // RAG (background)
            ragConversasService.processarConversaoProspeccao({
                contatoId: input.contatoId,
                tenantId: contato.campanha.tenantId,
                tipoConversao: 'LEAD',
                empreendimento: contato.nomeEdificio || undefined
            }).catch(err => console.error('[RAG] Erro:', err));

            console.log(`[UseCase] converter_para_lead - Lead ${novoLead.id} criado com dados enriquecidos`);

            return {
                success: true,
                leadId: novoLead.id,
                temperatura: input.temperatura,
                message: `Proprietário convertido em lead ${input.temperatura}! Dados do imóvel salvos.`,
                reasonCode: 'CONVERTED'
            };
        } catch (error) {
            console.error('[UseCase] converter_para_lead - Erro:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao converter',
                reasonCode: 'DB_ERROR'
            };
        }
    }
}
