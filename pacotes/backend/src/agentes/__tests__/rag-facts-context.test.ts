import { formatRagFactsForPrompt, RAG_FACTS_CONTRACT_VERSION, selectRagFacts, withRagTimeout, type RagFact } from '../rag-facts-context';

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

  it('nao expoe id interno e declara limites de autoridade', () => {
    const prompt = formatRagFactsForPrompt([{ ...base, id: 'internal-secret-uuid' }]);
    expect(prompt).toContain('FATOS RAG PERSISTIDOS');
    expect(prompt).toContain('Nao autorizam mutacoes de dominio');
    expect(prompt).not.toContain('internal-secret-uuid');
  });

  it('faz timeout fail-closed sem bloquear o fluxo chamador', async () => {
    await expect(withRagTimeout(new Promise(() => undefined), 5)).rejects.toThrow('RAG_CONTEXT_TIMEOUT');
  });
});
