import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { googleCalendarService } from './google-calendar';
import { resolverEspecialistaCampanha } from './resolucao-especialista-campanha';
import {
  formatarSugestaoHorario,
  gerarSlotsComerciaisLocais,
  selecionarSugestoesDeHorario,
  TIMEZONE_AGENDA,
  type PeriodoPreferido,
} from './sugestao-horarios-agenda';

export interface SugestaoHorarioDisponivel {
  dataHora: string;
  inicioUtc: string;
}

export interface ResultadoConsultaHorariosDisponiveis {
  success: boolean;
  reasonCode?: string;
  error?: string;
  especialista?: string;
  fonte?: 'GOOGLE_CALENDAR_E_LOCAL' | 'AGENDA_LOCAL';
  sugestoes?: SugestaoHorarioDisponivel[];
  dataPreferida?: string;
  instrucaoParaAgente: string;
}

function janelaConsulta(dataPreferida: string | undefined, agora: Date): {
  inicio: Date;
  fim: Date;
  dataValida: boolean;
} {
  const limite = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (!dataPreferida) return { inicio: agora, fim: limite, dataValida: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPreferida)) {
    return { inicio: agora, fim: agora, dataValida: false };
  }

  const inicioDia = fromZonedTime(`${dataPreferida}T00:00:00`, TIMEZONE_AGENDA);
  const fimDia = fromZonedTime(`${dataPreferida}T23:59:59.999`, TIMEZONE_AGENDA);
  const dataNormalizada = formatInTimeZone(inicioDia, TIMEZONE_AGENDA, 'yyyy-MM-dd');
  const dataValida = dataNormalizada === dataPreferida
    && fimDia.getTime() > agora.getTime()
    && inicioDia.getTime() <= limite.getTime();
  return {
    inicio: inicioDia.getTime() > agora.getTime() ? inicioDia : agora,
    fim: fimDia,
    dataValida,
  };
}

export async function consultarHorariosDisponiveisCanonico(params: {
  leadId: string;
  tenantId?: string;
  periodoPreferido?: PeriodoPreferido;
  dataPreferida?: string;
  agora?: Date;
}): Promise<ResultadoConsultaHorariosDisponiveis> {
  if (!params.tenantId) {
    return {
      success: false,
      reasonCode: 'TENANT_CONTEXT_REQUIRED',
      error: 'Contexto de segurança inválido para consultar horários.',
      instrucaoParaAgente: 'Não informe horários sem consultar a agenda.',
    };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { id: true, tenantId: true, campanhaOrigemId: true },
  });
  if (!lead || lead.tenantId !== params.tenantId) {
    return {
      success: false,
      reasonCode: 'TENANT_OWNERSHIP_DENIED',
      error: 'Lead não encontrado para o tenant informado.',
      instrucaoParaAgente: 'Não informe horários sem consultar a agenda.',
    };
  }
  if (!lead.campanhaOrigemId) {
    return {
      success: false,
      reasonCode: 'CAMPAIGN_NOT_FOUND',
      instrucaoParaAgente: 'Diga que vai verificar a agenda do especialista e retornar com opções.',
    };
  }

  const especialista = await resolverEspecialistaCampanha({
    tenantId: params.tenantId,
    campanhaId: lead.campanhaOrigemId,
  });
  if (!especialista) {
    return {
      success: false,
      reasonCode: 'SPECIALIST_NOT_CONFIGURED',
      instrucaoParaAgente: 'Diga que vai verificar a agenda do especialista e retornar com opções.',
    };
  }

  const agora = params.agora || new Date();
  const janela = janelaConsulta(params.dataPreferida, agora);
  if (!janela.dataValida) {
    return {
      success: false,
      reasonCode: 'INVALID_DATE_RANGE',
      especialista: especialista.nome,
      dataPreferida: params.dataPreferida,
      instrucaoParaAgente: 'Peça outra data dentro dos próximos sete dias.',
    };
  }

  const conflitosLocais: Array<{ agendadoPara: Date | null; duracao: number | null }> = especialista.usuarioId
    ? await prisma.atividade.findMany({
      where: {
        corretorAtualId: especialista.usuarioId,
        tipo: 'REUNIAO',
        completadoEm: null,
        statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] },
        agendadoPara: { gte: janela.inicio, lte: janela.fim },
        lead: { tenantId: params.tenantId },
      },
      select: { agendadoPara: true, duracao: true },
    })
    : [];

  let slots = gerarSlotsComerciaisLocais(agora, 7);
  let fonte: 'GOOGLE_CALENDAR_E_LOCAL' | 'AGENDA_LOCAL' = 'AGENDA_LOCAL';
  try {
    if (googleCalendarService.isConfigurado()) {
      slots = await googleCalendarService.consultarSlotsLivres({
        dataInicio: janela.inicio,
        dataFim: janela.fim,
      });
      fonte = 'GOOGLE_CALENDAR_E_LOCAL';
    }
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : 'CALENDAR_QUERY_FAILED' },
      '[AGENDA] Consulta externa indisponível; usando agenda local');
  }

  const sugestoes = selecionarSugestoesDeHorario({
    slots,
    conflitosLocais: conflitosLocais
      .filter((item) => item.agendadoPara)
      .map((item) => ({ agendadoPara: item.agendadoPara!, duracao: item.duracao })),
    periodoPreferido: params.periodoPreferido || 'qualquer',
    dataLocal: params.dataPreferida,
    limite: 2,
    agora,
  }).map((slot) => ({
    dataHora: formatarSugestaoHorario(slot),
    inicioUtc: slot.inicio,
  }));

  if (!sugestoes.length) {
    return {
      success: false,
      reasonCode: 'NO_SLOTS_FOUND',
      especialista: especialista.nome,
      fonte,
      dataPreferida: params.dataPreferida,
      instrucaoParaAgente: 'Informe que não encontrou horários livres no período e ofereça consultar outro dia.',
    };
  }

  return {
    success: true,
    especialista: especialista.nome,
    fonte,
    sugestoes,
    dataPreferida: params.dataPreferida,
    instrucaoParaAgente: sugestoes.length === 1
      ? `Pergunte apenas se pode solicitar ${sugestoes[0].dataHora}.`
      : `Ofereça somente estas opções e aguarde a escolha: ${sugestoes.map((item) => item.dataHora).join(' ou ')}.`,
  };
}

function formatarOpcao(dataHora: string): string {
  const [data, hora] = dataHora.split(' ');
  return `*${data} às ${hora}*`;
}

export function formatarRespostaHorariosDisponiveis(resultado: ResultadoConsultaHorariosDisponiveis): string {
  if (resultado.success && resultado.sugestoes?.length) {
    const opcoes = resultado.sugestoes.map((item) => formatarOpcao(item.dataHora));
    return opcoes.length === 1
      ? `Tenho ${opcoes[0]}. Esse horário funciona para você?`
      : `Tenho ${opcoes[0]} ou ${opcoes[1]}. Qual funciona melhor para você? 😊`;
  }

  if (resultado.reasonCode === 'NO_SLOTS_FOUND' && resultado.dataPreferida) {
    const [ano, mes, dia] = resultado.dataPreferida.split('-');
    return `Não encontrei horários livres em *${dia}/${mes}/${ano}*. Quer que eu verifique outro dia?`;
  }
  if (resultado.reasonCode === 'INVALID_DATE_RANGE') {
    return 'Consigo verificar os próximos sete dias. Qual outra data funciona para você?';
  }
  return 'Não consegui consultar a agenda do especialista agora. Vou verificar antes de te oferecer um horário.';
}
