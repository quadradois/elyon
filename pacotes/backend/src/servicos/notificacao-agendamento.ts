import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { prisma } from '../lib/db';

const TIMEZONE_AGENDA = 'America/Sao_Paulo';

export function formatarDataHoraAgenda(data?: Date | null): string {
  if (!data) return 'data a confirmar';
  return formatInTimeZone(new Date(data), TIMEZONE_AGENDA, "EEEE, d 'de' MMMM 'às' HH:mm", {
    locale: ptBR,
  });
}

export function montarMensagemSolicitacaoLigacao(params: {
  dataHora: string;
  especialistaNome: string;
}): string {
  return `Perfeito — registrei a solicitação para ${params.dataHora} com ${params.especialistaNome}. Assim que o especialista confirmar esse horário, eu te aviso por aqui.`;
}

export function montarMensagemLigacaoConfirmada(params: {
  leadNome: string;
  agendadoPara?: Date | null;
  especialistaNome?: string | null;
}): string {
  const especialista = params.especialistaNome?.trim() || 'O especialista';
  return `✅ *Ligação confirmada!*

Olá, ${params.leadNome}!

${especialista} confirmou seu atendimento por telefone para:
📅 ${formatarDataHoraAgenda(params.agendadoPara)}

O especialista ligará para você no horário combinado. Se precisar reagendar, é só me avisar. 📞`;
}

export type ResultadoNotificacaoAgendamento = {
  enviado: boolean;
  registradoNoHistorico: boolean;
  messageId: string | null;
};

export async function enviarWhatsappAgendamento(params: {
  tenantId: string;
  leadId: string;
  telefone?: string | null;
  mensagem: string;
}): Promise<ResultadoNotificacaoAgendamento> {
  const naoEnviado: ResultadoNotificacaoAgendamento = {
    enviado: false,
    registradoNoHistorico: false,
    messageId: null,
  };
  if (!params.telefone) return naoEnviado;
  const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
    where: { tenantId: params.tenantId, status: 'CONECTADO' },
    orderBy: { atualizadoEm: 'desc' },
    select: { instanceName: true },
  });
  if (!sessaoWhatsapp) return naoEnviado;

  try {
    const { getWhatsAppService } = await import('./whatsapp');
    const whatsapp = getWhatsAppService(sessaoWhatsapp.instanceName);
    const resultado = await whatsapp.enviarMensagemTexto(params.telefone, params.mensagem);
    const messageId = resultado?.key?.id || resultado?.messageId || null;
    try {
      await prisma.mensagemProspeccao.create({
        data: {
          leadId: params.leadId,
          direcao: 'SAIDA',
          conteudo: params.mensagem,
          telefone: params.telefone,
          messageId,
          processadaPorIA: false,
        },
      });
      return { enviado: true, registradoNoHistorico: true, messageId };
    } catch (error) {
      console.error('[Agenda] WhatsApp enviado, mas o histórico não foi registrado:', error);
      return { enviado: true, registradoNoHistorico: false, messageId };
    }
  } catch (error) {
    console.error('[Agenda] Erro ao enviar WhatsApp:', error);
    return naoEnviado;
  }
}
