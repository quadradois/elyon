import { metricsRegistry } from '../metricas';
import { recordRagRecovery, recordRagSelection } from '../rag-facts-metrics';

describe('metricas de fatos RAG', () => {
  it('expoe somente contagens e reason codes, sem conteudo ou identidades', async () => {
    recordRagRecovery('success');
    recordRagSelection({
      facts: [{ contractVersion: '1.0', conteudo: 'PII_TELEFONE_5511999999999', origem: 'teste', recuperadoEm: '2026-01-01T00:00:00Z', confianca: 0.9, tenantId: 'tenant-secret', leadId: 'lead-secret', relevancia: 0.8 }],
      discarded: { TENANT_MISMATCH: 1, LEAD_MISMATCH: 0, EXPIRED: 0, LOW_CONFIDENCE: 0, INVALID: 0, LIMIT: 0 },
      truncated: false,
      totalCharacters: 24,
    });
    const output = await metricsRegistry.metrics();
    expect(output).toContain('elyon_rag_facts_selected_total');
    expect(output).toContain('reason="TENANT_MISMATCH"');
    expect(output).not.toContain('PII_TELEFONE');
    expect(output).not.toContain('tenant-secret');
    expect(output).not.toContain('lead-secret');
  });
});
