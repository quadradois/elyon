import { prisma } from '../../lib/db';
import { randomUUID } from 'crypto';
import { ragConversasService } from '../../servicos/rag-conversas';

export interface AgendarAvaliacaoInput {
    contatoId: string;
    dataAvaliacao: string;
}

export interface AgendarAvaliacaoOutput {
    success: boolean;
    message?: string;
    leadId?: string;
    atividadeId?: string;
    dataAgendamento?: string;
    error?: string;
}

export class AgendarAvaliacaoUseCase {
    async execute(input: AgendarAvaliacaoInput): Promise<AgendarAvaliacaoOutput> {
        try {
            console.log(`[UseCase] agendar_avaliacao - ID: ${input.contatoId}`);

            // Tentar buscar como Contato primeiro
            let contato = await prisma.contato.findUnique({
                where: { id: input.contatoId },
                include: { campanha: true }
            });

            // Se não encontrar como contato, pode ser um leadId - buscar contato pelo leadId
            if (!contato) {
                console.log(`[UseCase] agendar_avaliacao - Não é contato, buscando por leadId...`);
                contato = await prisma.contato.findFirst({
                    where: { leadId: input.contatoId },
                    include: { campanha: true }
                });
            }

            if (!contato) {
                console.log(`[UseCase] agendar_avaliacao - ERRO: Contato não encontrado para ID ${input.contatoId}`);
                return { success: false, error: 'Contato não encontrado' };
            }

            // Parsear data - aceita formatos variados
            let dataAgendamento: Date;
            const dataStr = input.dataAvaliacao.toLowerCase();

            // Detectar "amanhã" ou "hoje"
            const hoje = new Date();
            if (dataStr.includes('amanhã') || dataStr.includes('amanha')) {
                dataAgendamento = new Date(hoje);
                dataAgendamento.setDate(dataAgendamento.getDate() + 1);
                // Extrair hora se presente (ex: "amanhã às 10:00")
                const horaMatch = dataStr.match(/(\d{1,2})[:\s]*(\d{2})?/);
                if (horaMatch) {
                    dataAgendamento.setHours(parseInt(horaMatch[1]), parseInt(horaMatch[2] || '0'), 0, 0);
                } else {
                    dataAgendamento.setHours(10, 0, 0, 0); // Default 10:00
                }
            } else if (dataStr.includes('hoje')) {
                dataAgendamento = new Date(hoje);
                const horaMatch = dataStr.match(/(\d{1,2})[:\s]*(\d{2})?/);
                if (horaMatch) {
                    dataAgendamento.setHours(parseInt(horaMatch[1]), parseInt(horaMatch[2] || '0'), 0, 0);
                } else {
                    dataAgendamento.setHours(14, 0, 0, 0); // Default 14:00
                }
            } else {
                // Formato DD/MM/YYYY HH:mm
                const [dataParte, horaParte] = input.dataAvaliacao.split(' ');
                const [dia, mes, ano] = dataParte.split('/').map(Number);
                const [hora, minuto] = (horaParte || '10:00').split(':').map(Number);
                dataAgendamento = new Date(ano || hoje.getFullYear(), (mes || hoje.getMonth() + 1) - 1, dia || hoje.getDate(), hora || 10, minuto || 0);
            }

            if (isNaN(dataAgendamento.getTime())) {
                console.log(`[UseCase] agendar_avaliacao - ERRO: Data inválida: ${input.dataAvaliacao}`);
                return { success: false, error: 'Data inválida. Use DD/MM/YYYY HH:mm ou "amanhã às 10:00"' };
            }

            const tenantId = contato.campanha?.tenantId;
            if (!tenantId) {
                return { success: false, error: 'Campanha sem tenant' };
            }

            let leadId = contato.leadId;

            // Converter para Lead se necessário
            if (!contato.virouLead || !leadId) {
                const novoLead = await prisma.lead.create({
                    data: {
                        nome: contato.nome,
                        telefone: contato.telefone,
                        status: 'QUALIFICADO',
                        temperatura: 'QUENTE',
                        origem: 'PROSPECCAO_ATIVA',
                        tenantId,
                        cpf: contato.cpf
                    }
                });

                leadId = novoLead.id;

                await prisma.contato.update({
                    where: { id: input.contatoId },
                    data: { virouLead: true, leadId: novoLead.id, statusProspeccao: 'LEAD' }
                });
            }

            const db: any = prisma;
            const tokenConfirmacao = randomUUID();

            // Criar atividade de avaliação
            const atividade = await db.atividade.create({
                data: {
                    leadId: leadId!,
                    tipo: 'AVALIACAO',
                    titulo: `🏠 AVALIAÇÃO - ${contato.nome}`,
                    descricao: `📅 ${input.dataAvaliacao}\n📍 ${contato.enderecoImovel || 'Confirmar'}\n📞 ${contato.telefone}`,
                    criadoPor: 'sdr_agent',
                    agendadoPara: dataAgendamento,
                    statusAgendamento: 'PENDENTE',
                    tokenConfirmacao,
                    confirmacoesEnviadas: 0
                }
            });

            // Atualizar contato
            await prisma.contato.update({
                where: { id: input.contatoId },
                data: { statusProspeccao: 'INTERESSADO', observacoes: `Avaliação: ${input.dataAvaliacao}` }
            });

            // RAG (background)
            ragConversasService.processarConversaoProspeccao({
                contatoId: input.contatoId,
                tenantId,
                tipoConversao: 'AGENDAMENTO',
                empreendimento: contato.nomeEdificio || undefined
            }).catch(err => console.error('[RAG] Erro:', err));

            console.log(`[UseCase] agendar_avaliacao - Agendado para ${input.dataAvaliacao}`);

            return {
                success: true,
                message: `Avaliação agendada para ${input.dataAvaliacao}`,
                leadId,
                atividadeId: atividade.id,
                dataAgendamento: dataAgendamento.toISOString()
            };
        } catch (error) {
            console.error('[UseCase] agendar_avaliacao - Erro:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao agendar'
            };
        }
    }
}
