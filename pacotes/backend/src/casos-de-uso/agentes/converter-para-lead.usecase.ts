import { prisma } from '../../lib/db';
import { mergeSchemaStateComSources } from './source-of-truth';
import { normalizarPrazoEUrgencia, temTexto } from './governanca-campos';

export interface ConverterParaLeadInput {
    leadId: string;
    temperatura: 'MORNO' | 'QUENTE';
    tipoInteresse: 'VENDA' | 'LOCACAO' | 'AMBOS';
    timeline?: string;
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

function pareceValorMonetario(texto?: string | null): boolean {
    const t = (texto || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
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

export class ConverterParaLeadUseCase {
    async execute(input: ConverterParaLeadInput): Promise<ConverterParaLeadOutput> {
        try {
            console.log(`[UseCase] converter_para_lead - Lead ${input.leadId}`);

            const lead = await prisma.lead.findUnique({
                where: { id: input.leadId },
                select: {
                    id: true,
                    statusProspeccao: true,
                    tipoImovel: true,
                    areaImovel: true,
                    quartosImovel: true,
                    vagasImovel: true,
                    valorPretendido: true,
                    ocupacaoImovel: true,
                    interesseEm: true,
                    motivacaoVenda: true,
                    situacaoAtual: true,
                    prazoDesejado: true,
                    urgencia: true,
                    doresIdentificadas: true,
                    schemaState: true,
                }
            });

            if (!lead) {
                return {
                    success: false,
                    error: 'Lead não encontrado',
                    reasonCode: 'CONTACT_NOT_FOUND'
                };
            }

            const areaImovelInformada = temTexto(input.areaImovel) ? input.areaImovel!.trim() : undefined;
            const areaPareceValor = pareceValorMonetario(areaImovelInformada);
            const areaImovelNormalizada = areaPareceValor ? undefined : areaImovelInformada;
            const valorPretendidoNormalizado = temTexto(input.valorPretendido)
                ? input.valorPretendido!.trim()
                : areaPareceValor
                    ? areaImovelInformada
                    : undefined;

            const { prazoDesejadoNormalizado, urgencia } = normalizarPrazoEUrgencia({
                timeline: input.timeline,
                prazoDesejado: input.prazoDesejado
            });

            const interesseMap: Record<string, string> = {
                'VENDA': 'vender',
                'LOCACAO': 'alugar',
                'AMBOS': 'ambos'
            };
            const interesseEm = interesseMap[input.tipoInteresse] || input.tipoInteresse.toLowerCase();

            const updateData: any = {
                statusProspeccao: null,
                status: 'NOVO',
                temperatura: input.temperatura,
                ultimaInteracao: new Date(),
            };

            if (input.tipoImovel && input.tipoImovel !== lead.tipoImovel) updateData.tipoImovel = input.tipoImovel;
            if (areaImovelNormalizada && areaImovelNormalizada !== lead.areaImovel) updateData.areaImovel = areaImovelNormalizada;
            if (input.quartosImovel && input.quartosImovel !== lead.quartosImovel) updateData.quartosImovel = input.quartosImovel;
            if (input.vagasImovel !== undefined && input.vagasImovel !== null && input.vagasImovel !== lead.vagasImovel) updateData.vagasImovel = input.vagasImovel;
            if (valorPretendidoNormalizado && valorPretendidoNormalizado !== lead.valorPretendido) updateData.valorPretendido = valorPretendidoNormalizado;
            if (input.ocupacaoImovel && input.ocupacaoImovel !== lead.ocupacaoImovel) updateData.ocupacaoImovel = input.ocupacaoImovel;
            if (interesseEm && interesseEm !== lead.interesseEm) updateData.interesseEm = interesseEm;
            if (input.motivacaoVenda && input.motivacaoVenda !== lead.motivacaoVenda) updateData.motivacaoVenda = input.motivacaoVenda;
            if (input.situacaoAtual && input.situacaoAtual !== lead.situacaoAtual) updateData.situacaoAtual = input.situacaoAtual;
            if (prazoDesejadoNormalizado && prazoDesejadoNormalizado !== lead.prazoDesejado) updateData.prazoDesejado = prazoDesejadoNormalizado;
            if (urgencia && urgencia !== lead.urgencia) updateData.urgencia = urgencia;
            if (input.doresIdentificadas?.length) {
                const doresAtuais = Array.isArray(lead.doresIdentificadas) ? lead.doresIdentificadas : [];
                const doresMescladas = Array.from(new Set([...doresAtuais, ...input.doresIdentificadas]));
                if (doresMescladas.length > 0) updateData.doresIdentificadas = doresMescladas;
            }

            const schemaUpdatesTool: Record<string, unknown> = {
                interesseEm,
                temperatura: input.temperatura,
                tipoImovel: input.tipoImovel,
                areaImovel: areaImovelNormalizada,
                quartosImovel: input.quartosImovel,
                vagasImovel: input.vagasImovel,
                valorPretendido: valorPretendidoNormalizado,
                ocupacaoImovel: input.ocupacaoImovel,
                motivacaoVenda: input.motivacaoVenda,
                situacaoAtual: input.situacaoAtual,
                prazoDesejado: prazoDesejadoNormalizado,
                urgencia,
                doresIdentificadas: input.doresIdentificadas?.length ? input.doresIdentificadas : undefined,
            };
            const schemaStateAtual = (lead.schemaState as any) || undefined;
            updateData.schemaState = mergeSchemaStateComSources(
                schemaStateAtual,
                schemaUpdatesTool,
                'tool_confirmada',
                'dados atualizados via converter_para_lead'
            ) as any;

            await prisma.lead.update({
                where: { id: input.leadId },
                data: updateData
            });

            await prisma.atividade.create({
                data: {
                    leadId: input.leadId,
                    tipo: 'NOTA',
                    titulo: '🎯 Lead promovido da prospecção para CRM',
                    descricao: `Interesse: ${input.tipoInteresse}\nTemperatura: ${input.temperatura}${urgencia ? `\nUrgência: ${urgencia}` : ''}${input.tipoImovel ? `\nTipo: ${input.tipoImovel}` : ''}${valorPretendidoNormalizado ? `\nValor pretendido: ${valorPretendidoNormalizado}` : ''}${input.motivacaoVenda ? `\nMotivação: ${input.motivacaoVenda}` : ''}`,
                    criadoPor: 'sdr_ia',
                    completadoEm: new Date()
                }
            });

            if (input.temperatura === 'QUENTE') {
                await prisma.atividade.create({
                    data: {
                        leadId: input.leadId,
                        tipo: 'TAREFA',
                        titulo: '🔥 URGENTE: Contato com lead quente!',
                        descricao: `Timeline: ${input.timeline || 'não informada'}\nEntrar em contato o mais rápido possível!`,
                        criadoPor: 'sdr_ia'
                    }
                });
            }

            console.log(`[UseCase] converter_para_lead - Lead ${input.leadId} promovido para CRM`);

            return {
                success: true,
                leadId: input.leadId,
                temperatura: input.temperatura,
                message: `Lead promovido com sucesso para CRM!`,
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
