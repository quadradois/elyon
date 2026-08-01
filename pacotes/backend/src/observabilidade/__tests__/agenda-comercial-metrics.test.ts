import { metricsRegistry } from '../metricas';
import {
  agendaComercialEventos,
  agendaLifecycleExpiredPending,
  agendaLifecycleOperationalQueueAgeSeconds,
  registrarAgendaLifecycleDecision,
  registrarAgendaPilotConfig,
} from '../agenda-comercial-metrics';

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
    const startedAtUtc = '2027-02-10T12:00:00.000Z';
    registrarAgendaPilotConfig({
      scope: { tenantId, startedAtUtc },
      lifecyclePolicy: { requested: true, enabled: true, reason: 'ENABLED' },
      lifecycleCommands: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
      effects: { requested: true, enabled: true, reason: 'ENABLED' },
      noShow: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
    });
    const output = await metricsRegistry.metrics();
    expect(output).toContain('elyon_agenda_pilot_gate');
    expect(output).toContain('elyon_agenda_pilot_tenant_scope_count 1');
    expect(output).toContain('elyon_agenda_pilot_cutoff_configured 1');
    expect(output).not.toContain(tenantId);
    expect(output).not.toContain(startedAtUtc);
  });

  it('registra decisoes e filas somente com labels de cardinalidade limitada', async () => {
    registrarAgendaLifecycleDecision({ resultado: 'rejeitado', reasonCode: 'APPOINTMENT_STARTED', fase: 'INICIADO' });
    registrarAgendaLifecycleDecision({ resultado: 'conflito', reasonCode: 'valor livre com pii', fase: 'FUTURO' });
    agendaLifecycleExpiredPending.set(3);
    agendaLifecycleOperationalQueueAgeSeconds.set(120);

    const output = await metricsRegistry.metrics();
    expect(output).toContain('reason_code="appointment_started"');
    expect(output).toContain('reason_code="unknown"');
    expect(output).toContain('elyon_agenda_lifecycle_expired_pending 3');
    expect(output).toContain('elyon_agenda_lifecycle_operational_queue_age_seconds 120');
    expect(output).not.toContain('valor livre com pii');
  });
});
