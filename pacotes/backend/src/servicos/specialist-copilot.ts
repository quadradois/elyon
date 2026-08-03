import { prisma } from '../lib/db';
import { obterSpecialistCopilotRollout } from './agenda-lifecycle-rollout';
import { executarDecisaoEspecialista } from './specialist-appointment-decision';
import {
  buscarConvitesAcionaveis,
  buscarCompromissosConfirmadosEspecialista,
  descreverConvitesParaDesambiguacao,
  resolverEspecialistaPorTelefone,
  type SpecialistInviteContext,
} from './specialist-copilot-context';
import { interpretarIntencaoEspecialista } from './specialist-copilot-intent';
import { sanitizarContextoEspecialista } from './specialist-copilot-privacy';
import { criarContrapropostaEspecialista } from './specialist-counterproposal';
import { resolverEspecialistaCampanha } from './resolucao-especialista-campanha';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda } from './coerencia-agenda-estado';
import crypto from 'node:crypto';
import { consultarAgendaEspecialista, formatarAgendaEspecialista } from './specialist-agenda-query';
import { registrarSpecialistCopilotEvento } from '../observabilidade/agenda-comercial-metrics';

export type SpecialistCopilotInboundResult = {
  handled: boolean;
  response?: string;
  reason: string;
};

function selecionarConvite(texto: string, convites: SpecialistInviteContext[]): SpecialistInviteContext | null {
  if (convites.length === 1) return convites[0];
  const selecao = texto.trim().match(/^(?:opcao\s*)?(\d+)\b/i);
  if (!selecao) return null;
  return convites[Number(selecao[1]) - 1] || null;
}

