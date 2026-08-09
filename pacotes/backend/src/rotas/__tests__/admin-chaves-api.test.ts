import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';

const superAdmin = jest.fn();

jest.mock('../../middleware/middleware-auth', () => ({
  verificarSuperAdmin: (...args: unknown[]) => superAdmin(...args)
}));

const create = jest.fn();
const update = jest.fn();

jest.mock('../../lib/db', () => ({
  prisma: {
    chaveApi: {
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args)
    }
  }
}));

import adminChavesApiRotas from '../admin-chaves-api';

function criarApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/chaves-api', adminChavesApiRotas);
  return app;
}

function permitirSuperAdmin(): void {
  superAdmin.mockImplementation((_req: Request, _res: Response, next: NextFunction) => next());
}

describe('administração de chaves de API (SUPER_ADMIN)', () => {
  beforeEach(() => {
    superAdmin.mockReset();
    create.mockReset();
    update.mockReset();
    superAdmin.mockImplementation((_req: Request, res: Response) => {
      res.status(403).json({ erro: 'Acesso negado' });
    });
  });

  it('cria a chave e a exibe UMA vez; o banco recebe somente o hash', async () => {
    permitirSuperAdmin();
    create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'nova-1', ...data })
    );

    const resposta = await request(criarApp())
      .post('/api/admin/chaves-api')
      .send({ nome: 'QuadraDois CRM — produção', escopos: ['mineracao:read'] });

    expect(resposta.status).toBe(201);
    const chave: string = resposta.body.chave;
    expect(chave).toMatch(/^ely_[0-9a-f]{32}$/);
    expect(resposta.body.prefixo).toBe(chave.slice(0, 8));

    const dados = create.mock.calls[0][0];
    expect(dados.data.chaveHash).toBe(createHash('sha256').update(chave).digest('hex'));
    expect(JSON.stringify(dados)).not.toContain(chave);
  });

  it('rejeita corpo sem nome ou escopos com 400', async () => {
    permitirSuperAdmin();
    const respostas = await Promise.all([
      request(criarApp()).post('/api/admin/chaves-api').send({}),
      request(criarApp()).post('/api/admin/chaves-api').send({ nome: 'x', escopos: [] })
    ]);
    expect(respostas.map((resposta) => resposta.status)).toEqual([400, 400]);
    expect(create).not.toHaveBeenCalled();
  });

  it('nega papel não-SUPER_ADMIN com 403', async () => {
    const resposta = await request(criarApp())
      .post('/api/admin/chaves-api')
      .send({ nome: 'x', escopos: ['mineracao:read'] });
    expect(resposta.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('PATCH /:id desativa a chave (revogação)', async () => {
    permitirSuperAdmin();
    update.mockResolvedValue({ id: 'chave-1', ativa: false });

    const resposta = await request(criarApp()).patch('/api/admin/chaves-api/chave-1');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ id: 'chave-1', ativa: false });
    expect(update).toHaveBeenCalledWith({ where: { id: 'chave-1' }, data: { ativa: false } });
  });

  it('PATCH em chave inexistente responde 404', async () => {
    permitirSuperAdmin();
    update.mockRejectedValue(new Error('not found'));
    const resposta = await request(criarApp()).patch('/api/admin/chaves-api/fantasma');
    expect(resposta.status).toBe(404);
  });
});
