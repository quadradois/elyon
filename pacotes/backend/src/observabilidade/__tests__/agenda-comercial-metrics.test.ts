import { metricsRegistry } from '../metricas';
import { agendaComercialEventos, registrarAgendaPilotConfig } from '../agenda-comercial-metrics';

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

  it('expoe o gate do piloto sem publicar a identidade configurada', async () => {
    const tenantId = '7fa1c55e-3148-4d6c-ae6e-9547374f6e09';
    registrarAgendaPilotConfig({
      tenantIds: [tenantId],
      effects: { requested: true, enabled: true, reason: 'ENABLED' },
      noShow: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
    });
    const output = await metricsRegistry.metrics();
    expect(output).toContain('elyon_agenda_pilot_gate');
    expect(output).toContain('elyon_agenda_pilot_tenant_scope_count 1');
    expect(output).not.toContain(tenantId);
  });
});
