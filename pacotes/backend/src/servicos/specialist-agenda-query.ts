import { prisma } from '../lib/db';
import { formatarDataHoraAgenda } from './notificacao-agendamento';
import { montarIdentificacaoImovel, sanitizarContextoEspecialista } from './specialist-copilot-privacy';
import type { SpecialistQueryPeriod } from './specialist-copilot-intent';

export async function consultarAgendaEspecialista(params: {
  tenantId: string;
  usuarioId: string;
  inicio?: Date;
  fim?: Date;
  limite?: number;
}): Promise<Array<{
  atividadeId: string;
  leadNome: string;
  horario: Date;
  modalidade: string;
  imovel: string;
  resumo: string;
  status: string;
}>> {
  const inicio = params.inicio || new Date();
  const fim = params.fim || new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);
  const atividades = await prisma.atividade.findMany({
    where: {
      corretorAtualId: params.usuarioId,
      lead: { tenantId: params.tenantId },
      agendadoPara: { gte: inicio, lte: fim },
      statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] },
    },
    include: {
      lead: {
        select: {
          nome: true, nomeEdificio: true, enderecoImovel: true, briefingCloser: true, observacoesSpin: true,
          campanhaOrigem: { select: { nomeEmpreendimento: true, empreendimento: { select: { nome: true } } } },
        },
      },
    },
    orderBy: { agendadoPara: 'asc' }, take: Math.min(10, Math.max(1, params.limite || 5)),
  });
  return atividades.flatMap((atividade) => atividade.agendadoPara ? [{
    atividadeId: atividade.id,
    leadNome: sanitizarContextoEspecialista(atividade.lead.nome, 100),
    horario: atividade.agendadoPara,
    modalidade: atividade.canal === 'VISITA' ? 'Visita presencial' : 'Ligação telefônica',
    imovel: montarIdentificacaoImovel({
      nomeEdificio: atividade.lead.nomeEdificio,
      enderecoImovel: atividade.lead.enderecoImovel,
      empreendimentoNome: atividade.lead.campanhaOrigem?.empreendimento?.nome || atividade.lead.campanhaOrigem?.nomeEmpreendimento,
    }),
    resumo: sanitizarContextoEspecialista(atividade.lead.briefingCloser || atividade.lead.observacoesSpin || '', 300),
    status: atividade.statusAgendamento || 'PENDENTE',
  }] : []);
}

function descreverPeriodo(periodo?: SpecialistQueryPeriod): string {
  if (periodo?.descricao === 'hoje') return 'hoje';
  if (periodo?.descricao === 'amanha') return 'amanhã';
  if (periodo?.descricao === 'data_explicita' && periodo.dataLocal) {
    const [ano, mes, dia] = periodo.dataLocal.split('-');
    return `em ${dia}/${mes}/${ano}`;
  }
  return 'nos próximos sete dias';
}

export function formatarAgendaEspecialista(
  itens: Awaited<ReturnType<typeof consultarAgendaEspecialista>>,
  periodo?: SpecialistQueryPeriod,
): string {
  const descricaoPeriodo = descreverPeriodo(periodo);
  if (!itens.length) return `Você não possui atendimentos ativos ${descricaoPeriodo}.`;
  return [
    `Seus atendimentos ${descricaoPeriodo}:`,
    ...itens.map((item, index) => [
      `${index + 1}. ${item.leadNome} — ${formatarDataHoraAgenda(item.horario)}`,
      `   ${item.modalidade}${item.imovel ? ` | ${item.imovel}` : ''} | ${item.status}`,
    ].join('\n')),
  ].join('\n');
}
