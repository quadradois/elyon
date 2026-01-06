import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { verificarAutenticacao } from '../middleware/middleware-auth';

const router = Router();

// ====================================
// GET /api/agenda - Listar Eventos
// ====================================
router.get('/', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId; // Injetado pelo middleware
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        // Filtros de data (obrigatórios para boa performance)
        const start = req.query.start ? new Date(req.query.start as string) : new Date();
        const end = req.query.end ? new Date(req.query.end as string) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias default

        // Busca todas as atividades com data agendada
        // Inclui BLOQUEIOS (que serão tarefas com título específico ou tipo novo)
        const atividades = await prisma.atividade.findMany({
            where: {
                lead: { tenantId }, // Garante isolamento por tenant
                agendadoPara: {
                    gte: start,
                    lte: end
                },
                // Exclui cancelados
                statusAgendamento: { not: 'CANCELADO' }
            },
            include: {
                lead: {
                    select: { id: true, nome: true, telefone: true }
                }
            },
            orderBy: { agendadoPara: 'asc' }
        });

        // Formatar para FullCalendar / Frontend Standard
        const eventos = atividades.map(a => ({
            id: a.id,
            title: a.titulo, // Ex: "Visita com João", "Bloqueio"
            start: a.agendadoPara,
            end: a.duracao ? new Date(a.agendadoPara!.getTime() + a.duracao * 60000) : new Date(a.agendadoPara!.getTime() + 60 * 60000), // Default 1h
            allDay: false,
            extendedProps: {
                tipo: a.tipo,
                status: a.statusAgendamento,
                leadId: a.leadId,
                leadNome: a.lead?.nome || 'Desconhecido',
                leadTelefone: a.lead?.telefone || '',
                descricao: a.descricao
            },
            // Color coding básico
            backgroundColor:
                a.titulo.includes('BLOQUEIO') ? '#ff4d4f' : // Vermelho para bloqueio
                    a.tipo === 'AVALIACAO' ? '#1890ff' :        // Azul para visitas/avaliação
                        a.tipo === 'REUNIAO' ? '#52c41a' :          // Verde para reuniões
                            '#faad14',                                  // Amarelo para tarefas/outros
        }));

        res.json(eventos);

    } catch (error) {
        console.error('[Agenda] Erro ao listar eventos:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ====================================
// POST /api/agenda/bloqueio - Bloquear Horário
// ====================================
const BloqueioSchema = z.object({
    inicio: z.string().datetime(),
    fim: z.string().datetime().optional(), // Se não vier, assume 1h
    motivo: z.string().default('Bloqueio de Agenda'),
});

router.post('/bloqueio', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        const body = BloqueioSchema.parse(req.body);
        const dataInicio = new Date(body.inicio);

        // Para criar um bloqueio, precisamos associar a um Lead (DB constraint).
        // WORKAROUND: Associar a um "Lead Sistema" ou ao primeiro lead que acharmos (perigoso)
        // MELHOR: Criar/Buscar um Lead "Corretor" ou "Agenda" para pendurar esses eventos.
        // VAMOS TENTAR: Buscar um lead "Interno" ou criar on-the-fly.

        let leadInterno = await prisma.lead.findFirst({
            where: {
                tenantId,
                nome: 'Agenda Interna'
            }
        });

        if (!leadInterno) {
            leadInterno = await prisma.lead.create({
                data: {
                    tenantId,
                    nome: 'Agenda Interna',
                    telefone: '00000000000',
                    status: 'INATIVO', // Para não aparecer em listas comerciais
                    origem: 'SISTEMA'
                }
            });
        }

        // Calcular duração em minutos
        const duracaoMin = body.fim
            ? Math.round((new Date(body.fim).getTime() - dataInicio.getTime()) / 60000)
            : 60;

        const bloqueio = await prisma.atividade.create({
            data: {
                leadId: leadInterno.id,
                tipo: 'TAREFA', // Usamos TAREFA pois não tem enum BLOQUEIO ainda
                titulo: `🚫 BLOQUEIO: ${body.motivo}`,
                descricao: 'Horário bloqueado pelo corretor.',
                agendadoPara: dataInicio,
                duracao: duracaoMin,
                statusAgendamento: 'CONFIRMADO',
                criadoPor: 'corretor'
            }
        });

        res.json({ sucesso: true, bloqueio });

    } catch (error) {
        console.error('[Agenda] Erro ao criar bloqueio:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
        }
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ====================================
// GET /api/agenda/bloqueios - Listar Bloqueios
// ====================================
router.get('/bloqueios', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        const bloqueios = await prisma.atividade.findMany({
            where: {
                lead: { tenantId },
                titulo: { contains: 'BLOQUEIO' },
                statusAgendamento: { not: 'CANCELADO' }
            },
            orderBy: { agendadoPara: 'asc' },
            select: {
                id: true,
                titulo: true,
                agendadoPara: true,
                duracao: true,
                descricao: true
            }
        });

        res.json(bloqueios);
    } catch (error) {
        console.error('[Agenda] Erro ao listar bloqueios:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ====================================
// DELETE /api/agenda/bloqueio/:id - Excluir Bloqueio
// ====================================
router.delete('/bloqueio/:id', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        // Verificar se bloqueio existe e pertence ao tenant
        const bloqueio = await prisma.atividade.findFirst({
            where: { id },
            include: { lead: { select: { tenantId: true } } }
        });

        if (!bloqueio) {
            return res.status(404).json({ erro: 'Bloqueio não encontrado' });
        }

        if (bloqueio.lead.tenantId !== tenantId) {
            return res.status(403).json({ erro: 'Sem permissão' });
        }

        // Deletar o bloqueio
        await prisma.atividade.delete({ where: { id } });

        res.json({ sucesso: true, mensagem: 'Bloqueio excluído com sucesso' });
    } catch (error) {
        console.error('[Agenda] Erro ao excluir bloqueio:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ====================================
// GET /api/agenda/conflitos - Verificar Disponibilidade
// ====================================
router.get('/conflitos', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        const horario = req.query.horario ? new Date(req.query.horario as string) : null;
        if (!horario) return res.status(400).json({ erro: 'Horário obrigatório' });

        // Margem de segurança de 1 hora (simples)
        // Ideal: usar range exato start/end
        const start = new Date(horario.getTime() - 59 * 60000); // 1h antes
        const end = new Date(horario.getTime() + 59 * 60000);   // 1h depois

        const conflitos = await prisma.atividade.findMany({
            where: {
                lead: { tenantId },
                agendadoPara: {
                    gt: start,
                    lt: end
                },
                statusAgendamento: { not: 'CANCELADO' }
            }
        });

        res.json({
            disponivel: conflitos.length === 0,
            conflitos: conflitos.map(c => ({
                titulo: c.titulo,
                horario: c.agendadoPara,
                tipo: c.tipo
            }))
        });

    } catch (error) {
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ====================================
// POST /api/agenda/:id/aprovar - Aprovar Agendamento
// ====================================
router.post('/:id/aprovar', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        // 1. Buscar a atividade com dados do lead
        const atividade = await prisma.atividade.findUnique({
            where: { id },
            include: {
                lead: {
                    select: { id: true, nome: true, telefone: true, tenantId: true }
                }
            }
        });

        if (!atividade) {
            return res.status(404).json({ erro: 'Agendamento não encontrado' });
        }

        // Verificar se pertence ao tenant
        if (atividade.lead.tenantId !== tenantId) {
            return res.status(403).json({ erro: 'Sem permissão para este agendamento' });
        }

        // 2. Atualizar status para CONFIRMADO
        const atividadeAtualizada = await prisma.atividade.update({
            where: { id },
            data: {
                statusAgendamento: 'CONFIRMADO',
                confirmadoPor: req.usuario?.email || 'corretor',
                confirmadoEm: new Date()
            }
        });

        // 3. Buscar sessão WhatsApp do tenant para enviar mensagem
        const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
            where: { tenantId, status: 'CONECTADO' }
        });

        if (sessaoWhatsapp && atividade.lead.telefone) {
            try {
                // Formatar data para exibição
                const dataFormatada = atividade.agendadoPara
                    ? new Date(atividade.agendadoPara).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'data a confirmar';

                const mensagemConfirmacao = `✅ *Visita Confirmada!*

Olá, ${atividade.lead.nome}! 

Sua avaliação foi confirmada pelo corretor para:
📅 ${dataFormatada}

Aguardamos você! Se precisar reagendar, é só me avisar. 🏡`;

                // Importar serviço WhatsApp
                const { getWhatsAppService } = await import('../servicos/whatsapp');
                const whatsapp = getWhatsAppService(sessaoWhatsapp.instanceName);

                await whatsapp.enviarMensagemTexto(
                    atividade.lead.telefone,
                    mensagemConfirmacao
                );

                console.log(`[Agenda] Confirmação enviada para ${atividade.lead.telefone}`);
            } catch (whatsappError) {
                console.error('[Agenda] Erro ao enviar WhatsApp:', whatsappError);
                // Não falha a aprovação se o WhatsApp falhar
            }
        }

        res.json({
            sucesso: true,
            mensagem: 'Agendamento aprovado com sucesso',
            atividade: atividadeAtualizada
        });

    } catch (error) {
        console.error('[Agenda] Erro ao aprovar:', error);
        res.status(500).json({ erro: 'Erro interno ao aprovar agendamento' });
    }
});

// ====================================
// GET /api/agenda/expediente - Obter Configuração de Expediente
// ====================================
router.get('/expediente', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { expedienteSemanal: true }
        });

        // Se não tem configurado, retorna padrão (seg-sex 08-18)
        if (!tenant?.expedienteSemanal) {
            const padrao = {
                dias: [
                    { diaSemana: 0, ativo: false, inicio: '08:00', fim: '18:00' }, // Dom
                    { diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' },  // Seg
                    { diaSemana: 2, ativo: true, inicio: '08:00', fim: '18:00' },  // Ter
                    { diaSemana: 3, ativo: true, inicio: '08:00', fim: '18:00' },  // Qua
                    { diaSemana: 4, ativo: true, inicio: '08:00', fim: '18:00' },  // Qui
                    { diaSemana: 5, ativo: true, inicio: '08:00', fim: '17:00' },  // Sex
                    { diaSemana: 6, ativo: false, inicio: '08:00', fim: '12:00' }  // Sáb
                ],
                almocoAtivo: true,
                almocoInicio: '12:00',
                almocoFim: '13:00'
            };
            return res.json(padrao);
        }

        res.json(tenant.expedienteSemanal);
    } catch (error) {
        console.error('[Agenda] Erro ao buscar expediente:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ====================================
// PUT /api/agenda/expediente - Atualizar Configuração de Expediente
// ====================================
router.put('/expediente', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(401).json({ erro: 'Não autorizado' });

        const { dias, almocoAtivo, almocoInicio, almocoFim } = req.body;

        // Validação básica
        if (!dias || !Array.isArray(dias) || dias.length !== 7) {
            return res.status(400).json({ erro: 'Configuração de dias inválida. Deve conter 7 dias.' });
        }

        const expediente = {
            dias,
            almocoAtivo: almocoAtivo ?? false,
            almocoInicio: almocoInicio || '12:00',
            almocoFim: almocoFim || '13:00'
        };

        await prisma.tenant.update({
            where: { id: tenantId },
            data: { expedienteSemanal: expediente }
        });

        res.json({ sucesso: true, mensagem: 'Expediente atualizado com sucesso', expediente });
    } catch (error) {
        console.error('[Agenda] Erro ao atualizar expediente:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

export default router;
