import { prisma } from '../lib/db';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda } from './coerencia-agenda-estado';
import { enviarWhatsappAgendamento, montarMensagemLigacaoConfirmada } from './notificacao-agendamento';
import { remanejarCorretorAtividade } from './remanejamento-corretor';
import type { SpecialistInviteContext } from './specialist-copilot-context';
import { obterAgendaEffectsRollout } from './agenda-lifecycle-rollout';

export type SpecialistDecision = 'CONFIRMAR' | 'RECUSAR';

export type SpecialistDecisionResult = {
  success: boolean;
  replay?: boolean;
  reasonCode: string;
  message: string;
};

export async function executarDecisaoEspecialista(params: {
  context: SpecialistInviteContext;
  decision: SpecialistDecision;
  providerEventId: string;
  channel: 'WHATSAPP' | 'LINK_PUBLICO';
  motivo?: string;
  ocorreuEm?: Date;
}): Promise<SpecialistDecisionResult> {
  const ocorreuEm = params.ocorreuEm || new Date();
  const atividade = await prisma.atividade.findFirst({
    where: {
      id: params.context.atividadeId, leadId: params.context.leadId,
      corretorAtualId: params.context.usuarioId, lead: { tenantId: params.context.tenantId },
    },
    include: { lead: { select: { id: true, nome: true, telefone: true, tenantId: true } } },
  });
  if (!atividade || atividade.versao !== params.context.versaoAtividade) {
    return { success: false, reasonCode: 'STALE_EVENT', message: 'Esta solicitação já foi atualizada e não aceita mais essa resposta.' };
  }
  const invite = await (prisma.conviteEspecialistaAgenda as any).findFirst({
    where: {
      id: params.context.conviteId, tenantId: params.context.tenantId,
      usuarioId: params.context.usuarioId, atividadeId: atividade.id, status: 'PENDENTE',
    },
  });
  if (!invite || invite.prazoEm <= ocorreuEm) {
    return { success: false, reasonCode: 'INVITE_EXPIRED', message: 'O prazo desta solicitação expirou. Vou considerar apenas a atribuição mais recente.' };
  }

  const origem = params.channel === 'WHATSAPP' ? 'WHATSAPP_SPECIALIST_COPILOT' : 'LINK_CONFIRMACAO_CORRETOR';
  const requestIdentity = { source: params.channel === 'WHATSAPP' ? 'INBOUND_BATCH' as const : 'PUBLIC_TOKEN' as const, id: params.providerEventId };
  const effects = await obterAgendaEffectsRollout(params.context.tenantId, ocorreuEm);
  const especialistaNome = (await prisma.usuario.findUnique({ where: { id: params.context.usuarioId }, select: { nome: true } }))?.nome;
  const mensagemConfirmacao = montarMensagemLigacaoConfirmada({
    leadNome: atividade.lead.nome, agendadoPara: atividade.agendadoPara, especialistaNome,
  });
  const command = params.decision === 'CONFIRMAR'
    ? await executarComandoAgenda({
        operacao: 'CONFIRMAR_ATRIBUICAO', tenantId: params.context.tenantId, leadId: atividade.lead.id,
        atividadeId: atividade.id, requestIdentity, ator: `especialista:${params.context.usuarioId}`,
        origem, motivo: params.motivo || 'Aceite do especialista', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
        ocorridoEm: ocorreuEm, expectedVersion: atividade.versao, responsavelId: params.context.usuarioId,
        notificacao: effects.effectsEnabled ? {
          tipo: 'CONFIRMACAO',
          mensagem: mensagemConfirmacao,
        } : undefined,
      })
    : await executarComandoAgenda({
        operacao: 'RECUSAR', tenantId: params.context.tenantId, leadId: atividade.lead.id,
        atividadeId: atividade.id, requestIdentity, ator: `especialista:${params.context.usuarioId}`,
        origem, motivo: params.motivo || 'Recusa do especialista', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
        ocorridoEm: ocorreuEm, expectedVersion: atividade.versao,
      });

  if (!command.success && command.reasonCode !== 'COMMAND_REPLAY') {
    return { success: false, reasonCode: command.reasonCode, message: 'Não consegui registrar essa resposta porque a solicitação mudou. Consulte a agenda atual antes de tentar novamente.' };
  }
  await (prisma.conviteEspecialistaAgenda as any).updateMany({
    where: { id: invite.id, status: 'PENDENTE' },
    data: { status: params.decision === 'CONFIRMAR' ? 'CONFIRMADO' : 'RECUSADO', respondidoEm: ocorreuEm, origemResposta: params.channel },
  });

  if (params.decision === 'CONFIRMAR' && !effects.effectsEnabled && command.success) {
    await enviarWhatsappAgendamento({
      tenantId: params.context.tenantId, leadId: atividade.lead.id,
      telefone: atividade.lead.telefone, mensagem: mensagemConfirmacao,
    });
  }

  let rejectionMessage = 'Entendido. Registrei sua indisponibilidade e vou acionar o especialista fallback.';
  if (params.decision === 'RECUSAR' && command.success) {
    const reassignment = await remanejarCorretorAtividade({ atividadeId: atividade.id, origem: 'RECUSA_EXPLICITA' });
    if (!reassignment.sucesso) {
      rejectionMessage = reassignment.motivo === 'SEM_SUBSTITUTO'
        ? 'Registrei sua indisponibilidade, mas não há especialista fallback elegível. A operação precisa assumir este atendimento para não deixar o lead sem retorno.'
        : 'Registrei sua indisponibilidade, mas o atendimento mudou antes da substituição. Consulte a agenda atual.';
    }
  }
  return params.decision === 'CONFIRMAR'
    ? { success: true, replay: command.reasonCode === 'COMMAND_REPLAY', reasonCode: command.reasonCode, message: 'Perfeito, confirmação registrada. O lead será avisado por aqui.' }
    : { success: true, replay: command.reasonCode === 'COMMAND_REPLAY', reasonCode: command.reasonCode, message: rejectionMessage };
}
