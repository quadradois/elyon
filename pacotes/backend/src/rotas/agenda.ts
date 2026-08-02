import { responderErro } from '../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { verificarAutenticacao } from '../middleware/middleware-auth';
import { googleCalendarService } from '../servicos/google-calendar';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda, type AgendaCommand } from '../servicos/coerencia-agenda-estado';
import { obterAgendaPolicy, type AgendaPolicyAction } from '../servicos/agenda-policy';
import { obterAgendaLifecycleRollout, type AgendaLifecycleRollout } from '../servicos/agenda-lifecycle-rollout';
import { agendaLifecycleExpiredPending, agendaLifecycleOperationalQueueAgeSeconds } from '../observabilidade/agenda-comercial-metrics';
import { formatarDataHoraAgenda, montarMensagemLigacaoConfirmada } from '../servicos/notificacao-agendamento';

const router = Router();

const LEGACY_VISIBLE_ACTIONS: AgendaPolicyAction[] = ['CANCELAR', 'REAGENDAR'];

function obterAcoesVisiveis(
    policyActions: AgendaPolicyAction[],
    rollout: AgendaLifecycleRollout,
): AgendaPolicyAction[] {
    if (rollout.commandsEnabled) return policyActions;
    if (rollout.policyEnabled) {
        return policyActions.filter((action) => action === 'CANCELAR' || action === 'REAGENDAR');
    }
    return LEGACY_VISIBLE_ACTIONS;
}

