import { prisma } from '../../lib/db';
import { getWhatsAppService } from '../../servicos/whatsapp';
import { resolverEspecialistaCampanha } from '../../servicos/resolucao-especialista-campanha';

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
            console.log(`[UseCase] encaminhar_corretor - Contato ${input.contatoId}`);

            const contato = await prisma.contato.findUnique({
                where: { id: input.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return { success: false, error: 'Contato não encontrado' };
            }
            if (!contato.campanha) {
                return { success: false, error: 'Contato sem campanha de origem' };
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

            // Pausar a IA — sem isso o agente continua respondendo após o handoff
            await prisma.contato.update({
                where: { id: input.contatoId },
                data: { modoAtendimento: 'HUMANO' }
            });

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

            const tenant = await prisma.tenant.findUnique({
                where: { id: contato.campanha.tenantId },
                select: {
                    nome: true,
                }
            });

            const especialista = await resolverEspecialistaCampanha({
                tenantId: contato.campanha.tenantId,
                campanhaId: contato.campanha.id,
            });
            const especialistaAtivo = !!especialista;

            if (especialistaAtivo) {
                const telefoneEspecialista = normalizarTelefoneParaWaMe(especialista!.telefone);
                const telefoneDestino = normalizarTelefoneParaWaMe(contato.telefone || '');
                const nomeEspecialista = String(especialista!.nome || '').trim();
                const cargoEspecialista = String(especialista!.cargo || 'Especialista').trim();

                if (telefoneDestino && telefoneEspecialista) {
                    const sessao = await prisma.sessaoWhatsapp.findFirst({
                        where: {
                            tenantId: contato.campanha.tenantId,
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

            console.log(`[UseCase] encaminhar_corretor - modoAtendimento=HUMANO, tarefa criada para lead ${leadId}`);

            return {
                success: true,
                leadId: leadId || undefined,
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
