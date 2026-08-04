import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda } from './coerencia-agenda-estado';
import { formatarDataHoraAgenda } from './notificacao-agendamento';
import type { SpecialistInviteContext } from './specialist-copilot-context';

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

async function horarioDisponivel(params: {
  tenantId: string;
  usuarioId: string;
  horario: Date;
  ignorarAtividadeId?: string;
  duracaoMinutos?: number;
}): Promise<boolean> {
  const duracao = params.duracaoMinutos || 30;
  const inicio = params.horario;
  const fim = new Date(inicio.getTime() + duracao * 60_000);
  const conflitos = await prisma.atividade.findMany({
    where: {
      id: params.ignorarAtividadeId ? { not: params.ignorarAtividadeId } : undefined,
      corretorAtualId: params.usuarioId,
      lead: { tenantId: params.tenantId },
      statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] },
      agendadoPara: { lt: fim },
    },
    select: { agendadoPara: true, duracao: true },
  });
  return !conflitos.some((item) => {
    if (!item.agendadoPara) return false;
    const conflitoFim = new Date(item.agendadoPara.getTime() + (item.duracao || 30) * 60_000);
    return item.agendadoPara < fim && conflitoFim > inicio;
  });
}

export async function criarContrapropostaEspecialista(params: {
  context: SpecialistInviteContext;
  horario: Date;
  providerEventId: string;
}): Promise<{ success: boolean; reasonCode: string; message: string }> {
  const disponivel = await horarioDisponivel({
    tenantId: params.context.tenantId, usuarioId: params.context.usuarioId,
    horario: params.horario, ignorarAtividadeId: params.context.atividadeId,
  });
  if (!disponivel) return { success: false, reasonCode: 'SLOT_UNAVAILABLE', message: 'Esse horário já está ocupado na sua agenda. Sugira outro horário, por favor.' };

  const atividade = await prisma.atividade.findFirst({
    where: { id: params.context.atividadeId, leadId: params.context.leadId, lead: { tenantId: params.context.tenantId } },
    select: { id: true, versao: true },
  });
  if (!atividade || atividade.versao !== params.context.versaoAtividade) {
    return { success: false, reasonCode: 'STALE_EVENT', message: 'A solicitação foi atualizada. Consulte o estado atual antes de sugerir outro horário.' };
  }

  const proposta = await prisma.$transaction(async (tx) => {
    await (tx.contrapropostaAgenda as any).updateMany({
      where: { tenantId: params.context.tenantId, atividadeId: atividade.id, status: 'AGUARDANDO_LEAD' },
      data: { status: 'INVALIDADA', respondidaEm: new Date() },
    });
    const criada = await (tx.contrapropostaAgenda as any).create({
      data: {
        tenantId: params.context.tenantId, atividadeId: atividade.id, conviteId: params.context.conviteId,
        propostaPorTipo: 'ESPECIALISTA', propostaPorId: params.context.usuarioId,
        horarioProposto: params.horario, status: 'AGUARDANDO_LEAD', versaoAtividadeOrigem: atividade.versao,
      },
    });
    await tx.efeitoAgendaOutbox.create({
      data: {
        chaveComando: `counterproposal:${criada.id}`,
        chaveIdempotencia: hash(['counterproposal-lead', criada.id]),
        tenantId: params.context.tenantId, leadId: params.context.leadId, atividadeId: atividade.id,
        tipo: 'SUBSTITUICAO',
        mensagem: `${params.context.leadNome}, o especialista sugeriu ${formatarDataHoraAgenda(params.horario)}. Esse novo horário funciona para você?`,
        destinatarioTipo: 'LEAD', correlationId: params.providerEventId,
      },
    });
    return criada;
  });
  return {
    success: true, reasonCode: 'COUNTERPROPOSAL_CREATED',
    message: `Ótimo, vou consultar o lead sobre ${formatarDataHoraAgenda(proposta.horarioProposto)}. O horário atual permanece válido até ele responder.`,
  };
}

function interpretarRespostaLead(texto: string): 'ACEITAR' | 'RECUSAR' | null {
  const normal = texto.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/^(sim|ok|pode ser|aceito|confirmo|esse horario funciona)[.! ]*$/.test(normal)) return 'ACEITAR';
  if (/^(nao|nao posso|nao funciona|prefiro outro|recuso)[.! ]*$/.test(normal)) return 'RECUSAR';
  return null;
}

