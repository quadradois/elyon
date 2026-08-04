import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { TIMEZONE_AGENDA, type PeriodoPreferido } from './sugestao-horarios-agenda';

export interface ConsultaDisponibilidadeAgendamento {
  periodoPreferido: PeriodoPreferido;
  dataPreferida?: string;
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dataLocalRelativa(agora: Date, dias: number): string {
  const hojeLocal = formatInTimeZone(agora, TIMEZONE_AGENDA, 'yyyy-MM-dd');
  const inicioHoje = fromZonedTime(`${hojeLocal}T00:00:00`, TIMEZONE_AGENDA);
  return formatInTimeZone(addDays(inicioHoje, dias), TIMEZONE_AGENDA, 'yyyy-MM-dd');
}

function extrairDataExplicita(texto: string, agora: Date): string | undefined {
  const match = texto.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!match) return undefined;

  const anoAtual = Number(formatInTimeZone(agora, TIMEZONE_AGENDA, 'yyyy'));
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  let ano = match[3] ? Number(match[3]) : anoAtual;
  if (ano < 100) ano += 2000;

  const dataLocal = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const data = fromZonedTime(`${dataLocal}T12:00:00`, TIMEZONE_AGENDA);
  return formatInTimeZone(data, TIMEZONE_AGENDA, 'yyyy-MM-dd') === dataLocal ? dataLocal : undefined;
}

export function interpretarConsultaDisponibilidadeAgendamento(
  mensagem?: string,
  agora = new Date(),
): ConsultaDisponibilidadeAgendamento | null {
  const texto = normalizar(mensagem || '');
  if (!texto) return null;

  const perguntaStatusExistente = /\b(meu|minha|tenho|agendad[oa]|marcad[oa]|confirmad[oa])\b.{0,35}\b(agenda|agendamento|horario|atendimento)\b/.test(texto)
    || /\b(agenda|agendamento|horario|atendimento)\b.{0,35}\b(meu|minha|tenho|agendad[oa]|marcad[oa]|confirmad[oa])\b/.test(texto);
  if (perguntaStatusExistente) return null;

  const mencionaDisponibilidade = /\b(horarios?|vagas?|disponibilidade|disponiveis?|livres?)\b/.test(texto);
  const pedeOpcoes = /\b(quais?|que|tem|temos|possui|ha|quando|qualquer|opcoes?)\b/.test(texto);
  if (!mencionaDisponibilidade || !pedeOpcoes) return null;

  // Data + hora exatas representam escolha de agendamento, não consulta de opções.
  if (/\b(?:as|a)\s*\d{1,2}(?::\d{2})?\s*(?:h|horas?)?\b/.test(texto)) return null;

  const periodoPreferido: PeriodoPreferido = /\b(manha|matutino)\b/.test(texto)
    ? 'manha'
    : /\b(tarde|vespertino)\b/.test(texto)
      ? 'tarde'
      : 'qualquer';

  let dataPreferida: string | undefined;
  if (/\bamanha\b/.test(texto)) dataPreferida = dataLocalRelativa(agora, 1);
  else if (/\bhoje\b/.test(texto)) dataPreferida = dataLocalRelativa(agora, 0);
  else dataPreferida = extrairDataExplicita(texto, agora);

  return { periodoPreferido, dataPreferida };
}

export function ehConsultaDisponibilidadeAgendamento(mensagem?: string): boolean {
  return interpretarConsultaDisponibilidadeAgendamento(mensagem) !== null;
}
