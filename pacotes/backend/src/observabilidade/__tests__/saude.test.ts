import express from 'express';
import request from 'supertest';
import { ReadinessResult, ReadinessService, registerHealthRoutes } from '../saude';

describe('ReadinessService', () => {
  it('retorna ready quando PostgreSQL e Redis respondem', async () => {
    const service = new ReadinessService([
      { name: 'postgres', check: async () => 1 },
      { name: 'redis', check: async () => 'PONG' },
    ], 100);

    const result = await service.check();

    expect(result.status).toBe('ready');
    expect(result.dependencies).toEqual([
      expect.objectContaining({ name: 'postgres', status: 'up' }),
      expect.objectContaining({ name: 'redis', status: 'up' }),
    ]);
  });

  it('retorna not_ready sem expor a mensagem interna da falha', async () => {
    const service = new ReadinessService([
      { name: 'postgres', check: async () => { throw new Error('password=segredo'); } },
      { name: 'redis', check: async () => 'PONG' },
    ], 100);

    const result = await service.check();

    expect(result.status).toBe('not_ready');
    expect(result.dependencies[0]).toEqual(expect.objectContaining({
      name: 'postgres',
      status: 'down',
    }));
    expect(JSON.stringify(result)).not.toContain('segredo');
  });

  it('limita o tempo de uma dependência travada', async () => {
    const service = new ReadinessService([
      { name: 'redis', check: () => new Promise(() => undefined) },
    ], 20);

    const result = await service.check();

    expect(result.status).toBe('not_ready');
    expect(result.durationMs).toBeLessThan(250);
  });
});

describe('health routes', () => {
  const ready: ReadinessResult = {
    status: 'ready',
    checkedAt: '2026-07-13T00:00:00.000Z',
    durationMs: 2,
    dependencies: [
      { name: 'postgres', status: 'up', latencyMs: 1 },
      { name: 'redis', status: 'up', latencyMs: 1 },
    ],
  };

  it('mantém liveness independente das dependências', async () => {
    const app = express();
    const service = { check: jest.fn().mockRejectedValue(new Error('não deve executar')) };
    registerHealthRoutes(app, service);

    const response = await request(app).get('/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
    expect(service.check).not.toHaveBeenCalled();
  });

  it.each(['/ready', '/health', '/api/saude'])('expõe readiness em %s', async (path) => {
    const app = express();
    registerHealthRoutes(app, { check: jest.fn().mockResolvedValue(ready) });

    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('responde 503 quando uma dependência essencial falha', async () => {
    const app = express();
    registerHealthRoutes(app, {
      check: jest.fn().mockResolvedValue({
        ...ready,
        status: 'not_ready',
        dependencies: [{ name: 'redis', status: 'down', latencyMs: 10 }],
      }),
    });

    expect((await request(app).get('/ready')).status).toBe(503);
  });
});
