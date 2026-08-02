import { metricsRegistry } from '../metricas';
import { registrarAgendaLifecycleDecision } from '../agenda-comercial-metrics';

describe('privacidade da observabilidade da Agenda', () => {
  it('não aceita nome, telefone ou conversa como label de decisão', async () => {
    registrarAgendaLifecycleDecision({
      resultado: 'rejeitado',
      reasonCode: 'Ivonet 5562999999999 quer vender o imóvel',
      fase: 'FUTURO',
    });
    const metrics = await metricsRegistry.metrics();
    expect(metrics).not.toContain('Ivonet');
    expect(metrics).not.toContain('5562999999999');
    expect(metrics).not.toContain('quer vender');
    expect(metrics).toContain('reason_code="unknown"');
  });
});
