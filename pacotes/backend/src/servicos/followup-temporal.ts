import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const FOLLOWUP_POLICY_VERSION = 'followup-v1';
export const FOLLOWUP_ALLOWED_START_HOUR = 8;
export const FOLLOWUP_ALLOWED_END_HOUR = 20;

export type TemporalResult =
  | { ok: true; utc: Date; local: string; timezone: string }
  | { ok: false; reasonCode: 'TIMEZONE_INVALID' | 'DATE_AMBIGUOUS' | 'DATE_INVALID' | 'DATE_PAST' | 'OUTSIDE_ALLOWED_HOURS' };

export function timezoneValido(timezone: string): boolean {
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(new Date()); return !!timezone?.trim(); }
  catch { return false; }
}

function localDeReferencia(reference: Date, timezone: string): { date: string; hour: string } {
  return { date: formatInTimeZone(reference, timezone, 'yyyy-MM-dd'), hour: formatInTimeZone(reference, timezone, 'HH:mm') };
}

export function interpretarFollowupTemporal(params: {
  expressao: string;
  timezone: string;
  agora?: Date;
}): TemporalResult {
  const agora = params.agora || new Date();
  const expression = params.expressao.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!timezoneValido(params.timezone)) return { ok: false, reasonCode: 'TIMEZONE_INVALID' };
  if (!expression || /^(me chama depois|fala comigo semana que vem|depois|amanh[ãa])$/.test(expression)) {
    return { ok: false, reasonCode: 'DATE_AMBIGUOUS' };
  }

  let local: string | undefined;
  const iso = expression.match(/^(\d{4}-\d{2}-\d{2})[ t](\d{2}):(\d{2})$/);
  const br = expression.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  const tomorrow = expression.match(/^amanh[ãa]\s+(?:(?:às?|as)\s*)?(\d{1,2}):(\d{2})$/);
  if (iso) local = `${iso[1]}T${iso[2]}:${iso[3]}`;
  else if (br) local = `${br[3]}-${br[2]}-${br[1]}T${br[4] || '09'}:${br[5] || '00'}`;
  else if (tomorrow) {
    const ref = localDeReferencia(addDays(agora, 1), params.timezone);
    local = `${ref.date}T${tomorrow[1].padStart(2, '0')}:${tomorrow[2]}`;
  } else return { ok: false, reasonCode: 'DATE_AMBIGUOUS' };

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return { ok: false, reasonCode: 'DATE_INVALID' };
  const utc = fromZonedTime(`${local}:00`, params.timezone);
  if (!Number.isFinite(utc.getTime()) || formatInTimeZone(utc, params.timezone, "yyyy-MM-dd'T'HH:mm") !== local) {
    return { ok: false, reasonCode: 'DATE_INVALID' };
  }
  const sameMinus = formatInTimeZone(new Date(utc.getTime() - 3_600_000), params.timezone, "yyyy-MM-dd'T'HH:mm") === local;
  const samePlus = formatInTimeZone(new Date(utc.getTime() + 3_600_000), params.timezone, "yyyy-MM-dd'T'HH:mm") === local;
  if (sameMinus || samePlus) return { ok: false, reasonCode: 'DATE_AMBIGUOUS' };
  const hour = Number(local.slice(11, 13));
  if (hour < FOLLOWUP_ALLOWED_START_HOUR || hour >= FOLLOWUP_ALLOWED_END_HOUR) return { ok: false, reasonCode: 'OUTSIDE_ALLOWED_HOURS' };
  utc.setSeconds(0, 0);
  if (utc.getTime() <= agora.getTime()) return { ok: false, reasonCode: 'DATE_PAST' };
  return { ok: true, utc, local, timezone: params.timezone };
}