export async function processarRespostaLeadContraproposta(params: {
  tenantId: string;
  leadId: string;
  texto: string;
  providerEventId: string;
  agora?: Date;
}): Promise<{ handled: boolean; response?: string; reasonCode: string }> {
  const decisao = interpretarRespostaLead(params.texto);
  if (!decisao) return { handled: false, reasonCode: 'NOT_A_COUNTERPROPOSAL_RESPONSE' };
  const atividades = await prisma.atividade.findMany({
    where: { leadId: params.leadId, lead: { tenantId: params.tenantId } }, select: { id: true },
  });
  const propostas = await (prisma.contrapropostaAgenda as any).findMany({
    where: { tenantId: params.tenantId, atividadeId: { in: atividades.map((item) => item.id) }, status: 'AGUARDANDO_LEAD' },
    orderBy: { criadoEm: 'desc' }, take: 2,
  });
  if (propostas.length !== 1) return { handled: false, reasonCode: propostas.length ? 'AMBIGUOUS_COUNTERPROPOSAL' : 'NO_COUNTERPROPOSAL' };
  const proposta = propostas[0];
  if (decisao === 'RECUSAR') {
    await (prisma.contrapropostaAgenda as any).updateMany({
      where: { id: proposta.id, status: 'AGUARDANDO_LEAD' }, data: { status: 'RECUSADA', respondidaEm: params.agora || new Date() },
    });
    return { handled: true, reasonCode: 'COUNTERPROPOSAL_DECLINED', response: 'Tudo bem. Mantive o agendamento atual e vou buscar outra alternativa com o especialista.' };
  }

  const atividade = await prisma.atividade.findFirst({
    where: { id: proposta.atividadeId, leadId: params.leadId, lead: { tenantId: params.tenantId } },
    include: { lead: { select: { nome: true } } },
  });
  if (!atividade || atividade.versao !== proposta.versaoAtividadeOrigem || !atividade.corretorAtualId) {
    await (prisma.contrapropostaAgenda as any).updateMany({ where: { id: proposta.id, status: 'AGUARDANDO_LEAD' }, data: { status: 'INVALIDADA', respondidaEm: new Date() } });
    return { handled: true, reasonCode: 'STALE_EVENT', response: 'Esse horário não está mais disponível no contexto atual. Vou buscar novas opções.' };
  }
  const disponivel = await horarioDisponivel({
    tenantId: params.tenantId, usuarioId: atividade.corretorAtualId,
    horario: proposta.horarioProposto, ignorarAtividadeId: atividade.id, duracaoMinutos: atividade.duracao || 30,
  });
  if (!disponivel) {
    await (prisma.contrapropostaAgenda as any).updateMany({ where: { id: proposta.id, status: 'AGUARDANDO_LEAD' }, data: { status: 'INVALIDADA', respondidaEm: new Date() } });
    return { handled: true, reasonCode: 'SLOT_UNAVAILABLE', response: 'Esse horário acabou de ficar indisponível. Vou pedir novas opções ao especialista.' };
  }

  const agora = params.agora || new Date();
  const result = await executarComandoAgenda({
    operacao: 'REAGENDAR', tenantId: params.tenantId, leadId: params.leadId, atividadeId: atividade.id,
    requestIdentity: { source: 'INBOUND_BATCH', id: `${params.providerEventId}:accept-counterproposal` },
    ator: `ai_agent:lead:${params.leadId}`, origem: 'LEAD_ACCEPTED_SPECIALIST_COUNTERPROPOSAL',
    motivo: 'Lead aceitou contraproposta do especialista', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
    ocorridoEm: agora, expectedVersion: atividade.versao, novoHorario: proposta.horarioProposto,
    responsavelId: atividade.corretorAtualId, confirmarResponsavel: true,
    notificacoes: [
      { tipo: 'REAGENDAMENTO', mensagem: `Novo horário confirmado: ${formatarDataHoraAgenda(proposta.horarioProposto)}.`, destinatarioTipo: 'LEAD' },
      { tipo: 'REAGENDAMENTO', mensagem: `${atividade.lead.nome} aceitou sua sugestão. Atendimento confirmado para ${formatarDataHoraAgenda(proposta.horarioProposto)}.`, destinatarioTipo: 'USUARIO', usuarioDestinoId: atividade.corretorAtualId },
    ],
  });
  if (!result.success && result.reasonCode !== 'COMMAND_REPLAY') {
    return { handled: true, reasonCode: result.reasonCode, response: 'Não consegui concluir a mudança porque o agendamento foi atualizado. Vou consultar o estado atual.' };
  }
  await prisma.$transaction([
    (prisma.contrapropostaAgenda as any).updateMany({
      where: { id: proposta.id, status: 'AGUARDANDO_LEAD' },
      data: { status: 'ACEITA', respondidaEm: agora, atividadeResultanteId: result.atividadeResultanteId },
    }),
    (prisma.conviteEspecialistaAgenda as any).updateMany({
      where: { atividadeId: atividade.id, status: 'PENDENTE' }, data: { status: 'SUBSTITUIDO', respondidoEm: agora },
    }),
  ]);
  return { handled: true, reasonCode: result.reasonCode };
}
