import { metricsRegistry } from '../metricas';
import { followupAtraso, followupEventos } from '../followup-outbound-metrics';

describe('metricas de follow-up outbound', () => {
  it('expoe ciclo e atraso sem labels de identidade ou PII', async () => {
    followupEventos.inc({ resultado: 'criado' }); followupEventos.inc({ resultado: 'bloqueado_opt_out' }); followupAtraso.observe(5);
    const output = await metricsRegistry.metrics();
    expect(output).toContain('elyon_followup_outbound_events_total');
    expect(output).toContain('elyon_followup_outbound_schedule_lag_seconds');
    expect(output).not.toMatch(/tenantId|leadId|telefone|nome|mensagem/);
  });
});
