import { prisma } from '../lib/db';
import { formatarDataHoraAgenda } from './notificacao-agendamento';

const STATUS_AGENDAMENTO_ATIVOS = ['PROPOSTO', 'SOLICITADO', 'PENDENTE', 'CONFIRMADO'] as const;

const selecaoAgendamento = {
  id: true,
  tipo: true,
  agendadoPara: true,
  statusAgendamento: true,
  statusConfirmacaoCorretor: true,
  corretorAtualId: true,
  corretorOriginalId: true,
  canceladoEm: true,
  motivoCancelamento: true,
} as const;

export interface ResultadoConsultaStatusAgendamento {
  success: boolean;
  reasonCode?: string;
  error?: string;
  temAgendamentoAtivo?: boolean;
  situacao?: string | null;
  agendamento?: DadosAgendamento;
  ultimoAgendamento?: DadosAgendamento;
  instrucaoParaAgente?: string;
}

interface DadosAgendamento {
  atividadeId: string;
  statusAgendamento: string | null;
  statusConfirmacaoEspecialista: string | null;
  dataHora: string;
  dataHoraIso: string | null;
  especialistaNome: string | null;
  tipoAtendimento: 'ligacao_telefonica' | 'avaliacao';
  canceladoEm?: string | null;
  motivoCancelamento?: string | null;
}

async function resolverNomeEspecialista(atividade: {
  corretorAtualId?: string | null;
  corretorOriginalId?: string | null;
}): Promise<string | null> {
  const usuarioId = atividade.corretorAtualId || atividade.corretorOriginalId;
  if (!usuarioId) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true },
  });
  return usuario?.nome || null;
}

function mapearDadosAgendamento(
  atividade: {
    id: string;
    tipo: string;
    agendadoPara: Date | null;
    statusAgendamento: string | null;
    statusConfirmacaoCorretor: string | null;
    corretorAtualId: string | null;
    corretorOriginalId: string | null;
    canceladoEm: Date | null;
    motivoCancelamento: string | null;
  },
  especialistaNome: string | null,
  incluirCancelamento = false,
): DadosAgendamento {
  return {
    atividadeId: atividade.id,
    statusAgendamento: atividade.statusAgendamento,
    statusConfirmacaoEspecialista: atividade.statusConfirmacaoCorretor,
    dataHora: formatarDataHoraAgenda(atividade.agendadoPara),
    dataHoraIso: atividade.agendadoPara?.toISOString() || null,
    especialistaNome,
    tipoAtendimento: atividade.tipo === 'REUNIAO' ? 'ligacao_telefonica' : 'avaliacao',
    ...(incluirCancelamento
      ? {
        canceladoEm: atividade.canceladoEm?.toISOString() || null,
        motivoCancelamento: atividade.motivoCancelamento || null,
      }
      : {}),
  };
}

