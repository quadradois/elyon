import { prisma } from '../../lib/db';
import { getWhatsAppService } from '../../servicos/whatsapp';
import { resolverEspecialistaCampanha } from '../../servicos/resolucao-especialista-campanha';

export interface EncaminharCorretorInput {
    leadId: string;
    motivo: string;
    contextoConversa: string;
    urgencia: 'NORMAL' | 'ALTA';
}

export interface EncaminharCorretorOutput {
    success: boolean;
    leadId?: string;
    message?: string;
    especialista?: {
        nome: string;
        telefone: string;
        cargo?: string;
    };
    error?: string;
}

function normalizarTelefoneParaWaMe(telefone?: string | null): string {
    const digits = (telefone || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
}

export class EncaminharCorretorUseCase {
    async execute(input: EncaminharCorretorInput): Promise<EncaminharCorretorOutput> {
        try {
            console.log(`[UseCase] encaminhar_corretor - Lead ${input.leadId}`);

            const lead = await prisma.lead.findUnique({
                where: { id: input.leadId },
                include: { campanhaOrigem: true }
            });

            if (!lead) {
                return { success: false, error: 'Lead não encontrado' };
            }
            if (!lead.campanhaOrigem) {
                return { success: false, error: 'Lead sem campanha de origem' };
            }

            // Pausar a IA — sem isso o agente continua respondendo após o handoff
            await prisma.lead.update({
                where: { id: input.leadId },
                data: { modoAtendimento: 'HUMANO' }
            });

            // Criar tarefa
            await prisma.atividade.create({
                data: {
                    leadId: input.leadId,
                    tipo: 'TAREFA',
                    titulo: `${input.urgencia === 'ALTA' ? '🔥 URGENTE: ' : '📞 '}Proprietário solicitou contato`,
                    descricao: `Motivo: ${input.motivo}\n\nContexto:\n${input.contextoConversa}`,
                    criadoPor: 'sdr_ia'
                }
            });

            const tenant = await prisma.tenant.findUnique({
                where: { id: lead.campanhaOrigem.tenantId },
                select: {
                    nome: true,
                }
            });

            const especialista = await resolverEspecialistaCampanha({
                tenantId: lead.campanhaOrigem.tenantId,
                campanhaId: lead.campanhaOrigem.id,
            });
            const especialistaAtivo = !!especialista;

            if (especialistaAtivo) {
                const telefoneEspecialista = normalizarTelefoneParaWaMe(especialista!.telefone);
                const telefoneDestino = normalizarTelefoneParaWaMe(lead.telefone || '');
                const nomeEspecialista = String(especialista!.nome || '').trim();
                const cargoEspecialista = String(especialista!.cargo || 'Especialista').trim();

                if (telefoneDestino && telefoneEspecialista) {
                    const sessao = await prisma.sessaoWhatsapp.findFirst({
                        where: {
                            tenantId: lead.campanhaOrigem.tenantId,
                            status: { in: ['CONECTADO'] }
                        },
                        select: { instanceName: true },
                        orderBy: { atualizadoEm: 'desc' }
                    });

                    if (sessao?.instanceName) {
                        const whatsapp = getWhatsAppService(sessao.instanceName);
                        try {
                            await whatsapp.enviarContatoPadrao(telefoneDestino, {
                                fullName: nomeEspecialista,
                                phoneNumber: telefoneEspecialista,
                                organization: tenant?.nome || undefined,
                                email: especialista?.email || undefined,
                            });
                        } catch (erroCard) {
                            console.warn('[UseCase] encaminhar_corretor - Falha ao enviar card de contato, seguindo fallback texto:', erroCard);
                            const linkWa = `https://wa.me/${telefoneEspecialista}`;
                            await whatsapp.enviarMensagemTexto(
                                telefoneDestino,
                                `Antes do contato, salve este número do ${cargoEspecialista}: ${nomeEspecialista} (${telefoneEspecialista}). Link direto: ${linkWa}`
                            );
                        }
                    }
                }
            }

            console.log(`[UseCase] encaminhar_corretor - modoAtendimento=HUMANO, tarefa criada para lead ${input.leadId}`);

            return {
                success: true,
                leadId: input.leadId,
                message: especialistaAtivo
                    ? `Perfeito. O atendimento foi transferido para humano. Seu especialista ${especialista!.nome} fará contato ${input.urgencia === 'ALTA' ? 'imediatamente' : 'em breve'}.`
                    : `Corretor será notificado ${input.urgencia === 'ALTA' ? 'imediatamente' : 'em breve'}!`,
                especialista: especialistaAtivo ? {
                    nome: especialista!.nome,
                    telefone: especialista!.telefone,
                    cargo: especialista!.cargo || 'Especialista',
                } : undefined
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
