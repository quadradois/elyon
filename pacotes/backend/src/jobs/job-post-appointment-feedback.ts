import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { registrarPostAppointmentFeedbackEvento } from '../observabilidade/agenda-comercial-metrics';
import { resolverAgendaPilotConfig } from '../servicos/agenda-pilot-config';
import {
  calcularElegibilidadeFeedback,
  montarMensagemFeedbackPosAtendimento,
  montarMensagemLembreteFeedback,
} from '../servicos/post-appointment-feedback';
import { montarIdentificacaoImovel } from '../servicos/specialist-copilot-privacy';

const STATUS_ATIVOS = ['AGUARDANDO_ENVIO', 'AGUARDANDO_RESPOSTA', 'PENDENCIA_GESTOR'];

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function executarFeedbacksPosAtendimento(
  agora = new Date(),
): Promise<{ elegiveis: number; enfileirados: number; lembretes: number; pendencias: number; invalidados: number; erros: number }> {
  const config = await resolverAgendaPilotConfig();
  if (!config.scope || !config.postAppointmentFeedback?.enabled || !config.effects.enabled) {
    return { elegiveis: 0, enfileirados: 0, lembretes: 0, pendencias: 0, invalidados: 0, erros: 0 };
  }

  const tenantId = config.scope.tenantId;
  const cutoff = new Date(config.scope.startedAtUtc);
  const atividades = await prisma.atividade.findMany({
    where: {
      statusAgendamento: 'CONFIRMADO',
      statusConfirmacaoCorretor: 'CONFIRMADO',
      corretorAtualId: { not: null },
      agendadoPara: { gte: cutoff, lte: agora },
      feedbackPosAtendimento: null,
      lead: { tenantId },
    },
    include: {
      lead: {
        select: {
          id: true, nome: true, tenantId: true, nomeEdificio: true, enderecoImovel: true,
          campanhaOrigem: { select: { nomeEmpreendimento: true, empreendimento: { select: { nome: true } } } },
        },
      },
      feedbackPosAtendimento: true,
    },
    orderBy: { agendadoPara: 'asc' },
    take: 100,
  });

  let enfileirados = 0;
  let erros = 0;
  const elegiveis = atividades.filter((atividade) => atividade.agendadoPara
    && calcularElegibilidadeFeedback({
      agendadoPara: atividade.agendadoPara,
      duracaoMinutos: atividade.duracao,
      canal: atividade.canal,
      tipo: atividade.tipo,
    }) <= agora);

  for (const atividade of elegiveis) {
    try {
      if (!atividade.agendadoPara || !atividade.corretorAtualId) continue;
      const elegivelEm = calcularElegibilidadeFeedback({
        agendadoPara: atividade.agendadoPara, duracaoMinutos: atividade.duracao,
        canal: atividade.canal, tipo: atividade.tipo,
      });
      const visita = atividade.canal === 'VISITA' || atividade.tipo === 'AVALIACAO';
      const imovel = montarIdentificacaoImovel({
        nomeEdificio: atividade.lead.nomeEdificio,
        enderecoImovel: atividade.lead.enderecoImovel,
        empreendimentoNome: atividade.lead.campanhaOrigem?.empreendimento?.nome
          || atividade.lead.campanhaOrigem?.nomeEmpreendimento,
      });
      const especialista = await prisma.usuario.findFirst({
        where: { id: atividade.corretorAtualId, tenantId, estaAtivo: true },
        select: { id: true, nome: true },
      });
      if (!especialista) continue;
      const base = `post-feedback:${atividade.id}:v${atividade.versao}`;
      const mensagem = montarMensagemFeedbackPosAtendimento({
        especialistaNome: especialista.nome,
        leadNome: atividade.lead.nome,
        agendadoPara: atividade.agendadoPara,
        modalidade: visita ? 'Visita presencial' : 'Ligação telefônica',
        imovel,
      });
      await prisma.$transaction(async (tx) => {
        await tx.feedbackPosAtendimentoAgenda.create({
          data: {
            tenantId, atividadeId: atividade.id, usuarioId: especialista.id,
            versaoAtividade: atividade.versao, status: 'AGUARDANDO_ENVIO',
            elegivelEm,
          },
        });
        await tx.efeitoAgendaOutbox.create({
          data: {
            chaveComando: base, chaveIdempotencia: hash([base, 'INITIAL']), tenantId,
            leadId: atividade.lead.id, atividadeId: atividade.id, tipo: 'FEEDBACK_POS_ATENDIMENTO',
            mensagem, destinatarioTipo: 'USUARIO', usuarioDestinoId: especialista.id, correlationId: base,
          },
        });
      });
      enfileirados += 1;
      registrarPostAppointmentFeedbackEvento('SOLICITACAO', 'ENFILEIRADA');
    } catch (error: any) {
      if (error?.code === 'P2002') continue;
      erros += 1;
      registrarPostAppointmentFeedbackEvento('SOLICITACAO', 'ERRO');
    }
  }

  const ativos = await prisma.feedbackPosAtendimentoAgenda.findMany({
    where: { tenantId, status: { in: STATUS_ATIVOS } },
    include: { atividade: { include: { lead: { select: { id: true, nome: true, tenantId: true } } } } },
    take: 200,
  });
  let lembretes = 0;
  let pendencias = 0;
  let invalidados = 0;
  for (const feedback of ativos) {
    const atividade = feedback.atividade;
    const obsoleto = atividade.statusAgendamento !== 'CONFIRMADO'
      || atividade.corretorAtualId !== feedback.usuarioId
      || atividade.versao !== feedback.versaoAtividade;
    if (obsoleto) {
      const update = await prisma.feedbackPosAtendimentoAgenda.updateMany({
        where: { id: feedback.id, status: { in: STATUS_ATIVOS } }, data: { status: 'INVALIDADO' },
      });
      invalidados += update.count;
      continue;
    }
    if (feedback.status === 'AGUARDANDO_RESPOSTA' && feedback.expiraEm && feedback.expiraEm <= agora) {
      const update = await prisma.feedbackPosAtendimentoAgenda.updateMany({
        where: { id: feedback.id, status: 'AGUARDANDO_RESPOSTA' }, data: { status: 'PENDENCIA_GESTOR' },
      });
      pendencias += update.count;
      if (update.count) registrarPostAppointmentFeedbackEvento('PRAZO', 'PENDENCIA_GESTOR');
      continue;
    }
    if (feedback.status === 'AGUARDANDO_RESPOSTA' && !feedback.lembreteEm && feedback.enviadoEm
      && feedback.enviadoEm.getTime() + 2 * 60 * 60_000 <= agora.getTime()) {
      const base = `post-feedback:${atividade.id}:v${feedback.versaoAtividade}:reminder`;
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.feedbackPosAtendimentoAgenda.updateMany({
          where: { id: feedback.id, status: 'AGUARDANDO_RESPOSTA', lembreteEm: null },
          data: { lembreteEm: agora },
        });
        if (!claimed.count) return;
        await tx.efeitoAgendaOutbox.create({
          data: {
            chaveComando: base, chaveIdempotencia: hash([base, 'USER', feedback.usuarioId]), tenantId,
            leadId: atividade.lead.id, atividadeId: atividade.id, tipo: 'LEMBRETE_FEEDBACK_POS_ATENDIMENTO',
            mensagem: montarMensagemLembreteFeedback(atividade.lead.nome), destinatarioTipo: 'USUARIO',
            usuarioDestinoId: feedback.usuarioId, correlationId: base,
          },
        });
        lembretes += 1;
      });
    }
  }

  return { elegiveis: elegiveis.length, enfileirados, lembretes, pendencias, invalidados, erros };
}
