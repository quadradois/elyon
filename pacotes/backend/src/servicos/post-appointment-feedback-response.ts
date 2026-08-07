import { prisma } from '../lib/db';
import { registrarPostAppointmentFeedbackEvento } from '../observabilidade/agenda-comercial-metrics';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda, type AgendaCommand } from './coerencia-agenda-estado';
import type { PostAppointmentFeedbackInterpretation } from './post-appointment-feedback';
import type { SpecialistFeedbackContext } from './specialist-copilot-context';

export type PostAppointmentFeedbackResponseResult = {
  success: boolean;
  reasonCode: string;
  message: string;
};

function extrairSugestoes(resumo: string): Record<string, string> | undefined {
  const normalizado = resumo.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sugestoes: Record<string, string> = {};
  if (/\b(vender|venda)\b/.test(normalizado)) sugestoes.interesse = 'VENDA';
  if (/\b(alugar|locacao|aluguel)\b/.test(normalizado)) sugestoes.interesse = 'LOCACAO';
  const prazo = resumo.match(/\b(?:em\s+)?(?:\d+|um|uma|dois|duas|tres)\s+(?:dia|dias|semana|semanas|m[eê]s|meses)\b/i);
  if (prazo) sugestoes.prazo = prazo[0];
  if (/\b(avaliacao|avaliar|visita)\b/.test(normalizado)) sugestoes.proximoPasso = 'AVALIACAO';
  return Object.keys(sugestoes).length ? sugestoes : undefined;
}

async function registrarResumoNaFicha(params: {
  feedbackId: string;
  context: SpecialistFeedbackContext;
  desfecho: string;
  resumo: string;
  agora: Date;
  statusFeedback: 'CONCLUIDO' | 'PENDENCIA_GESTOR';
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.feedbackPosAtendimentoAgenda.updateMany({
      where: { id: params.feedbackId, tenantId: params.context.tenantId, usuarioId: params.context.usuarioId,
        status: { in: ['AGUARDANDO_RESPOSTA', 'PENDENCIA_GESTOR'] } },
      data: {
        status: params.statusFeedback, respondidoEm: params.agora, desfecho: params.desfecho,
        resumoSanitizado: params.resumo, sugestoes: extrairSugestoes(params.resumo),
      },
    });
    if (!claimed.count) return false;
    await tx.atividade.create({
      data: {
        leadId: params.context.leadId,
        tipo: 'NOTA',
        titulo: 'Feedback pós-atendimento',
        descricao: [
          `Desfecho: ${params.desfecho}`,
          `Especialista: ${params.context.usuarioId}`,
          `Resumo: ${params.resumo || 'Não informado'}`,
          'Origem: Copilot de Agenda do especialista',
        ].join('\n'),
        resultado: params.desfecho,
        statusAgendamento: null,
        completadoEm: params.agora,
        criadoPor: `especialista:${params.context.usuarioId}`,
        mensagem: `post-feedback:${params.feedbackId}`,
      },
    });
    return true;
  });
}

export async function aplicarFeedbackPosAtendimento(params: {
  context: SpecialistFeedbackContext;
  interpretation: PostAppointmentFeedbackInterpretation;
  providerEventId: string;
  agora?: Date;
}): Promise<PostAppointmentFeedbackResponseResult> {
  const agora = params.agora || new Date();
  const { context, interpretation } = params;

  if (interpretation.intent === 'AMBIGUO') {
    registrarPostAppointmentFeedbackEvento('RESPOSTA', 'AMBIGUA');
    return {
      success: false, reasonCode: 'FEEDBACK_AMBIGUOUS',
      message: 'Não consegui identificar o resultado. Responda: “realizado”, “o lead não atendeu”, “eu não consegui atender” ou “preciso reagendar”.',
    };
  }

  if (interpretation.intent === 'REAGENDAR' || interpretation.intent === 'OUTRO') {
    const concluido = await registrarResumoNaFicha({
      feedbackId: context.feedbackId, context, desfecho: interpretation.intent,
      resumo: interpretation.resumo, agora, statusFeedback: 'PENDENCIA_GESTOR',
    });
    registrarPostAppointmentFeedbackEvento('RESPOSTA', concluido ? interpretation.intent : 'REPLAY');
    return {
      success: true, reasonCode: concluido ? `FEEDBACK_${interpretation.intent}` : 'FEEDBACK_REPLAY',
      message: interpretation.intent === 'REAGENDAR'
        ? 'Registrei que o atendimento precisa ser reagendado e deixei a pendência visível para a operação. Envie o novo dia e horário quando estiver definido.'
        : 'Registrei sua observação e deixei o atendimento para revisão da operação.',
    };
  }

  const base = {
    tenantId: context.tenantId, leadId: context.leadId, atividadeId: context.atividadeId,
    requestIdentity: { source: 'INBOUND_BATCH' as const, id: `${params.providerEventId}:post-feedback` },
    ator: `especialista:${context.usuarioId}`, origem: 'SPECIALIST_COPILOT_POST_FEEDBACK',
    motivo: interpretation.resumo || interpretation.intent,
    policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: agora,
    expectedVersion: context.versaoAtividade, correlationId: params.providerEventId,
  };
  let command: AgendaCommand;
  if (interpretation.intent === 'REALIZADO') command = { ...base, operacao: 'REALIZAR' };
  else command = {
    ...base, operacao: 'NO_SHOW',
    parteAusente: interpretation.intent === 'LEAD_AUSENTE' ? 'LEAD' : 'CORRETOR',
  };
  const result = await executarComandoAgenda(command);
  if (!result.success && result.reasonCode !== 'COMMAND_REPLAY') {
    registrarPostAppointmentFeedbackEvento('RESPOSTA', result.reasonCode);
    return {
      success: false, reasonCode: result.reasonCode,
      message: 'Não consegui registrar porque o atendimento mudou. Consulte a agenda atual ou peça a correção para a operação.',
    };
  }
  const concluded = await registrarResumoNaFicha({
    feedbackId: context.feedbackId, context, desfecho: interpretation.intent,
    resumo: interpretation.resumo, agora, statusFeedback: 'CONCLUIDO',
  });
  registrarPostAppointmentFeedbackEvento('RESPOSTA', concluded ? interpretation.intent : 'REPLAY');
  return {
    success: true, reasonCode: concluded ? `FEEDBACK_${interpretation.intent}` : 'FEEDBACK_REPLAY',
    message: interpretation.intent === 'REALIZADO'
      ? 'Perfeito. Registrei o atendimento como realizado e atualizei a ficha do lead com seu resumo.'
      : `Registrei o não comparecimento do ${interpretation.intent === 'LEAD_AUSENTE' ? 'lead' : 'especialista'} e atualizei a ficha do lead.`,
  };
}