export async function consultarStatusAgendamentoCanonico(params: {
  leadId: string;
  tenantId?: string;
  agora?: Date;
}): Promise<ResultadoConsultaStatusAgendamento> {
  if (!params.tenantId) {
    return {
      success: false,
      reasonCode: 'TENANT_CONTEXT_REQUIRED',
      error: 'Contexto de segurança inválido para consultar o agendamento.',
    };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { id: true, tenantId: true },
  });
  if (!lead || lead.tenantId !== params.tenantId) {
    return {
      success: false,
      reasonCode: 'TENANT_OWNERSHIP_DENIED',
      error: 'Lead não encontrado para o tenant informado.',
    };
  }

  const agora = params.agora || new Date();
  const atividadeAtiva = await prisma.atividade.findFirst({
    where: {
      leadId: params.leadId,
      tipo: { in: ['REUNIAO', 'AVALIACAO'] },
      completadoEm: null,
      statusAgendamento: { in: [...STATUS_AGENDAMENTO_ATIVOS] },
      agendadoPara: { gt: agora },
      lead: { tenantId: params.tenantId },
    },
    orderBy: { agendadoPara: 'asc' },
    select: selecaoAgendamento,
  });

  if (atividadeAtiva) {
    const especialistaNome = await resolverNomeEspecialista(atividadeAtiva);
    const confirmado = atividadeAtiva.statusAgendamento === 'CONFIRMADO';
    return {
      success: true,
      temAgendamentoAtivo: true,
      situacao: confirmado ? 'CONFIRMADO' : 'AGUARDANDO_CONFIRMACAO_ESPECIALISTA',
      agendamento: mapearDadosAgendamento(atividadeAtiva, especialistaNome),
      instrucaoParaAgente: confirmado
        ? 'Informe que o agendamento está confirmado e use somente os dados retornados.'
        : 'Informe que o agendamento está solicitado e aguarda confirmação do especialista.',
    };
  }

  const ultimaAtividade = await prisma.atividade.findFirst({
    where: {
      leadId: params.leadId,
      tipo: { in: ['REUNIAO', 'AVALIACAO'] },
      lead: { tenantId: params.tenantId },
    },
    orderBy: { criadoEm: 'desc' },
    select: selecaoAgendamento,
  });

  if (!ultimaAtividade) {
    return {
      success: true,
      temAgendamentoAtivo: false,
      situacao: 'SEM_AGENDAMENTO',
      instrucaoParaAgente: 'Informe que não há agendamento registrado no sistema.',
    };
  }

  const especialistaNome = await resolverNomeEspecialista(ultimaAtividade);
  const horarioPassouSemDesfecho = STATUS_AGENDAMENTO_ATIVOS.includes(
    ultimaAtividade.statusAgendamento as (typeof STATUS_AGENDAMENTO_ATIVOS)[number]
  );
  return {
    success: true,
    temAgendamentoAtivo: false,
    situacao: horarioPassouSemDesfecho
      ? 'HORARIO_PASSADO_PENDENTE_RESULTADO'
      : ultimaAtividade.statusAgendamento,
    ultimoAgendamento: mapearDadosAgendamento(ultimaAtividade, especialistaNome, true),
    instrucaoParaAgente: horarioPassouSemDesfecho
      ? 'O horário passou, mas o resultado ainda não foi registrado. Não presuma cancelamento ou realização.'
      : `Informe que não há agendamento ativo e que o último consta como ${ultimaAtividade.statusAgendamento}.`,
  };
}

export function formatarRespostaStatusAgendamento(
  resultado: ResultadoConsultaStatusAgendamento
): string {
  if (!resultado.success) {
    return 'Não consegui consultar o status do seu agendamento agora. Vou precisar verificar novamente antes de te confirmar.';
  }

  if (resultado.temAgendamentoAtivo && resultado.agendamento) {
    const dados = resultado.agendamento;
    const especialista = dados.especialistaNome ? ` com ${dados.especialistaNome}` : '';
    if (resultado.situacao === 'CONFIRMADO') {
      return `Seu agendamento está confirmado para *${dados.dataHora}*${especialista}.`;
    }
    return `Seu agendamento está solicitado para *${dados.dataHora}*${especialista} e aguarda confirmação do especialista.`;
  }

  if (resultado.situacao === 'SEM_AGENDAMENTO') {
    return 'Você não possui agendamento registrado no sistema neste momento.';
  }

  const ultimo = resultado.ultimoAgendamento;
  if (resultado.situacao === 'HORARIO_PASSADO_PENDENTE_RESULTADO' && ultimo) {
    return `Você não possui agendamento futuro ativo. O horário de *${ultimo.dataHora}* já passou, mas o resultado do atendimento ainda não foi registrado.`;
  }

  if (resultado.situacao === 'CANCELADO' && ultimo) {
    return `Você não possui agendamento ativo. O último agendamento, para *${ultimo.dataHora}*, consta como cancelado no sistema.`;
  }

  return ultimo
    ? `Você não possui agendamento ativo. O último, para *${ultimo.dataHora}*, consta como ${String(resultado.situacao || 'encerrado').toLowerCase()} no sistema.`
    : 'Você não possui agendamento ativo no sistema neste momento.';
}
