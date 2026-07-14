import express from 'express';
import request from 'supertest';
import {
  httpMetricsMiddleware,
  metricsHandler,
  metricsRegistry,
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

  it('registra a rota completa sem valores de parâmetros', async () => {
    process.env.NODE_ENV = 'test';
    const app = express();
    const router = express.Router();
    app.use(httpMetricsMiddleware);
    router.get('/:id', (_req, res) => res.status(200).json({ ok: true }));
    app.use('/api/probe', router);

    const response = await request(app).get('/api/probe/123');
    const exposition = await metricsRegistry.metrics();

    expect(response.status).toBe(200);
    expect(exposition).toContain('route="/api/probe/:id"');
    expect(exposition).not.toContain('route="/api/probe/123"');
  });
});