async function obterAgoraBanco(): Promise<Date> {
    const [clock] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`;
    return clock.now;
}

const AgendaCommandSchema = z.object({
    command: z.enum(['SOLICITAR', 'PROPOR', 'RECUSAR', 'CONFIRMAR_ATRIBUICAO', 'CANCELAR', 'REAGENDAR', 'REALIZAR', 'NAO_COMPARECEU', 'CORRIGIR']),
    expectedVersion: z.number().int().nonnegative(),
    reasonCode: z.string().trim().min(1).max(100),
    justification: z.string().trim().max(500).optional(),
    channel: z.enum(['WHATSAPP', 'PAINEL', 'LINK_PUBLICO', 'JOB', 'INTEGRACAO']),
    scheduledFor: z.string().datetime().optional(),
    responsibleId: z.string().uuid().optional(),
    correctedStatus: z.enum(['REALIZADO', 'NAO_COMPARECEU', 'CANCELADO']).optional(),
    leadManifestation: z.enum(['HORARIO_ESCOLHIDO', 'HORARIO_ACEITO']).optional(),
});

async function obterVisaoAgenda(id: string, tenantId: string, ator: 'ADMIN' | 'OPERADOR' | 'PUBLICO' = 'OPERADOR') {
    const atividade = await prisma.atividade.findFirst({
        where: { id, lead: { tenantId } },
        include: { lead: { select: { id: true } } },
    });
    if (!atividade) return null;
    const agora = await obterAgoraBanco();
    const rollout = await obterAgendaLifecycleRollout(tenantId, agora);
    const policy = obterAgendaPolicy({
        status: atividade.statusAgendamento,
        agendadoPara: atividade.agendadoPara,
        duracaoMinutos: atividade.duracao,
        agora,
        ator,
    });
    return {
        id: atividade.id,
        leadId: atividade.lead.id,
        status: atividade.statusAgendamento,
        temporalPhase: policy.faseTemporal,
        version: atividade.versao,
        allowedActions: obterAcoesVisiveis(policy.allowedActions, rollout),
        blockedReasons: !rollout.policyEnabled || policy.reasonCode === 'ALLOWED'
            ? {} : { lifecycle: policy.reasonCode },
        lifecyclePolicyEnabled: rollout.policyEnabled,
        lifecycleCommandsEnabled: rollout.commandsEnabled,
        scheduledFor: atividade.agendadoPara,
        durationMinutes: atividade.duracao,
        responsibleId: atividade.corretorAtualId,
    };
}

// ====================================
// GET /api/agenda - Listar Eventos
// ====================================
router.get('/', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId; // Injetado pelo middleware
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

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

        const corretorIds = [...new Set(
            atividades.map(atividade => atividade.corretorAtualId).filter(Boolean)
        )] as string[];
        const corretores = corretorIds.length > 0
            ? await prisma.usuario.findMany({
                where: { tenantId, id: { in: corretorIds } },
                select: { id: true, nome: true }
            })
            : [];
        const nomeCorretorPorId = new Map(corretores.map(corretor => [corretor.id, corretor.nome]));

        // Formatar para FullCalendar / Frontend Standard
        const agora = await obterAgoraBanco();
        const rollout = await obterAgendaLifecycleRollout(tenantId, agora);
        const atorPolicy = req.usuario?.papel === 'ADMIN' ? 'ADMIN' as const : 'OPERADOR' as const;
        const eventos = atividades.map(a => {
            const policy = obterAgendaPolicy({
                status: a.statusAgendamento,
                agendadoPara: a.agendadoPara,
                duracaoMinutos: a.duracao,
                agora,
                ator: atorPolicy,
            });
            return ({
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
                descricao: a.descricao,
                especialistaId: a.corretorAtualId || null,
                especialistaNome: a.corretorAtualId
                    ? nomeCorretorPorId.get(a.corretorAtualId) || null
                    : null,
                statusConfirmacaoCorretor: a.statusConfirmacaoCorretor || null,
                versao: a.versao,
                faseTemporal: policy.faseTemporal,
                allowedActions: obterAcoesVisiveis(policy.allowedActions, rollout),
                policyReasonCode: rollout.policyEnabled ? policy.reasonCode : 'LEGACY_COMPATIBILITY',
                lifecyclePolicyEnabled: rollout.policyEnabled,
                lifecycleCommandsEnabled: rollout.commandsEnabled,
            },
            // Color coding básico
            backgroundColor:
                a.titulo.includes('BLOQUEIO') ? '#ff4d4f' : // Vermelho para bloqueio
                    a.tipo === 'AVALIACAO' ? '#1890ff' :        // Azul para visitas/avaliação
                        a.tipo === 'REUNIAO' ? '#52c41a' :          // Verde para reuniões
                            '#faad14',                                  // Amarelo para tarefas/outros
            });
        });

        res.json(eventos);

    } catch (error) {
        console.error('[Agenda] Erro ao listar eventos:', error);
        responderErro(res, 500, 'Erro interno');
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
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

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
                    status: 'ARQUIVADO', // Para não aparecer em listas comerciais
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
            return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
        }
        responderErro(res, 500, 'Erro interno');
    }
});

// ====================================
// GET /api/agenda/bloqueios - Listar Bloqueios
// ====================================
router.get('/bloqueios', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

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
        responderErro(res, 500, 'Erro interno');
    }
});

// ====================================
// DELETE /api/agenda/bloqueio/:id - Excluir Bloqueio
// ====================================
router.delete('/bloqueio/:id', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

        // Verificar se bloqueio existe e pertence ao tenant
        const bloqueio = await prisma.atividade.findFirst({
            where: { id },
            include: { lead: { select: { tenantId: true } } }
        });

        if (!bloqueio) {
            return responderErro(res, 404, 'Bloqueio não encontrado');
        }

        if (bloqueio.lead.tenantId !== tenantId) {
            return responderErro(res, 403, 'Sem permissão');
        }

        // Bloqueios também preservam histórico: a remoção operacional é um cancelamento lógico.
        await prisma.atividade.update({
            where: { id },
            data: {
                statusAgendamento: 'CANCELADO',
                canceladoPor: req.usuario?.email || 'operador',
                canceladoEm: new Date(),
                motivoCancelamento: 'Bloqueio removido pelo operador',
                versao: { increment: 1 },
                estadoAgendaAtualizadoEm: new Date(),
            },
        });

        res.json({ sucesso: true, mensagem: 'Bloqueio excluído com sucesso' });
    } catch (error) {
        console.error('[Agenda] Erro ao excluir bloqueio:', error);
        responderErro(res, 500, 'Erro interno');
    }
});

// ====================================
// GET /api/agenda/conflitos - Verificar Disponibilidade
// ====================================
router.get('/conflitos', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

        const horario = req.query.horario ? new Date(req.query.horario as string) : null;
        if (!horario) return responderErro(res, 400, 'Horário obrigatório');

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
        responderErro(res, 500, 'Erro interno');
    }
});

// ====================================
// POST /api/agenda/:id/aprovar - Aprovar Agendamento
// ====================================
router.get('/:id([0-9a-fA-F-]{36})', verificarAutenticacao, async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId) return responderErro(res, 401, 'Não autorizado');
    const ator = req.usuario?.papel === 'ADMIN' ? 'ADMIN' : 'OPERADOR';
    const appointment = await obterVisaoAgenda(req.params.id, tenantId, ator);
    if (!appointment) return responderErro(res, 404, 'Agendamento não encontrado');
    return res.json(appointment);
});

router.get('/pendencias/vencidas', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');
        const agora = await obterAgoraBanco();
        const rollout = await obterAgendaLifecycleRollout(tenantId, agora);
        if (!rollout.commandsEnabled) return res.json([]);
        const atividades = await prisma.atividade.findMany({
            where: {
                lead: { tenantId },
                tipo: { in: ['AVALIACAO', 'REUNIAO'] },
                statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] },
                agendadoPara: { lt: agora },
            },
            include: { lead: { select: { nome: true } } },
            orderBy: { agendadoPara: 'asc' },
        });
        const ator = req.usuario?.papel === 'ADMIN' ? 'ADMIN' as const : 'OPERADOR' as const;
        agendaLifecycleExpiredPending.set(atividades.length);
        const oldest = atividades[0]?.agendadoPara;
        agendaLifecycleOperationalQueueAgeSeconds.set(oldest
            ? Math.max(0, Math.floor((agora.getTime() - oldest.getTime()) / 1_000)) : 0);
        return res.json(atividades.map((atividade) => {
            const policy = obterAgendaPolicy({
                status: atividade.statusAgendamento, agendadoPara: atividade.agendadoPara,
                duracaoMinutos: atividade.duracao, agora, ator,
            });
            return {
                id: atividade.id,
                leadNome: atividade.lead.nome,
                scheduledFor: atividade.agendadoPara,
                status: atividade.statusAgendamento,
                version: atividade.versao,
                temporalPhase: policy.faseTemporal,
                allowedActions: policy.allowedActions,
                pendingAgeMinutes: atividade.agendadoPara
                    ? Math.max(0, Math.floor((agora.getTime() - atividade.agendadoPara.getTime()) / 60_000))
                    : 0,
                responsibleId: atividade.corretorAtualId,
                operationalReason: atividade.corretorAtualId ? 'OUTCOME_PENDING' : 'SPECIALIST_PENDING',
            };
        }));
    } catch (error) {
        console.error('[Agenda] Erro ao listar pendências vencidas:', error);
        return responderErro(res, 500, 'Erro interno');
    }
});

router.post('/:id/commands', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');
        const rollout = await obterAgendaLifecycleRollout(tenantId, await obterAgoraBanco());
        if (!rollout.commandsEnabled) {
            return responderErro(res, 404, 'AGENDA_LIFECYCLE_COMMANDS_DISABLED');
        }
        const idempotencyKey = req.header('Idempotency-Key')?.trim();
        if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
            return responderErro(res, 400, 'Idempotency-Key inválida');
        }
        const body = AgendaCommandSchema.parse(req.body || {});
        if (body.command === 'CORRIGIR' && req.usuario?.papel !== 'ADMIN') {
            return responderErro(res, 403, 'Correção exige papel administrativo');
        }
        if (body.command === 'CORRIGIR' && (!body.justification || body.justification.length < 10 || !body.correctedStatus)) {
            return responderErro(res, 400, 'JUSTIFICATION_REQUIRED');
        }
        const atividade = await prisma.atividade.findFirst({
            where: { id: req.params.id, lead: { tenantId } },
            select: { id: true, leadId: true },
        });
        if (!atividade) return responderErro(res, 404, 'Agendamento não encontrado');
        const ocorridoEm = new Date();
        const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
        const ator = `${req.usuario?.papel === 'ADMIN' ? 'admin' : 'operador'}:${req.usuario?.email || 'usuario'}`;
        const base = {
            tenantId, leadId: atividade.leadId, atividadeId: atividade.id,
            requestIdentity: { source: 'MANUAL_API' as const, id: idempotencyKey },
            ator, origem: `API_AGENDA_${body.channel}`, motivo: body.reasonCode,
            policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm,
            expectedVersion: body.expectedVersion,
            correlationId: req.header('x-correlation-id') || idempotencyKey,
        };
        let command: AgendaCommand;
        switch (body.command) {
            case 'REAGENDAR':
                if (!scheduledFor) return responderErro(res, 400, 'scheduledFor é obrigatório');
                command = { ...base, operacao: 'REAGENDAR', novoHorario: scheduledFor };
                break;
            case 'PROPOR':
                if (!scheduledFor) return responderErro(res, 400, 'scheduledFor é obrigatório');
                command = { ...base, operacao: 'PROPOR', novoHorario: scheduledFor, manifestacaoLead: 'PROPOSTA_OPERADOR' };
                break;
            case 'SOLICITAR':
                if (!body.leadManifestation) return responderErro(res, 400, 'leadManifestation é obrigatória');
                command = { ...base, operacao: 'SOLICITAR', novoHorario: scheduledFor, manifestacaoLead: body.leadManifestation };
                break;
            case 'CONFIRMAR_ATRIBUICAO':
                command = { ...base, operacao: 'CONFIRMAR_ATRIBUICAO', responsavelId: body.responsibleId };
                break;
            case 'RECUSAR':
                command = { ...base, operacao: 'RECUSAR' };
                break;
            case 'REALIZAR':
                command = { ...base, operacao: 'REALIZAR' };
                break;
            case 'NAO_COMPARECEU':
                command = { ...base, operacao: 'NO_SHOW', parteAusente: 'LEAD' };
                break;
            case 'CORRIGIR':
                command = { ...base, operacao: 'CORRIGIR', estadoCorrigido: body.correctedStatus!, justificativa: body.justification! };
                break;
            default:
                command = { ...base, operacao: 'CANCELAR' };
        }
        const result = await executarComandoAgenda(command);
        const appointment = await obterVisaoAgenda(atividade.id, tenantId, req.usuario?.papel === 'ADMIN' ? 'ADMIN' : 'OPERADOR');
        if (!result.success) {
            return res.status(result.transient ? 503 : 409).json({ code: result.reasonCode, message: result.reasonCode, appointment });
        }
        const resultingId = result.atividadeResultanteId || atividade.id;
        const resultingAppointment = resultingId === atividade.id
            ? appointment
            : await obterVisaoAgenda(resultingId, tenantId, req.usuario?.papel === 'ADMIN' ? 'ADMIN' : 'OPERADOR');
        return res.json({ applied: !result.replay, replayed: Boolean(result.replay), correlationId: command.correlationId, appointment: resultingAppointment });
    } catch (error) {
        if (error instanceof z.ZodError) return responderErro(res, 400, 'Dados inválidos', { detalhes: error.errors });
        console.error('[Agenda] Erro no comando canônico:', error);
        return responderErro(res, 500, 'Erro interno ao executar comando');
    }
});

router.post('/:id/aprovar', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

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
            return responderErro(res, 404, 'Agendamento não encontrado');
        }

        // Verificar se pertence ao tenant
        if (atividade.lead.tenantId !== tenantId) {
            return responderErro(res, 403, 'Sem permissão para este agendamento');
        }

        if ((atividade as any).statusConfirmacaoCorretor === 'CONFIRMADO') {
            return res.json({
                sucesso: true,
                mensagem: 'Ligação já confirmada anteriormente',
                atividade
            });
        }

        const corretor = (atividade as any).corretorAtualId
            ? await prisma.usuario.findFirst({
                where: { id: (atividade as any).corretorAtualId, tenantId },
                select: { nome: true }
            })
            : null;
        const mensagemConfirmacao = montarMensagemLigacaoConfirmada({
            leadNome: atividade.lead.nome,
            agendadoPara: atividade.agendadoPara,
            especialistaNome: corretor?.nome,
        });

        const result = await executarComandoAgenda({
            operacao: 'CONFIRMAR_ATRIBUICAO', tenantId, leadId: atividade.lead.id, atividadeId: id,
            requestIdentity: { source: 'MANUAL_API', id: req.header('Idempotency-Key') || `legacy-approve:${id}:${atividade.versao}` },
            ator: req.usuario?.email || 'corretor', origem: 'API_AGENDA_LEGACY', motivo: 'Aceite do especialista',
            policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: new Date(), expectedVersion: atividade.versao,
            responsavelId: (atividade as any).corretorAtualId || undefined,
            notificacao: { tipo: 'CONFIRMACAO', mensagem: mensagemConfirmacao },
        });
        if (!result.success) return responderErro(res, result.transient ? 503 : 409, result.reasonCode);
        const atividadeAtualizada = await prisma.atividade.findUniqueOrThrow({ where: { id } });

        res.json({
            sucesso: true,
            mensagem: 'Agendamento aprovado. A notificação foi enfileirada com segurança.',
            notificacaoLeadEnviada: false,
            notificacaoRegistradaNoHistorico: false,
            atividade: atividadeAtualizada
        });

    } catch (error) {
        console.error('[Agenda] Erro ao aprovar:', error);
        responderErro(res, 500, 'Erro interno ao aprovar agendamento');
    }
});

const CancelarAgendamentoSchema = z.object({
    motivo: z.string().trim().max(500).optional(),
    avisarCliente: z.boolean().optional().default(true),
    requestId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
});

router.post('/:id/cancelar', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

        const body = CancelarAgendamentoSchema.parse(req.body || {});

        const atividade = await prisma.atividade.findUnique({
            where: { id },
            include: { lead: { select: { id: true, nome: true, telefone: true, tenantId: true } } }
        });
        if (!atividade) return responderErro(res, 404, 'Agendamento não encontrado');
        if (atividade.lead.tenantId !== tenantId) return responderErro(res, 403, 'Sem permissão para este agendamento');

        const mensagemNotificacao = `⚠️ *Atualização do agendamento*

Olá, ${atividade.lead.nome}.
Seu atendimento de ${formatarDataHoraAgenda(atividade.agendadoPara)} foi cancelado.${body.motivo ? `\nMotivo: ${body.motivo}` : ''}

Se quiser, já te proponho novos horários para reagendar.`;

        const result = await executarComandoAgenda({
            operacao: 'CANCELAR', tenantId, leadId: atividade.lead.id, atividadeId: id,
            requestIdentity: { source: 'MANUAL_API', id: body.requestId },
            ator: req.usuario?.email || 'corretor', origem: 'API_AGENDA',
            motivo: body.motivo || 'Cancelamento pelo operador', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
            ocorridoEm: new Date(), expectedVersion: body.expectedVersion,
            notificacao: body.avisarCliente ? { tipo: 'CANCELAMENTO', mensagem: mensagemNotificacao } : undefined,
        });
        if (!result.success) return responderErro(res, result.transient ? 503 : result.reasonCode === 'REQUEST_ID_CONFLICT' ? 409 : 422, result.reasonCode);
        const atividadeAtualizada = await prisma.atividade.findUniqueOrThrow({ where: { id } });

        return res.json({ sucesso: true, mensagem: 'Agendamento cancelado com sucesso', atividade: atividadeAtualizada });
    } catch (error) {
        console.error('[Agenda] Erro ao cancelar:', error);
        if (error instanceof z.ZodError) return responderErro(res, 400, 'Dados inválidos', { detalhes: error.errors });
        return responderErro(res, 500, 'Erro interno ao cancelar agendamento');
    }
});

const ReagendarAgendamentoSchema = z.object({
    novoHorario: z.string().datetime(),
    motivo: z.string().trim().max(500).optional(),
    avisarCliente: z.boolean().optional().default(true),
    requestId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
});

router.post('/:id/reagendar', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

        const body = ReagendarAgendamentoSchema.parse(req.body || {});
        const novoHorario = new Date(body.novoHorario);
        if (isNaN(novoHorario.getTime())) return responderErro(res, 400, 'novoHorario inválido');

        const atividade = await prisma.atividade.findUnique({
            where: { id },
            include: { lead: { select: { id: true, nome: true, telefone: true, tenantId: true } } }
        });
        if (!atividade) return responderErro(res, 404, 'Agendamento não encontrado');
        if (atividade.lead.tenantId !== tenantId) return responderErro(res, 403, 'Sem permissão para este agendamento');

        const mensagemNotificacao = `📅 *Reagendamento de atendimento*

Olá, ${atividade.lead.nome}.
Seu atendimento foi reagendado para:
${formatarDataHoraAgenda(novoHorario)}${body.motivo ? `\nMotivo: ${body.motivo}` : ''}

Pode me confirmar se esse horário funciona para você?`;

        const result = await executarComandoAgenda({
            operacao: 'REAGENDAR', tenantId, leadId: atividade.lead.id, atividadeId: id,
            requestIdentity: { source: 'MANUAL_API', id: body.requestId },
            ator: req.usuario?.email || 'corretor', origem: 'API_AGENDA',
            motivo: body.motivo || 'Reagendamento pelo operador', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
            ocorridoEm: new Date(), expectedVersion: body.expectedVersion, novoHorario,
            notificacao: body.avisarCliente ? { tipo: 'REAGENDAMENTO', mensagem: mensagemNotificacao } : undefined,
        });
        if (!result.success) return responderErro(res, result.transient ? 503 : result.reasonCode === 'REQUEST_ID_CONFLICT' ? 409 : 422, result.reasonCode);
        const atividadeAtualizada = await prisma.atividade.findUniqueOrThrow({ where: { id: result.atividadeResultanteId } });

        return res.json({ sucesso: true, mensagem: 'Agendamento reagendado com sucesso', atividade: atividadeAtualizada });
    } catch (error) {
        console.error('[Agenda] Erro ao reagendar:', error);
        if (error instanceof z.ZodError) return responderErro(res, 400, 'Dados inválidos', { detalhes: error.errors });
        return responderErro(res, 500, 'Erro interno ao reagendar agendamento');
    }
});

const ProporNovoHorarioSchema = z.object({
    horarioProposto: z.string().datetime(),
    mensagem: z.string().trim().max(500).optional(),
});

router.post('/:id/propor-horario', verificarAutenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

        const body = ProporNovoHorarioSchema.parse(req.body || {});
        const horarioProposto = new Date(body.horarioProposto);
        if (isNaN(horarioProposto.getTime())) return responderErro(res, 400, 'horarioProposto inválido');

        const atividade = await prisma.atividade.findUnique({
            where: { id },
            include: { lead: { select: { id: true, nome: true, telefone: true, tenantId: true } } }
        });
        if (!atividade) return responderErro(res, 404, 'Agendamento não encontrado');
        if (atividade.lead.tenantId !== tenantId) return responderErro(res, 403, 'Sem permissão para este agendamento');

        const mensagem = body.mensagem?.trim() || `Oi, ${atividade.lead.nome}! 😊

Te proponho este novo horário para o atendimento:
${formatarDataHoraAgenda(horarioProposto)}

Se não funcionar, me fala que te envio outras opções.`;

        const result = await executarComandoAgenda({
            operacao: 'PROPOR', tenantId, leadId: atividade.lead.id, atividadeId: id,
            requestIdentity: { source: 'MANUAL_API', id: req.header('Idempotency-Key') || `legacy-propose:${id}:${atividade.versao}:${horarioProposto.toISOString()}` },
            ator: req.usuario?.email || 'corretor', origem: 'API_AGENDA_LEGACY', motivo: 'Proposta de horário pelo operador',
            policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: new Date(), expectedVersion: atividade.versao,
            novoHorario: horarioProposto, manifestacaoLead: 'PROPOSTA_OPERADOR',
            notificacao: { tipo: 'SOLICITACAO', mensagem },
        });
        if (!result.success) return responderErro(res, result.transient ? 503 : 409, result.reasonCode);
        const atividadeAtualizada = await prisma.atividade.findUniqueOrThrow({ where: { id } });

        return res.json({
            sucesso: true,
            mensagem: 'Novo horário proposto; notificação enfileirada.',
            notificacaoLeadEnviada: false,
            notificacaoRegistradaNoHistorico: false,
            atividade: atividadeAtualizada,
        });
    } catch (error) {
        console.error('[Agenda] Erro ao propor novo horário:', error);
        if (error instanceof z.ZodError) return responderErro(res, 400, 'Dados inválidos', { detalhes: error.errors });
        return responderErro(res, 500, 'Erro interno ao propor novo horário');
    }
});

// ====================================
// GET /api/agenda/expediente - Obter Configuração de Expediente
// ====================================
router.get('/expediente', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

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
        responderErro(res, 500, 'Erro interno');
    }
});

// ====================================
// PUT /api/agenda/expediente - Atualizar Configuração de Expediente
// ====================================
router.put('/expediente', verificarAutenticacao, async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return responderErro(res, 401, 'Não autorizado');

        const { dias, almocoAtivo, almocoInicio, almocoFim } = req.body;

        // Validação básica
        if (!dias || !Array.isArray(dias) || dias.length !== 7) {
            return responderErro(res, 400, 'Configuração de dias inválida. Deve conter 7 dias.');
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
        responderErro(res, 500, 'Erro interno');
    }
});

export default router;

// ====================================
// GET /api/agenda/google-calendar/status — Health Check
// ====================================
router.get('/google-calendar/status', verificarAutenticacao, async (_req, res) => {
    try {
        const status = await googleCalendarService.healthCheck();
        res.json(status);
    } catch (error) {
        console.error('[Agenda] Erro no health check Google Calendar:', error);
        responderErro(res, 500, 'Erro interno');
    }
});

// ====================================
// GET /api/agenda/google-calendar/slots — Slots Livres
// ====================================
const SlotsQuerySchema = z.object({
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    duracaoMinutos: z.coerce.number().min(15).max(120).optional(),
});

router.get('/google-calendar/slots', verificarAutenticacao, async (req, res) => {
    try {
        if (!googleCalendarService.isConfigurado()) {
            return responderErro(res, 503, 'Google Calendar não configurado neste tenant.');
        }

        const query = SlotsQuerySchema.parse(req.query);
        const slots = await googleCalendarService.consultarSlotsLivres({
            dataInicio: query.dataInicio ? new Date(query.dataInicio) : undefined,
            dataFim: query.dataFim ? new Date(query.dataFim) : undefined,
            duracaoMinutos: query.duracaoMinutos,
        });

        res.json({
            total: slots.length,
            slots,
            formatado: googleCalendarService.formatarSlotsParaWhatsApp(slots),
        });
    } catch (error: any) {
        console.error('[Agenda] Erro ao buscar slots Google Calendar:', error);
        if (error instanceof z.ZodError) {
            return responderErro(res, 400, 'Parâmetros inválidos', { detalhes: error.errors });
        }
        responderErro(res, 500, error.message || 'Erro interno');
    }
});

// ====================================
// GET /api/agenda/google-calendar/disponibilidade — Verificar horário específico
// ====================================
router.get('/google-calendar/disponibilidade', verificarAutenticacao, async (req, res) => {
    try {
        if (!googleCalendarService.isConfigurado()) {
            return responderErro(res, 503, 'Google Calendar não configurado.');
        }

        const horario = req.query.horario as string;
        if (!horario) return responderErro(res, 400, 'Parâmetro "horario" é obrigatório (ISO 8601).');

        const resultado = await googleCalendarService.verificarDisponibilidade(
            new Date(horario),
            req.query.duracao ? Number(req.query.duracao) : undefined
        );

        res.json(resultado);
    } catch (error: any) {
        console.error('[Agenda] Erro ao verificar disponibilidade:', error);
        responderErro(res, 500, error.message || 'Erro interno');
    }
});

// ====================================
// GET /api/agenda/google-calendar/link-agendamento — Link público de agendamento
// ====================================
router.get('/google-calendar/link-agendamento', verificarAutenticacao, async (req, res) => {
    try {
        const titulo = (req.query.titulo as string) || 'Reunião com Consultor Imobiliário';
        const link = googleCalendarService.gerarLinkAgendamento({ titulo });
        res.json({ link });
    } catch (error: any) {
        console.error('[Agenda] Erro ao gerar link agendamento:', error);
        responderErro(res, 500, error.message || 'Erro interno');
    }
});
