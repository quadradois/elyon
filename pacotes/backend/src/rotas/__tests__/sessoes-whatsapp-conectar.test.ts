import express from 'express';
import request from 'supertest';
import { correlationIdMiddleware } from '../../middleware/correlation-id';
import { EvolutionIntegrationError } from '../../servicos/evolution-error';

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockConectarInstancia = jest.fn();

jest.mock('../../lib/db', () => ({
  prisma: {
    sessaoWhatsapp: { findUnique: mockFindUnique, update: mockUpdate },
  },
}));
jest.mock('../../middleware/middleware-auth', () => ({
  verificarAutenticacao: (_req: unknown, _res: unknown, next: () => void) => next(),
  verificarSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../utils/tenant', () => ({ getTenantId: () => 'tenant-a' }));
jest.mock('../../servicos/whatsapp', () => ({
  getWhatsAppService: () => ({ conectarInstancia: mockConectarInstancia }),
  limparCacheWhatsApp: jest.fn(),
  listarInstanciasEvolution: jest.fn(),
  deletarInstanciaEvolutionPorId: jest.fn(),
}));
jest.mock('../../lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import router from '../sessoes-whatsapp';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(correlationIdMiddleware);
  instance.use('/api/sessoes-whatsapp', router);
  return instance;
}

describe('POST /api/sessoes-whatsapp/:id/conectar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'session-id',
      tenantId: 'tenant-a',
      instanceName: 'elyon_test',
      evolutionInstanceId: 'remote-id',
      evolutionToken: 'remote-token',
      status: 'DESCONECTADO',
    });
    mockUpdate.mockResolvedValue({});
  });

  it('responde 502 correlacionável e restaura DESCONECTADO quando o upstream rejeita', async () => {
    mockConectarInstancia.mockRejectedValue(new EvolutionIntegrationError({
      message: 'rejected',
      stage: 'instance/connect',
      route: '/instance/connect',
      upstreamStatus: 401,
      reasonCode: 'EVOLUTION_AUTH_REJECTED',
      httpStatus: 502,
      instanceAlreadyExisted: true,
    }));

    const response = await request(app())
      .post('/api/sessoes-whatsapp/session-id/conectar')
      .set('x-correlation-id', 'connection-test-123');

    expect(response.status).toBe(502);
    expect(response.headers['x-correlation-id']).toBe('connection-test-123');
    expect(response.body).toEqual({
      sucesso: false,
      erro: 'Falha ao conectar WhatsApp',
      reasonCode: 'EVOLUTION_AUTH_REJECTED',
      correlationId: 'connection-test-123',
      stage: 'instance/connect',
      upstreamStatus: 401,
      upstreamRoute: '/instance/connect',
    });
    const serializedResponse = JSON.stringify(response.body);
    expect(serializedResponse).not.toContain('remote-token');
    expect(serializedResponse).not.toContain('remote-id');
    expect(serializedResponse).not.toContain('elyon_test');
    expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ status: 'CONECTANDO' }) }));
    expect(mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ status: 'DESCONECTADO' }) }));
  });

  it('responde 503 quando a Evolution está indisponível', async () => {
    mockConectarInstancia.mockRejectedValue(new EvolutionIntegrationError({
      message: 'down',
      stage: 'instance/connect',
      route: '/instance/connect',
      reasonCode: 'EVOLUTION_UNAVAILABLE',
      httpStatus: 503,
      instanceAlreadyExisted: true,
    }));

    const response = await request(app()).post('/api/sessoes-whatsapp/session-id/conectar');

    expect(response.status).toBe(503);
    expect(response.body.reasonCode).toBe('EVOLUTION_UNAVAILABLE');
    expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DESCONECTADO' }) }));
  });
});
