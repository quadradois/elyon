import { prisma } from '../../lib/db';
import { ragConversasService } from '../../servicos/rag-conversas';
import { mergeSchemaStateComSources } from './source-of-truth';
import { normalizarPrazoEUrgencia, temTexto } from './governanca-campos';

export interface ConverterParaLeadInput {
    contatoId: string;
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

            // Mapear interesse para o enum esperado
            const interesseMap: Record<string, string> = {
                'VENDA': 'vender',
                'LOCACAO': 'alugar',
                'AMBOS': 'ambos'
            };
            const interesseEm = interesseMap[input.tipoInteresse] || input.tipoInteresse.toLowerCase();
            const enderecoImovelNormalizado = input.enderecoImovel || (contato as any).enderecoImovel || undefined;
            const tipoImovelNormalizado = input.tipoImovel || (contato as any).tipoImovel || undefined;

            const schemaUpdatesTool: Record<string, unknown> = {
                interesseEm,
                temperatura: input.temperatura,
                enderecoImovel: input.enderecoImovel,
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
            const schemaUpdatesBriefing: Record<string, unknown> = {
                enderecoImovel: !input.enderecoImovel ? (contato as any).enderecoImovel : undefined,
                tipoImovel: !input.tipoImovel ? (contato as any).tipoImovel : undefined,
            };
            let schemaState = mergeSchemaStateComSources(
                undefined,
                schemaUpdatesTool,
                'tool_confirmada',
                'dados coletados via conversa'
            );
            schemaState = mergeSchemaStateComSources(
                schemaState,
                schemaUpdatesBriefing,
                'briefing',
                'fallback de dados do contato'
            );

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
                    enderecoImovel: enderecoImovelNormalizado,
                    tipoImovel: tipoImovelNormalizado,
                    areaImovel: areaImovelNormalizada || undefined,
                    quartosImovel: input.quartosImovel || undefined,
                    vagasImovel: input.vagasImovel || undefined,
                    valorPretendido: valorPretendidoNormalizado || undefined,
                    ocupacaoImovel: input.ocupacaoImovel || undefined,
                    interesseEm,

                    // Qualificação SPIN
                    motivacaoVenda: input.motivacaoVenda || undefined,
                    situacaoAtual: input.situacaoAtual || undefined,
                    prazoDesejado: prazoDesejadoNormalizado,
                    urgencia,
                    doresIdentificadas: input.doresIdentificadas || [],
                    schemaState: schemaState as any,
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
                `Temperatura: ${input.temperatura}`,
            ];
            if (timelineEhConfiavel) detalhes.push(`Timeline: ${input.timeline}`);
            if (urgencia) detalhes.push(`Urgência: ${urgencia}`);
            if (input.tipoImovel) detalhes.push(`Tipo: ${input.tipoImovel}`);
            if (input.quartosImovel) detalhes.push(`Quartos: ${input.quartosImovel}`);
            if (areaImovelNormalizada) detalhes.push(`Área: ${areaImovelNormalizada}`);
            if (valorPretendidoNormalizado) detalhes.push(`Valor pretendido: ${valorPretendidoNormalizado}`);
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
                        descricao: `Timeline: ${input.timeline || 'não informada'}\nEntrar em contato o mais rápido possível!`,
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
