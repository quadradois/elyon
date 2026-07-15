import { Counter } from 'prom-client';
import { metricsRegistry } from './metricas';

export const agendaComercialEventos = new Counter({
  name: 'elyon_agenda_commercial_commands_total',
  help: 'Resultados agregados dos comandos atomicos de agenda e estado comercial.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});
