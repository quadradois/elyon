import { Counter } from 'prom-client';
import { metricsRegistry } from './metricas';

export const agendaComercialEventos = new Counter({
  name: 'elyon_agenda_commercial_commands_total',
  help: 'Resultados agregados dos comandos atomicos de agenda e estado comercial.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});

export const agendaEfeitosEventos = new Counter({
  name: 'elyon_agenda_commercial_effects_total',
  help: 'Resultados agregados do outbox de notificacoes de agenda.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});

export const agendaNoShowEventos = new Counter({
  name: 'elyon_agenda_no_show_worker_total',
  help: 'Resultados agregados do claimer duravel de no-show.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});
