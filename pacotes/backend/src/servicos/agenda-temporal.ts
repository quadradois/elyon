import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { timezoneValido } from './followup-temporal';

export const AGENDA_TIMEZONE_PADRAO = 'America/Sao_Paulo';

export type AgendaTemporalResult =
  | { ok: true; utc: Date; dataHoraLocal: string; timezone: string; origem: 'MENSAGEM' | 'ARGUMENTO' }
  | { ok: false; reasonCode: 'TIMEZONE_INVALID' | 'DATE_AMBIGUOUS' | 'DATE_INVALID' | 'DATE_PAST' };

function normalizar(texto: string): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function montarUtc(data: string, hora: string, timezone: string): Date | null {
  const local = `${data}T${hora}:00`;
  const utc = fromZonedTime(local, timezone);
  if (!Number.isFinite(utc.getTime())) return null;
  if (formatInTimeZone(utc, timezone, "yyyy-MM-dd'T'HH:mm:ss") !== local) return null;
  return utc;
}

function extrairDataHoraDaMensagem(texto: string, timezone: string, agora: Date): Date | null {
  const mensagem = normalizar(texto);
  const horaMatch = mensagem.match(/\b(?:as\s+)?(\d{1,2})(?::|h)(\d{2})?\b/);
  if (!horaMatch) return null;

  const hora = Number(horaMatch[1]);
  const minuto = Number(horaMatch[2] || '0');
  if (hora > 23 || minuto > 59) return null;
  const hhmm = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;

  let data: string | null = null;
  if (/\bamanha\b/.test(mensagem)) {
    data = formatInTimeZone(addDays(agora, 1), timezone, 'yyyy-MM-dd');
  } else if (/\bhoje\b/.test(mensagem)) {
    data = formatInTimeZone(agora, timezone, 'yyyy-MM-dd');
  } else {
    const br = mensagem.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (br) {
      const anoAtual = Number(formatInTimeZone(agora, timezone, 'yyyy'));
      let ano = br[3] ? Number(br[3]) : anoAtual;
      if (ano < 100) ano += 2000;
      data = `${ano}-${String(Number(br[2])).padStart(2, '0')}-${String(Number(br[1])).padStart(2, '0')}`;
      const candidata = montarUtc(data, hhmm, timezone);
      if (!br[3] && candidata && candidata.getTime() <= agora.getTime()) {
        data = `${ano + 1}-${String(Number(br[2])).padStart(2, '0')}-${String(Number(br[1])).padStart(2, '0')}`;
      }
    }
  }

  return data ? montarUtc(data, hhmm, timezone) : null;
}

function extrairDataHoraDoArgumento(texto: string, timezone: string): Date | null {
  const argumento = normalizar(texto);
  const br = argumento.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!br) return null;
  const data = `${br[3]}-${String(Number(br[2])).padStart(2, '0')}-${String(Number(br[1])).padStart(2, '0')}`;
  const hora = `${String(Number(br[4])).padStart(2, '0')}:${br[5]}`;
  return montarUtc(data, hora, timezone);
}

export function interpretarAgendamentoTemporal(params: {
  mensagemAtual?: string;
  dataHoraArgumento: string;
  timezone?: string;
  agora?: Date;
}): AgendaTemporalResult {
  const timezone = params.timezone || AGENDA_TIMEZONE_PADRAO;
  const agora = params.agora || new Date();
  if (!timezoneValido(timezone)) return { ok: false, reasonCode: 'TIMEZONE_INVALID' };

  const mensagemTemIndicadorTemporal = /\b(amanha|hoje|\d{1,2}\/\d{1,2})\b/.test(normalizar(params.mensagemAtual || ''));
  const pelaMensagem = extrairDataHoraDaMensagem(params.mensagemAtual || '', timezone, agora);
  if (mensagemTemIndicadorTemporal && !pelaMensagem) return { ok: false, reasonCode: 'DATE_AMBIGUOUS' };

  const utc = pelaMensagem || extrairDataHoraDoArgumento(params.dataHoraArgumento, timezone);
  if (!utc) return { ok: false, reasonCode: 'DATE_INVALID' };
  if (utc.getTime() <= agora.getTime()) return { ok: false, reasonCode: 'DATE_PAST' };

  return {
    ok: true,
    utc,
    dataHoraLocal: formatInTimeZone(utc, timezone, 'dd/MM/yyyy HH:mm'),
    timezone,
    origem: pelaMensagem ? 'MENSAGEM' : 'ARGUMENTO',
  };
}
