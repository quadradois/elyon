import { formatRagFactsForPrompt, normalizeRagQuery, RAG_FACTS_CONTRACT_VERSION, selectRagFacts, withRagTimeout, type RagFact } from '../rag-facts-context';

const base: RagFact = {
  contractVersion: RAG_FACTS_CONTRACT_VERSION,
  id: 'a', conteudo: 'fato seguro', origem: 'conversa', recuperadoEm: '2026-01-02T00:00:00.000Z',
  ocorridoEm: '2026-01-01T00:00:00.000Z', confianca: 0.9, tenantId: 'tenant-a', leadId: 'lead-a', relevancia: 0.8,
};

describe('contrato e policy de fatos RAG', () => {
  it('rejeita cross-tenant, cross-lead, expirado e baixa confianca', () => {
    const result = selectRagFacts({ tenantId: 'tenant-a', leadId: 'lead-a', now: new Date('2026-02-01T00:00:00Z'), candidates: [
      base, { ...base, id: 'tenant', tenantId: 'tenant-b' }, { ...base, id: 'lead', leadId: 'lead-b' },
      { ...base, id: 'expired', expiresAt: '2026-01-31T00:00:00Z' }, { ...base, id: 'low', confianca: 0.2 },
    ] });
    expect(result.facts.map(f => f.id)).toEqual(['a']);
    expect(result.discarded).toMatchObject({ TENANT_MISMATCH: 1, LEAD_MISMATCH: 1, EXPIRED: 1, LOW_CONFIDENCE: 1 });
  });

  it('ordena e trunca deterministicamente com desempate estavel', () => {
    const candidates = [{ ...base, id: 'b', conteudo: 'bbbb' }, { ...base, id: 'a', conteudo: 'aaaa' }, { ...base, id: 'c', conteudo: 'cccc', relevancia: 0.7 }];
    const one = selectRagFacts({ candidates, tenantId: 'tenant-a', leadId: 'lead-a', policy: { maxCharacters: 8, maxFacts: 2 } });
    const replay = selectRagFacts({ candidates: [...candidates].reverse(), tenantId: 'tenant-a', leadId: 'lead-a', policy: { maxCharacters: 8, maxFacts: 2 } });
    expect(one.facts.map(f => f.id)).toEqual(['a', 'b']);
    expect(replay.facts.map(f => f.id)).toEqual(['a', 'b']);
    expect(one.truncated).toBe(true);
  });

  it('classifica campos malformados e policy invalida como INVALID de modo estavel', () => {
    const malformed: RagFact[] = [
      { ...base, id: 'bad-date', recuperadoEm: 'ontem' },
      { ...base, id: 'bad-occurred', ocorridoEm: '2026-99-99T00:00:00Z' },
      { ...base, id: 'bad-expiry', expiresAt: 'nunca' },
      { ...base, id: 'nan-confidence', confianca: Number.NaN },
      { ...base, id: 'infinite-relevance', relevancia: Number.POSITIVE_INFINITY },
      { ...base, id: 'range-confidence', confianca: 1.1 },
      { ...base, id: 'range-relevance', relevancia: -0.1 },
      { ...base, id: 'empty-origin', origem: ' ' },
      { ...base, id: 'empty-tenant', tenantId: '' },
      { ...base, id: 'empty-lead', leadId: '' },
    ];
    const valid = [{ ...base, id: 'b' }, { ...base, id: 'a' }];
    const select = (candidates: RagFact[]) => selectRagFacts({ candidates, tenantId: 'tenant-a', leadId: 'lead-a' });
    expect(select(malformed).discarded.INVALID).toBe(malformed.length);
    const forward = select([...valid, ...malformed]);
    const inverted = select([...valid, ...malformed].reverse());
    expect(forward.facts.map(f => f.id)).toEqual(['a', 'b']);
    expect(inverted).toEqual(forward);
    for (const policy of [{ minConfidence: 2 }, { minConfidence: Number.NaN }, { maxFacts: 0 }, { maxFacts: 1.5 }, { maxCharacters: -1 }, { maxCharacters: 1.5 }]) {
      expect(selectRagFacts({ candidates: [base], tenantId: 'tenant-a', leadId: 'lead-a', policy }).discarded.INVALID).toBe(1);
    }
  });

  it('normaliza e limita deterministicamente a query consolidada', () => {
    expect(normalizeRagQuery('  tenho\tuma casa\n quero vender  ')).toBe('tenho uma casa quero vender');
    expect(normalizeRagQuery('primeiro segundo terceiro', 15)).toBe('terceiro');
  });

  it('nao expoe id interno e declara limites de autoridade', () => {
    const prompt = formatRagFactsForPrompt([{ ...base, id: 'internal-secret-uuid' }]);
    expect(prompt).toContain('FATOS RAG PERSISTIDOS');
    expect(prompt).toContain('nao autorizam mutacoes de dominio');
    expect(prompt).toContain('<rag_facts_untrusted encoding="json">');
    expect(prompt).not.toContain('internal-secret-uuid');
  });

  it('faz timeout fail-closed sem bloquear o fluxo chamador', async () => {
    await expect(withRagTimeout(new Promise(() => undefined), 5)).rejects.toThrow('RAG_CONTEXT_TIMEOUT');
  });
});
