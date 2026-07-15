import { metricsRegistry } from '../metricas';
import { agendaComercialEventos } from '../agenda-comercial-metrics';

describe('agenda commercial metrics', () => {
  it('expoe a metrica sem labels de identidade ou PII', async () => {
    agendaComercialEventos.inc({ resultado: 'cancelled' });
    const output = await metricsRegistry.metrics();
    expect(output).toContain('elyon_agenda_commercial_commands_total');
    expect(output).toContain('resultado="cancelled"');
    expect(output).not.toContain('tenantId');
    expect(output).not.toContain('leadId');
    expect(output).not.toContain('atividadeId');
  });
});
