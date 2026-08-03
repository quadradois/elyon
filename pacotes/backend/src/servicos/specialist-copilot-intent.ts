import { fromZonedTime } from 'date-fns-tz';

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
  confidence: 'HIGH' | 'LOW';
};

function normalizar(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function resolverDataRelativa(texto: string, agora: Date): { ano: number; mes: number; dia: number } | null {
  const explicita = texto.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
  if (explicita) {
    let ano = explicita[3] ? Number(explicita[3]) : agora.getFullYear();
    if (ano < 100) ano += 2000;
    return { dia: Number(explicita[1]), mes: Number(explicita[2]), ano };
  }
  const base = new Date(agora);
  if (/\bamanha\b/.test(texto)) base.setDate(base.getDate() + 1);
  else if (/\bhoje\b/.test(texto)) return { dia: base.getDate(), mes: base.getMonth() + 1, ano: base.getFullYear() };
  else return null;
  return { dia: base.getDate(), mes: base.getMonth() + 1, ano: base.getFullYear() };
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
  const result = fromZonedTime(localIso, 'America/Sao_Paulo');
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
    return { name: 'CONSULTAR', confidence: 'HIGH' };
  }
  return { name: 'DESCONHECIDA', confidence: 'LOW' };
}
