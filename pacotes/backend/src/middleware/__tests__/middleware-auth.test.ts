import { NextFunction, Request, Response } from 'express';

const findUnique = jest.fn();
const redisGet = jest.fn();
const redisSetEx = jest.fn();
const redisDel = jest.fn();
const verificarToken = jest.fn();

jest.mock('../../lib/db', () => ({
  prisma: { usuario: { findUnique: (...args: unknown[]) => findUnique(...args) } }
}));
jest.mock('../../lib/redis', () => ({
  getRedisClient: jest.fn(async () => ({ get: redisGet, setEx: redisSetEx, del: redisDel }))
}));
jest.mock('../../utilitarios/token', () => ({
  verificarToken: (...args: unknown[]) => verificarToken(...args)
}));

import { verificarAutenticacao } from '../middleware-auth';

function requisicao(): Request {
  return { headers: { authorization: 'Bearer jwt-valido' } } as Request;
}

function resposta(): Response {
  const res = {} as Response;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('middleware de autenticação REST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisGet.mockResolvedValue(null);
    redisSetEx.mockResolvedValue('OK');
    redisDel.mockResolvedValue(1);
    verificarToken.mockReturnValue({ payload: { id: 'user-1' }, erro: null });
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@elyon.test',
      papel: 'ADMIN',
      tenantId: 'tenant-a',
      estaAtivo: true,
      tenant: { status: 'ATIVO' }
    });
  });

  it('associa usuário e tenant ativos à requisição', async () => {
    const req = requisicao();
    const res = resposta();
    const next = jest.fn() as NextFunction;

    await verificarAutenticacao(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tenantId).toBe('tenant-a');
    expect(req.usuario).toMatchObject({ id: 'user-1', tenantId: 'tenant-a' });
    expect(redisSetEx).toHaveBeenCalledTimes(1);
  });

  it.each([
    { usuarioAtivo: false, tenantStatus: 'ATIVO' },
    { usuarioAtivo: true, tenantStatus: 'SUSPENSO' }
  ])('retorna 403 para usuário/tenant inativo', async ({ usuarioAtivo, tenantStatus }) => {
    findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'user@elyon.test', papel: 'ADMIN', tenantId: 'tenant-a',
      estaAtivo: usuarioAtivo, tenant: { status: tenantStatus }
    });
    const req = requisicao();
    const res = resposta();
    const next = jest.fn() as NextFunction;

    await verificarAutenticacao(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('descarta cache antigo sem status e revalida no banco', async () => {
    redisGet.mockResolvedValueOnce(JSON.stringify({
      id: 'user-1', email: 'user@elyon.test', papel: 'ADMIN', tenantId: 'tenant-a'
    }));

    await verificarAutenticacao(requisicao(), resposta(), jest.fn());

    expect(redisDel).toHaveBeenCalledWith('auth:user:user-1');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('aceita cache somente quando usuário e tenant estão ativos', async () => {
    redisGet.mockResolvedValueOnce(JSON.stringify({
      id: 'user-1', email: 'user@elyon.test', papel: 'ADMIN', tenantId: 'tenant-a',
      estaAtivo: true, tenantStatus: 'ATIVO'
    }));
    const req = requisicao();
    const next = jest.fn();

    await verificarAutenticacao(req, resposta(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(findUnique).not.toHaveBeenCalled();
    expect(req.tenantId).toBe('tenant-a');
  });
});
