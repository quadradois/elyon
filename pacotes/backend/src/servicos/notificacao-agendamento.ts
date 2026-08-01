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

export async function enviarWhatsappAgendamento(params: {
  tenantId: string;
  telefone?: string | null;
  mensagem: string;
}): Promise<boolean> {
  if (!params.telefone) return false;
  const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
    where: { tenantId: params.tenantId, status: 'CONECTADO' },
    orderBy: { atualizadoEm: 'desc' },
    select: { instanceName: true },
  });
  if (!sessaoWhatsapp) return false;

  try {
    const { getWhatsAppService } = await import('./whatsapp');
    const whatsapp = getWhatsAppService(sessaoWhatsapp.instanceName);
    await whatsapp.enviarMensagemTexto(params.telefone, params.mensagem);
    return true;
  } catch (error) {
    console.error('[Agenda] Erro ao enviar WhatsApp:', error);
    return false;
  }
}
