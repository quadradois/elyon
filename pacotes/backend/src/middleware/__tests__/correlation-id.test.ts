import express from 'express';
import request from 'supertest';
import { getLogContext, runWithJobLogContext } from '../../lib/log-context';
import { correlationIdMiddleware, sanitizeHttpLogPath } from '../correlation-id';

describe('correlationIdMiddleware', () => {
  function createApp() {
    const app = express();
    app.use(correlationIdMiddleware);
    app.get('/probe', (_req, res) => res.json(getLogContext()));
    app.post('/webhooks/probe', (_req, res) => res.json(getLogContext()));
    return app;
  }

  it('preserves a valid incoming id and returns it to the caller', async () => {
    const response = await request(createApp())
      .get('/probe')
      .set('x-correlation-id', 'request-client-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('request-client-123');
    expect(response.body).toEqual({ correlationId: 'request-client-123', channel: 'rest' });
  });

  it('replaces an invalid id and classifies webhook requests', async () => {
    const response = await request(createApp())
      .post('/webhooks/probe')
      .set('x-correlation-id', 'invalid id with spaces');

    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body).toEqual({
      correlationId: response.headers['x-correlation-id'],
      channel: 'webhook',
    });
  });

  it('propagates the request id into background job context', () => {
    const result = runWithJobLogContext('job-42', () => getLogContext());
    expect(result).toMatchObject({ channel: 'job', jobId: 'job-42' });
    expect(result?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('redacts UUID path segments before logging HTTP requests', () => {
    expect(sanitizeHttpLogPath('/api/sessoes-whatsapp/7add7e92-1f8e-4224-a3ac-efec4b18239d/conectar'))
      .toBe('/api/sessoes-whatsapp/:id/conectar');
    expect(sanitizeHttpLogPath('/api/probe')).toBe('/api/probe');
  });
});
