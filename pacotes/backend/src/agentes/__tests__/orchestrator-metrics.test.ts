const mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.mock('../../lib/logger', () => ({ logger: mockLogger }));

import { logMetricaOrchestrator, shortId, avaliarConsumoTokens } from '../orchestrator-metrics';

describe('orchestrator-metrics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('shortId retorna null para valor vazio e trunca ids longos', () => {
    expect(shortId(undefined)).toBeNull();
    expect(shortId('abc')).toBe('abc');
    expect(shortId('123456789012')).toBe('12345678...');
  });

  it('logMetricaOrchestrator serializa payload com defaults esperados', () => {
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

    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    const line = String(mockLogger.debug.mock.calls[0][0]);
    expect(line.startsWith('[ORCH-METRICS] ')).toBe(true);

    const payloadRaw = line.replace('[ORCH-METRICS] ', '');
    const payload = JSON.parse(payloadRaw);

    expect(payload.tenantId).toBe('tenant-1');
    expect(payload.statusLead).toBe('SEM_STATUS');
    expect(payload.contatoId).toBe('contato-...');
    expect(payload.leadId).toBe('lead-123...');
    expect(payload.guardrail).toBeNull();
    expect(payload.tokensInput).toBeNull();
    expect(payload.tokensOutput).toBeNull();
    expect(payload.tokensTotal).toBeNull();
  });

  it('logMetricaOrchestrator inclui tokens quando fornecidos', () => {
    logMetricaOrchestrator({
      tenantId: 'tenant-2',
      faseFluxo: 'FASE2_DIAGNOSTICO',
      toolCalls: 1,
      handoffs: 0,
      fallback: 'NONE',
      duracaoMs: 100,
      sucesso: true,
      tokens: { inputTokens: 500, outputTokens: 150, totalTokens: 650 },
    });

    const line = String(mockLogger.debug.mock.calls[0][0]);
    const payload = JSON.parse(line.replace('[ORCH-METRICS] ', ''));

    expect(payload.tokensInput).toBe(500);
    expect(payload.tokensOutput).toBe(150);
    expect(payload.tokensTotal).toBe(650);
    expect(payload.tokenAlertLevel).toBe('ok');
    expect(payload.custoEstimadoUSD).toBeGreaterThan(0);
  });

  it('emite warn quando tokens excedem threshold WARN (4000)', () => {
    logMetricaOrchestrator({
      tenantId: 'tenant-warn',
      faseFluxo: 'FASE2_DIAGNOSTICO',
      toolCalls: 3,
      handoffs: 0,
      fallback: 'NONE',
      duracaoMs: 200,
      sucesso: true,
      tokens: { inputTokens: 3500, outputTokens: 1500, totalTokens: 5000 },
    });

    const debugLine = String(mockLogger.debug.mock.calls[0][0]);
    const payload = JSON.parse(debugLine.replace('[ORCH-METRICS] ', ''));
    expect(payload.tokenAlertLevel).toBe('warn');

    // Deve ter emitido logger.warn com alerta
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[ORCH-TOKENS] ⚠️ WARN')
    );
  });

  it('emite critical quando tokens excedem threshold CRIT (8000)', () => {
    logMetricaOrchestrator({
      tenantId: 'tenant-crit',
      faseFluxo: 'FASE3_PITCH',
      toolCalls: 5,
      handoffs: 2,
      fallback: 'NONE',
      duracaoMs: 500,
      sucesso: true,
      telefone: '5562999990000',
      tokens: { inputTokens: 7000, outputTokens: 3000, totalTokens: 10000 },
    });

    const debugLine = String(mockLogger.debug.mock.calls[0][0]);
    const payload = JSON.parse(debugLine.replace('[ORCH-METRICS] ', ''));
    expect(payload.tokenAlertLevel).toBe('critical');

    // Deve ter emitido logger.warn com alerta CRITICAL (mais detalhado)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[ORCH-TOKENS] 🚨 CRITICAL')
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('10000 tokens')
    );
  });

  it('NÃO emite alerta quando tokens estão dentro do normal', () => {
    logMetricaOrchestrator({
      tenantId: 'tenant-ok',
      faseFluxo: 'FASE1_QUALIFICACAO',
      toolCalls: 1,
      handoffs: 0,
      fallback: 'NONE',
      duracaoMs: 50,
      sucesso: true,
      tokens: { inputTokens: 800, outputTokens: 200, totalTokens: 1000 },
    });

    // warn NÃO deve ter sido chamado (somente debug)
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});

// ====================================
// AVALIAÇÃO DE CONSUMO DE TOKENS (unit)
// ====================================

describe('avaliarConsumoTokens', () => {
  it('retorna "ok" quando tokens são baixos', () => {
    const result = avaliarConsumoTokens({ inputTokens: 500, outputTokens: 100, totalTokens: 600 });
    expect(result.level).toBe('ok');
    expect(result.totalTokens).toBe(600);
    expect(result.custoEstimadoUSD).toBeGreaterThan(0);
  });

  it('retorna "warn" entre 4000 e 8000 tokens', () => {
    const result = avaliarConsumoTokens({ inputTokens: 3000, outputTokens: 2000, totalTokens: 5000 });
    expect(result.level).toBe('warn');
  });

  it('retorna "critical" acima de 8000 tokens', () => {
    const result = avaliarConsumoTokens({ inputTokens: 7000, outputTokens: 3000, totalTokens: 10000 });
    expect(result.level).toBe('critical');
  });

  it('retorna "ok" quando tokens são undefined', () => {
    const result = avaliarConsumoTokens(undefined);
    expect(result.level).toBe('ok');
    expect(result.totalTokens).toBe(0);
    expect(result.custoEstimadoUSD).toBe(0);
  });

  it('calcula custo estimado corretamente', () => {
    // 1000 input tokens @ $0.002/1K = $0.002
    // 1000 output tokens @ $0.008/1K = $0.008
    // Total = $0.010
    const result = avaliarConsumoTokens({ inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 });
    expect(result.custoEstimadoUSD).toBeCloseTo(0.010, 4);
  });
});
