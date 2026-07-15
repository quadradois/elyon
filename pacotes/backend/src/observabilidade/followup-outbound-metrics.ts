import { Counter, Histogram } from 'prom-client';
import { metricsRegistry } from './metricas';

export const followupEventos = new Counter({
  name: 'elyon_followup_outbound_events_total', help: 'Eventos agregados do ciclo de follow-up outbound.',
  labelNames: ['resultado'] as const, registers: [metricsRegistry],
});
export const followupAtraso = new Histogram({
  name: 'elyon_followup_outbound_schedule_lag_seconds', help: 'Atraso entre horario previsto e claim.',
  buckets: [0, 5, 30, 60, 300, 900, 3600], registers: [metricsRegistry],
});
