import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { AGENDA_TIMEZONE_PADRAO } from './agenda-temporal';

export type SpecialistIntentName =
  | 'CONFIRMAR'
  | 'RECUSAR'
  | 'CONTRAPROPOR'
  | 'CANCELAR_PARTICIPACAO'
  | 'CONSULTAR'
  | 'DESCONHECIDA';

export type SpecialistIntent = {
  name: SpecialistIntentName;
  horarioProposto?: Date;
  periodoConsulta?: SpecialistQueryPeriod;
  confidence: 'HIGH' | 'LOW';
};

export type SpecialistQueryPeriod = {
  inicio: Date;
  fim: Date;
  descricao: 'hoje' | 'amanha' | 'data_explicita' | 'proximos_sete_dias';
  dataLocal?: string;
};

function normalizar(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

type DataLocal = { ano: number; mes: number; dia: number };

function dataLocalDoInstante(instante: Date): DataLocal {
  const [ano, mes, dia] = formatInTimeZone(instante, AGENDA_TIMEZONE_PADRAO, 'yyyy-MM-dd')
    .split('-').map(Number);
  return { ano, mes, dia };
}

function somarDiasCalendario(data: DataLocal, dias: number): DataLocal {
  const resultado = new Date(Date.UTC(data.ano, data.mes - 1, data.dia + dias));
  return {
    ano: resultado.getUTCFullYear(),
    mes: resultado.getUTCMonth() + 1,
    dia: resultado.getUTCDate(),
  };
}

function dataLocalIso(data: DataLocal): string {
  return `${String(data.ano).padStart(4, '0')}-${String(data.mes).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}`;
}

function janelaDoDia(data: DataLocal): { inicio: Date; fim: Date } | null {
  const iso = dataLocalIso(data);
  const inicio = fromZonedTime(`${iso}T00:00:00.000`, AGENDA_TIMEZONE_PADRAO);
  if (formatInTimeZone(inicio, AGENDA_TIMEZONE_PADRAO, 'yyyy-MM-dd') !== iso) return null;

  const proximoDia = dataLocalIso(somarDiasCalendario(data, 1));
  const fimExclusivo = fromZonedTime(`${proximoDia}T00:00:00.000`, AGENDA_TIMEZONE_PADRAO);
  return { inicio, fim: new Date(fimExclusivo.getTime() - 1) };
}

function resolverDataRelativa(texto: string, agora: Date): DataLocal | null {
  const explicita = texto.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
  if (explicita) {
    let ano = explicita[3] ? Number(explicita[3]) : dataLocalDoInstante(agora).ano;
    if (ano < 100) ano += 2000;
    return { dia: Number(explicita[1]), mes: Number(explicita[2]), ano };
  }
  const hoje = dataLocalDoInstante(agora);
  if (/\bamanha\b/.test(texto)) return somarDiasCalendario(hoje, 1);
  if (/\bhoje\b/.test(texto)) return hoje;
  else return null;
}

export function extrairPeriodoConsulta(textoOriginal: string, agora = new Date()): SpecialistQueryPeriod | undefined {
  const texto = normalizar(textoOriginal);
  const data = resolverDataRelativa(texto, agora);
  if (data) {
    const janela = janelaDoDia(data);
    if (!janela) return undefined;
    const descricao = /\bamanha\b/.test(texto)
      ? 'amanha'
      : /\bhoje\b/.test(texto)
        ? 'hoje'
        : 'data_explicita';
    return { ...janela, descricao, dataLocal: dataLocalIso(data) };
  }
  if (/\bproximos? (?:7|sete) dias\b/.test(texto)) {
    return {
      inicio: agora,
      fim: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000),
      descricao: 'proximos_sete_dias',
    };
  }
  return undefined;
}

export function extrairHorarioProposto(textoOriginal: string, agora = new Date()): Date | undefined {
  const texto = normalizar(textoOriginal);
  const data = resolverDataRelativa(texto, agora);
  const hora = texto.match(/(?:\b(?:as|a|para)\s+)(\d{1,2})(?::|h)?(\d{2})?\b|\b(\d{1,2})(?::|h)(\d{2})?\b/);
  if (!data || !hora) return undefined;
  const horas = Number(hora[1] || hora[3]);
  const minutos = Number(hora[2] || hora[4] || 0);
  if (horas > 23 || minutos > 59 || data.dia < 1 || data.dia > 31 || data.mes < 1 || data.mes > 12) return undefined;
  const localIso = `${String(data.ano).padStart(4, '0')}-${String(data.mes).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}T${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;
  const result = fromZonedTime(localIso, AGENDA_TIMEZONE_PADRAO);
  return Number.isFinite(result.getTime()) && result > agora ? result : undefined;
}

export function interpretarIntencaoEspecialista(textoOriginal: string, agora = new Date()): SpecialistIntent {
  const texto = normalizar(textoOriginal);
  const horarioProposto = extrairHorarioProposto(textoOriginal, agora);
  if (horarioProposto && /\b(posso|consigo|melhor|prefiro|sugiro|disponivel|trocar|mudar)\b/.test(texto)) {
    return { name: 'CONTRAPROPOR', horarioProposto, confidence: 'HIGH' };
  }
  if (/\b(cancelar|minha participacao|nao vou mais|nao poderei mais)\b/.test(texto)) {
    return { name: 'CANCELAR_PARTICIPACAO', confidence: 'HIGH' };
  }
  if (/\b(nao consigo|nao posso|recuso|recusar|indisponivel|ausencia)\b/.test(texto)) {
    return { name: 'RECUSAR', confidence: 'HIGH' };
  }
  if (/^(sim|ok|confirmo|confirmado|pode confirmar|vou atender|estarei la)[.! ]*$/.test(texto)
    || /\b(pode confirmar|confirmo o horario|vou atender)\b/.test(texto)) {
    return { name: 'CONFIRMAR', confidence: 'HIGH' };
  }
  if (/\b(agenda|agendamentos|atendimentos|compromissos|qual dia|qual horario|detalhes|imovel)\b/.test(texto)) {
    return {
      name: 'CONSULTAR',
      periodoConsulta: extrairPeriodoConsulta(textoOriginal, agora),
      confidence: 'HIGH',
    };
  }
  return { name: 'DESCONHECIDA', confidence: 'LOW' };
}
