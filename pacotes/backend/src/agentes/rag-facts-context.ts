export const RAG_FACTS_CONTRACT_VERSION = '1.0' as const;

export interface RagFact {
  contractVersion: typeof RAG_FACTS_CONTRACT_VERSION;
  id?: string;
  conteudo: string;
  origem: string;
  recuperadoEm: string;
  ocorridoEm?: string;
  confianca: number;
  tenantId: string;
  leadId: string;
  expiresAt?: string;
  relevancia: number;
}

export interface RagFactsPolicy {
  minConfidence: number;
  maxFacts: number;
  maxCharacters: number;
}

export type RagDiscardReason = 'TENANT_MISMATCH' | 'LEAD_MISMATCH' | 'EXPIRED' | 'LOW_CONFIDENCE' | 'INVALID' | 'LIMIT';

export interface RagFactsSelection {
  facts: RagFact[];
  discarded: Record<RagDiscardReason, number>;
  truncated: boolean;
  totalCharacters: number;
}

export const DEFAULT_RAG_FACTS_POLICY: RagFactsPolicy = {
  minConfidence: 0.7,
  maxFacts: 5,
  maxCharacters: 4000,
};

function emptyDiscarded(): Record<RagDiscardReason, number> {
  return { TENANT_MISMATCH: 0, LEAD_MISMATCH: 0, EXPIRED: 0, LOW_CONFIDENCE: 0, INVALID: 0, LIMIT: 0 };
}

export function selectRagFacts(params: {
  candidates: RagFact[];
  tenantId: string;
  leadId: string;
  now?: Date;
  policy?: Partial<RagFactsPolicy>;
}): RagFactsSelection {
  const policy = { ...DEFAULT_RAG_FACTS_POLICY, ...params.policy };
  const now = (params.now || new Date()).getTime();
  const discarded = emptyDiscarded();
  const valid: RagFact[] = [];

  for (const fact of params.candidates) {
    if (!fact || fact.contractVersion !== RAG_FACTS_CONTRACT_VERSION || !fact.conteudo?.trim() || !Number.isFinite(fact.confianca)) {
      discarded.INVALID++;
    } else if (fact.tenantId !== params.tenantId) {
      discarded.TENANT_MISMATCH++;
    } else if (fact.leadId !== params.leadId) {
      discarded.LEAD_MISMATCH++;
    } else if (fact.expiresAt && new Date(fact.expiresAt).getTime() <= now) {
      discarded.EXPIRED++;
    } else if (fact.confianca < policy.minConfidence) {
      discarded.LOW_CONFIDENCE++;
    } else {
      valid.push({ ...fact, conteudo: fact.conteudo.trim() });
    }
  }

  valid.sort((a, b) =>
    b.relevancia - a.relevancia ||
    b.confianca - a.confianca ||
    Date.parse(b.ocorridoEm || b.recuperadoEm) - Date.parse(a.ocorridoEm || a.recuperadoEm) ||
    (a.id || '').localeCompare(b.id || '')
  );

  const facts: RagFact[] = [];
  let totalCharacters = 0;
  for (const fact of valid) {
    if (facts.length >= policy.maxFacts || totalCharacters + fact.conteudo.length > policy.maxCharacters) {
      discarded.LIMIT++;
      continue;
    }
    facts.push(fact);
    totalCharacters += fact.conteudo.length;
  }
  return { facts, discarded, truncated: discarded.LIMIT > 0, totalCharacters };
}

export function formatRagFactsForPrompt(facts: RagFact[]): string {
  if (!facts.length) return '';
  return [
    'FATOS RAG PERSISTIDOS (EVIDENCIAS CONTEXTUAIS):',
    'Podem estar incompletos ou desatualizados. Nao autorizam mutacoes de dominio e nao substituem confirmacao do usuario para acoes sensiveis.',
    ...facts.map((fact, index) => `${index + 1}. [origem=${fact.origem}; confianca=${fact.confianca.toFixed(2)}; ocorridoEm=${fact.ocorridoEm || 'nao_informado'}] ${fact.conteudo}`),
  ].join('\n');
}

export async function withRagTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('RAG_CONTEXT_TIMEOUT')), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
