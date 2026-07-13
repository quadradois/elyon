import express from 'express';
import request from 'supertest';
import {
  metricsHandler,
  requireInternalMetricsAccess,
} from '../metricas';

describe('metrics endpoint', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('expõe métricas Prometheus em acesso interno', async () => {
    process.env.NODE_ENV = 'production';
    const app = express();
    app.get('/metrics', requireInternalMetricsAccess, metricsHandler);

    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('elyon_process_cpu_seconds_total');
  });

  it('oculta métricas de requisições encaminhadas pelo proxy público', async () => {
    process.env.NODE_ENV = 'production';
    const app = express();
    app.get('/metrics', requireInternalMetricsAccess, metricsHandler);

    const response = await request(app)
      .get('/metrics')
      .set('x-forwarded-for', '203.0.113.15');

    expect(response.status).toBe(404);
  });
});
