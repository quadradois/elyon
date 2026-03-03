import { prisma } from '../../lib/db';

export interface EncaminharCorretorInput {
    contatoId: string;
    motivo: string;
    contextoConversa: string;
    urgencia: 'NORMAL' | 'ALTA';
}

export interface EncaminharCorretorOutput {
    success: boolean;
    leadId?: string;
    message?: string;
    error?: string;
}

export class EncaminharCorretorUseCase {
    async execute(input: EncaminharCorretorInput): Promise<EncaminharCorretorOutput> {
        try {
            console.log(`[UseCase] encaminhar_corretor - Contato ${input.contatoId}`);

            const contato = await prisma.contato.findUnique({
                where: { id: input.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return { success: false, error: 'Contato não encontrado' };
            }

            let leadId = contato.leadId;

            // Converter se necessário
            if (!contato.virouLead) {
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
                        temperatura: input.urgencia === 'ALTA' ? 'QUENTE' : 'MORNO',
                        estagio: 'encaminhado_corretor',
                        primeiroContato: contato.criadoEm,
                        ultimaInteracao: new Date()
                    }
                });

                leadId = novoLead.id;

                await prisma.contato.update({
                    where: { id: input.contatoId },
                    data: { virouLead: true, leadId: novoLead.id, virouLeadEm: new Date(), statusProspeccao: 'LEAD' }
                });
            }

            // Criar tarefa
            await prisma.atividade.create({
                data: {
                    leadId: leadId!,
                    tipo: 'TAREFA',
                    titulo: `${input.urgencia === 'ALTA' ? '🔥 URGENTE: ' : '📞 '}Proprietário solicitou contato`,
                    descricao: `Motivo: ${input.motivo}\n\nContexto:\n${input.contextoConversa}`,
                    criadoPor: 'sdr_ia'
                }
            });

            console.log(`[UseCase] encaminhar_corretor - Tarefa criada para lead ${leadId}`);

            return {
                success: true,
                leadId: leadId || undefined,
                message: `Corretor será notificado ${input.urgencia === 'ALTA' ? 'imediatamente' : 'em breve'}!`
            };
        } catch (error: any) {
            console.error('[UseCase] encaminhar_corretor - Erro:', error);
            return {
                success: false,
                error: error.message || 'Erro ao encaminhar'
            };
        }
    }
}
