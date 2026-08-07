import { formatarDataHoraAgenda } from './notificacao-agendamento';
import { sanitizarContextoEspecialista } from './specialist-copilot-privacy';

export type PostAppointmentFeedbackIntent =
  | 'REALIZADO'
  | 'LEAD_AUSENTE'
  | 'ESPECIALISTA_AUSENTE'
  | 'REAGENDAR'
  | 'OUTRO'
  | 'AMBIGUO';

export interface PostAppointmentFeedbackInterpretation {
  intent: PostAppointmentFeedbackIntent;
  resumo: string;
}

function normalizar(texto: string): string {
  return texto.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function calcularElegibilidadeFeedback(params: {
  agendadoPara: Date;
  duracaoMinutos?: number | null;
  canal?: string | null;
  tipo?: string | null;
}): Date {
  const ligacao = params.canal !== 'VISITA' && params.tipo !== 'AVALIACAO';
  if (ligacao) return new Date(params.agendadoPara.getTime() + 20 * 60_000);
  const duracao = Math.max(1, params.duracaoMinutos || 60);
  return new Date(params.agendadoPara.getTime() + (duracao + 15) * 60_000);
}

export function interpretarFeedbackPosAtendimento(textoOriginal: string): PostAppointmentFeedbackInterpretation {
  const resumo = sanitizarContextoEspecialista(textoOriginal, 600);
  const texto = normalizar(resumo);
  const opcao = texto.match(/^(?:opcao\s*)?([1-4])(?:\b|[.)-])/i)?.[1];

  if (opcao === '1') return { intent: 'REALIZADO', resumo };
  if (opcao === '2') return { intent: 'LEAD_AUSENTE', resumo };
  if (opcao === '3') return { intent: 'REAGENDAR', resumo };
  if (opcao === '4') return { intent: resumo.length >= 20 ? 'OUTRO' : 'AMBIGUO', resumo };

  if (/\b(reagendar|remarcar|outro horario|nova data)\b/.test(texto)) return { intent: 'REAGENDAR', resumo };
  if (/\b(eu nao consegui|eu nao pude|nao consegui ligar|nao pude atender|nao realizei|minha ausencia)\b/.test(texto)) {
    return { intent: 'ESPECIALISTA_AUSENTE', resumo };
  }
  if (/\b(lead|cliente|ela|ele|proprietari[oa])\b.*\b(nao atendeu|nao compareceu|faltou|ausente)\b/.test(texto)
    || /\bninguem atendeu\b/.test(texto)) {
    return { intent: 'LEAD_AUSENTE', resumo };
  }
  if (/\b(atendimento realizado|foi realizado|realizad[oa]|aconteceu|conversei|falei com|atendi)\b/.test(texto)) {
    return { intent: 'REALIZADO', resumo };
  }
  if (/\b(nao aconteceu|outro motivo)\b/.test(texto) && resumo.length >= 20) return { intent: 'OUTRO', resumo };
  return { intent: 'AMBIGUO', resumo };
}

export function montarMensagemFeedbackPosAtendimento(params: {
  especialistaNome: string;
  leadNome: string;
  agendadoPara: Date;
  modalidade: string;
  imovel?: string | null;
}): string {
  return [
    'Elyon | Feedback do atendimento',
    '',
    `Olá, ${params.especialistaNome}! Como foi o atendimento com ${params.leadNome}, marcado para ${formatarDataHoraAgenda(params.agendadoPara)}?`,
    params.imovel ? `Imóvel: ${params.imovel}` : null,
    `Modalidade: ${params.modalidade}`,
    '',
    '1. Atendimento realizado',
    '2. Lead não atendeu/não compareceu',
    '3. Preciso reagendar',
    '4. Não aconteceu por outro motivo',
    '',
    'Pode responder com o número ou contar em poucas palavras o que aconteceu. Se houve atendimento, inclua um breve resumo para atualizar a ficha do cliente.',
  ].filter((linha): linha is string => linha !== null).join('\n');
}

export function montarMensagemLembreteFeedback(leadNome: string): string {
  return `Lembrete: ainda preciso do resultado do atendimento com ${leadNome}. Responda se foi realizado, se alguém não compareceu ou se precisa reagendar.`;
}