export async function processarInboundEspecialista(params: {
  tenantId: string;
  telefone: string;
  texto: string;
  providerEventId: string;
  agora?: Date;
}): Promise<SpecialistCopilotInboundResult> {
  const agora = params.agora || new Date();
  const rollout = await obterSpecialistCopilotRollout(params.tenantId, agora);
  if (!rollout.enabled) return { handled: false, reason: rollout.reason };

  const especialista = await resolverEspecialistaPorTelefone(params.tenantId, params.telefone);
  if (!especialista) return { handled: false, reason: 'SPECIALIST_NOT_RESOLVED' };

  const existente = await (prisma.interacaoEspecialistaAgenda as any).findUnique({
    where: { webhookEventoId: params.providerEventId }, select: { resultado: true },
  });
  if (existente) return { handled: true, reason: 'EVENT_REPLAY' };

  let convites = await buscarConvitesAcionaveis(especialista, agora);
  const intencao = interpretarIntencaoEspecialista(params.texto, agora);
  if (!convites.length && (intencao.name === 'CANCELAR_PARTICIPACAO' || intencao.name === 'CONSULTAR')) {
    convites = await buscarCompromissosConfirmadosEspecialista(especialista, agora);
  }
  if (!convites.length && intencao.name === 'CONSULTAR') {
    const agenda = await consultarAgendaEspecialista({ tenantId: params.tenantId, usuarioId: especialista.id });
    await (prisma.interacaoEspecialistaAgenda as any).create({
      data: {
        tenantId: params.tenantId, usuarioId: especialista.id, webhookEventoId: params.providerEventId,
        direcao: 'ENTRADA', intencao: intencao.name,
        resumoSanitizado: sanitizarContextoEspecialista(params.texto, 300), resultado: 'QUERY_SUCCESS',
      },
    });
    registrarSpecialistCopilotEvento(intencao.name, 'QUERY_SUCCESS');
    return { handled: true, reason: 'QUERY_SUCCESS', response: formatarAgendaEspecialista(agenda) };
  }
  if (!convites.length && intencao.name === 'CANCELAR_PARTICIPACAO') {
    return { handled: true, reason: 'NO_ACTIVE_APPOINTMENT', response: 'Você não possui atendimento ativo que possa ser cancelado por aqui.' };
  }
  if (!convites.length && ['CONFIRMAR', 'RECUSAR', 'CONTRAPROPOR'].includes(intencao.name)) {
    return { handled: true, reason: 'NO_ACTIONABLE_INVITE', response: 'Não há convite ativo para essa resposta. O prazo pode ter expirado ou a solicitação já pode ter sido atualizada. Consulte sua agenda atual.' };
  }
  if (!convites.length) return { handled: false, reason: 'NO_ACTIONABLE_INVITE' };

  const convite = selecionarConvite(params.texto, convites);
  const interacao = await (prisma.interacaoEspecialistaAgenda as any).create({
    data: {
      tenantId: params.tenantId, atividadeId: convite?.atividadeId || null, usuarioId: especialista.id,
      conviteId: convite?.conviteId || null, webhookEventoId: params.providerEventId,
      direcao: 'ENTRADA', intencao: intencao.name,
      resumoSanitizado: sanitizarContextoEspecialista(params.texto, 300),
      parametros: intencao.horarioProposto ? { horarioProposto: intencao.horarioProposto.toISOString() } : undefined,
      resultado: 'PROCESSANDO',
    },
  });

  if (!convite && intencao.name === 'CONSULTAR') {
    const agenda = await consultarAgendaEspecialista({ tenantId: params.tenantId, usuarioId: especialista.id });
    await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: 'QUERY_SUCCESS' } });
    return { handled: true, reason: 'QUERY_SUCCESS', response: formatarAgendaEspecialista(agenda) };
  }
  if (!convite) {
    await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: 'DESAMBIGUACAO_NECESSARIA' } });
    registrarSpecialistCopilotEvento(intencao.name, 'DESAMBIGUACAO_NECESSARIA');
    return { handled: true, reason: 'AMBIGUOUS_INVITE', response: descreverConvitesParaDesambiguacao(convites) };
  }

  if (intencao.name === 'CONFIRMAR' || intencao.name === 'RECUSAR') {
    const decisao = await executarDecisaoEspecialista({
      context: convite, decision: intencao.name, providerEventId: params.providerEventId,
      channel: 'WHATSAPP', ocorreuEm: agora,
    });
    await (prisma.interacaoEspecialistaAgenda as any).update({
      where: { id: interacao.id }, data: { resultado: decisao.reasonCode },
    });
    registrarSpecialistCopilotEvento(intencao.name, decisao.reasonCode);
    return { handled: true, reason: decisao.reasonCode, response: decisao.message };
  }

  if (intencao.name === 'CONTRAPROPOR') {
    const proposta = await criarContrapropostaEspecialista({
      context: convite, horario: intencao.horarioProposto!, providerEventId: params.providerEventId,
    });
    await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: proposta.reasonCode } });
    return { handled: true, reason: proposta.reasonCode, response: proposta.message };
  }

  if (intencao.name === 'CANCELAR_PARTICIPACAO') {
    const atividade = await prisma.atividade.findFirst({
      where: { id: convite.atividadeId, leadId: convite.leadId, lead: { tenantId: convite.tenantId } },
      include: { lead: { select: { campanhaOrigemId: true } } },
    });
    if (!atividade?.lead.campanhaOrigemId) {
      await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: 'NO_FALLBACK' } });
      return { handled: true, reason: 'NO_FALLBACK', response: 'Não encontrei substituto automático. O atendimento continua atribuído a você; avise a operação para evitar deixar o lead sem atendimento.' };
    }
    const fallback = await resolverEspecialistaCampanha({
      tenantId: convite.tenantId, campanhaId: atividade.lead.campanhaOrigemId,
      excluirUsuarioIds: [convite.usuarioId],
    });
    if (!fallback?.usuarioId) {
      await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: 'NO_FALLBACK' } });
      return { handled: true, reason: 'NO_FALLBACK', response: 'Não há especialista fallback elegível. Mantive o atendimento atual para não cancelar o compromisso do lead; avise a operação.' };
    }
    const resultado = await executarComandoAgenda({
      operacao: 'SOLICITAR', tenantId: convite.tenantId, leadId: convite.leadId, atividadeId: convite.atividadeId,
      requestIdentity: { source: 'INBOUND_BATCH', id: `${params.providerEventId}:cancel-participation` },
      ator: `especialista:${convite.usuarioId}`, origem: 'SPECIALIST_CANCELLED_PARTICIPATION',
      motivo: 'Especialista cancelou sua participação; atendimento preservado para fallback',
      policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: agora, expectedVersion: convite.versaoAtividade,
      manifestacaoLead: 'HORARIO_ACEITO', responsavelId: fallback.usuarioId,
      tokenConfirmacaoCorretor: crypto.randomUUID(),
    });
    await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: resultado.reasonCode } });
    if (!resultado.success && resultado.reasonCode !== 'COMMAND_REPLAY') {
      return { handled: true, reason: resultado.reasonCode, response: 'Não consegui registrar a substituição porque o atendimento mudou. Consulte a agenda atual.' };
    }
    await (prisma.conviteEspecialistaAgenda as any).updateMany({
      where: { atividadeId: convite.atividadeId, usuarioId: convite.usuarioId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
      data: { status: 'CANCELADO', respondidoEm: agora, origemResposta: 'WHATSAPP' },
    });
    return { handled: true, reason: 'REASSIGNMENT_REQUESTED', response: `Certo. Mantive o horário do lead e encaminhei a solicitação para ${fallback.nome}. Avisarei as partes quando houver confirmação.` };
  }

  if (intencao.name === 'CONSULTAR') {
    const agenda = await consultarAgendaEspecialista({ tenantId: params.tenantId, usuarioId: especialista.id });
    await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: 'QUERY_SUCCESS' } });
    return { handled: true, reason: 'QUERY_SUCCESS', response: formatarAgendaEspecialista(agenda) };
  }

  await (prisma.interacaoEspecialistaAgenda as any).update({ where: { id: interacao.id }, data: { resultado: 'INTENT_NOT_ACTIONABLE' } });
  return {
    handled: true,
    reason: 'INTENT_NOT_ACTIONABLE',
    response: 'Posso confirmar ou recusar esta solicitação. Você também pode responder, por exemplo, “posso amanhã às 10h”.',
  };
}
