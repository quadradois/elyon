import type { Lead } from '@prisma/client';
import type { EstadoConversa, SchemaState } from './conversation-state';

export type TemporalFactType =
  | 'INTENCAO'
  | 'STATUS_ANUNCIO'
  | 'TIMELINE'
  | 'URGENCIA'
  | 'OBJECAO'
  | 'DECISAO_VENDA';

export interface TemporalFact {
  type: TemporalFactType;
  fact: string;
  validFrom: Date;
  validUntil: Date | null;
  confidence: number;
  source: 'estado' | 'lead' | 'schema';
}

export interface TemporalFactsStats {
  total: number;
  ativos: number;
  expirados: number;
  taxaExpirados: number;
}

interface BuildTemporalFactsParams {
  estadoConversaAtual: EstadoConversa;
  schemaState?: SchemaState;
  leadRecord?: Lead | null;
  now?: Date;
}

const POLICY_TTL_HOURS: Record<TemporalFactType, number | null> = {
  INTENCAO: 24 * 30,          // 30 dias
  STATUS_ANUNCIO: 24 * 14,    // 14 dias
  TIMELINE: 24 * 7,           // 7 dias
  URGENCIA: 24 * 2,           // 48h
  OBJECAO: 24,                // 24h
  DECISAO_VENDA: 24 * 30,     // 30 dias
};

function addHours(base: Date, hours: number): Date {
  const d = new Date(base);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

function getLeadDate(lead?: Lead | null, fallback?: Date): Date {
  if (!lead) return fallback || new Date();
  return (lead.ultimaInteracao || lead.atualizadoEm || lead.criadoEm || fallback || new Date()) as Date;
}

function createFact(
  type: TemporalFactType,
  fact: string,
  source: TemporalFact['source'],
  validFrom: Date,
  confidence = 0.8
): TemporalFact {
  const ttl = POLICY_TTL_HOURS[type];
  return {
    type,
    fact,
    validFrom,
    validUntil: ttl === null ? null : addHours(validFrom, ttl),
    confidence,
    source,
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function inferTemporalFacts(params: BuildTemporalFactsParams): TemporalFact[] {
  const now = params.now || new Date();
  const leadDate = getLeadDate(params.leadRecord, now);
  const facts: TemporalFact[] = [];
  const estado = params.estadoConversaAtual;
  const schema = params.schemaState;
  const lead = params.leadRecord;

  if (estado.intencao) {
    facts.push(createFact('INTENCAO', `Lead quer ${estado.intencao}`, 'estado', now, 0.9));
  } else if (lead?.interesseEm) {
    facts.push(createFact('INTENCAO', `Lead quer ${String(lead.interesseEm).toLowerCase()}`, 'lead', leadDate, 0.8));
  }

  if (estado.statusAnuncio) {
    const origem = estado.origemAnuncio ? ` (${estado.origemAnuncio})` : '';
    facts.push(createFact('STATUS_ANUNCIO', `Status anúncio: ${estado.statusAnuncio}${origem}`, 'estado', now, 0.85));
  } else if (typeof (lead as any)?.comCorretorAtualmente === 'boolean') {
    const valor = (lead as any).comCorretorAtualmente ? 'sim' : 'nao';
    facts.push(createFact('STATUS_ANUNCIO', `Status anúncio: ${valor}`, 'lead', leadDate, 0.75));
  }

  if (estado.timeline) {
    facts.push(createFact('TIMELINE', `Timeline mencionada: ${estado.timeline}`, 'estado', now, 0.8));
  } else if (lead?.prazoDesejado) {
    facts.push(createFact('TIMELINE', `Prazo desejado: ${lead.prazoDesejado}`, 'lead', leadDate, 0.7));
  }

  if (lead?.urgencia) {
    facts.push(createFact('URGENCIA', `Urgência: ${lead.urgencia}`, 'lead', leadDate, 0.8));
  }

  if (estado.jaRespondeuDecisao || schema?.jaRespondeuDecisao) {
    facts.push(createFact('DECISAO_VENDA', 'Lead já confirmou decisão de venda', 'schema', now, 0.9));
  }

  const objecoes = uniqueStrings([
    ...(Array.isArray(lead?.objecoes) ? lead!.objecoes : []),
    ...(Array.isArray(lead?.doresIdentificadas) ? lead!.doresIdentificadas : []),
  ]).slice(0, 4);
  for (const obj of objecoes) {
    facts.push(createFact('OBJECAO', `Objeção/dor recente: ${obj}`, 'lead', leadDate, 0.7));
  }

  return facts;
}

export function filterActiveTemporalFacts(
  facts: TemporalFact[],
  now = new Date()
): { ativos: TemporalFact[]; expirados: TemporalFact[]; stats: TemporalFactsStats } {
  const ativos: TemporalFact[] = [];
  const expirados: TemporalFact[] = [];
  for (const fact of facts) {
    const expired = fact.validUntil !== null && fact.validUntil.getTime() <= now.getTime();
    if (expired) expirados.push(fact);
    else ativos.push(fact);
  }
  const total = facts.length;
  const taxaExpirados = total > 0 ? Number(((expirados.length / total) * 100).toFixed(1)) : 0;
  return {
    ativos,
    expirados,
    stats: {
      total,
      ativos: ativos.length,
      expirados: expirados.length,
      taxaExpirados,
    },
  };
}

export function formatTemporalFactsForPrompt(facts: TemporalFact[], limit = 6): string {
  if (!facts.length) return '';
  const top = facts.slice(0, Math.max(1, limit));
  const lines = top.map((fact, idx) => {
    const validade = fact.validUntil ? fact.validUntil.toISOString() : 'sem expiração';
    return `${idx + 1}. ${fact.fact} (confiança ${(fact.confidence * 100).toFixed(0)}%, válido até ${validade})`;
  });
  return [
    'FATOS TEMPORAIS ATIVOS (NÃO reutilize fatos vencidos):',
    ...lines,
  ].join('\n');
}

export function buildTemporalFactsContext(params: BuildTemporalFactsParams): {
  fatosAtivos: TemporalFact[];
  fatosExpirados: TemporalFact[];
  secaoPrompt: string;
  stats: TemporalFactsStats;
} {
  const now = params.now || new Date();
  const inferidos = inferTemporalFacts({ ...params, now });
  const filtrados = filterActiveTemporalFacts(inferidos, now);
  return {
    fatosAtivos: filtrados.ativos,
    fatosExpirados: filtrados.expirados,
    secaoPrompt: formatTemporalFactsForPrompt(filtrados.ativos),
    stats: filtrados.stats,
  };
}

