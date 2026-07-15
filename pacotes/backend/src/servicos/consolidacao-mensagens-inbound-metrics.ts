import { Counter, Gauge } from 'prom-client';
import { metricsRegistry } from '../observabilidade/metricas';

export const lotesInboundAbertos = new Gauge({
  name: 'elyon_inbound_batches_open',
  help: 'Lotes inbound aguardando fechamento ou recuperacao',
  registers: [metricsRegistry],
});

export const lotesInboundEventos = new Counter({
  name: 'elyon_inbound_batches_total',
  help: 'Eventos do ciclo de vida dos lotes inbound duraveis',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});
