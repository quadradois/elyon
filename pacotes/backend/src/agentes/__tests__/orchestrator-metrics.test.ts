import { logMetricaOrchestrator, shortId } from '../orchestrator-metrics';

describe('orchestrator-metrics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shortId retorna null para valor vazio e trunca ids longos', () => {
    expect(shortId(undefined)).toBeNull();
    expect(shortId('abc')).toBe('abc');
    expect(shortId('123456789012')).toBe('12345678...');
  });

  it('logMetricaOrchestrator serializa payload com defaults esperados', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logMetricaOrchestrator({
      tenantId: 'tenant-1',
      faseFluxo: 'FASE1_QUALIFICACAO',
      toolCalls: 2,
      handoffs: 1,
      fallback: 'NONE',
      duracaoMs: 42,
      sucesso: true,
      contatoId: 'contato-123456',
      leadId: 'lead-123456',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0][0]);
    expect(line.startsWith('[ORCH-METRICS] ')).toBe(true);

    const payloadRaw = line.replace('[ORCH-METRICS] ', '');
    const payload = JSON.parse(payloadRaw);

    expect(payload.tenantId).toBe('tenant-1');
    expect(payload.statusLead).toBe('SEM_STATUS');
    expect(payload.contatoId).toBe('contato-...');
    expect(payload.leadId).toBe('lead-123...');
    expect(payload.guardrail).toBeNull();
  });
});
