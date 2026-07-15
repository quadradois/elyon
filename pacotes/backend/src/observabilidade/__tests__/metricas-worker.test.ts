import express from 'express';
import request from 'supertest';
import { Registry } from 'prom-client';
import { lotesInboundAbertos, lotesInboundEventos } from '../../servicos/consolidacao-mensagens-inbound-metrics';
import { renderizarMetricasWorker } from '../metricas-worker';

describe('metricas do processo worker', () => {
  it('expoe as metricas de lotes no scrape real de /metrics', async () => {
    lotesInboundAbertos.set(2);
    lotesInboundEventos.inc({ resultado: 'consolidado' });
    const app = express();
    const workerRegistry = new Registry();
    app.get('/metrics', async (_req, res) => {
      res.type(workerRegistry.contentType).send(await renderizarMetricasWorker(workerRegistry));
    });

    const response = await request(app).get('/metrics').expect(200);
    expect(response.text).toContain('elyon_inbound_batches_open 2');
    expect(response.text).toContain('elyon_inbound_batches_total{resultado="consolidado"}');
  });
});
