import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';

const autenticar = jest.fn();

jest.mock('../middleware-auth', () => ({
  verificarAutenticacao: (...args: unknown[]) => autenticar(...args)
}));

import { exigirAutenticacaoPorPadrao, ROTAS_PUBLICAS } from '../default-deny';

function criarApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(exigirAutenticacaoPorPadrao);
  app.all('*', (req, res) => res.json({
    tenantId: req.tenantId,
    headerTenant: req.headers['x-tenant-id'],
    queryTenant: req.query.tenantId,
    bodyTenant: req.body?.tenantId
  }));
  return app;
}

function autenticarComo(papel = 'ADMIN', tenantId = 'tenant-a'): void {
  autenticar.mockImplementation((req: Request, _res: Response, next: NextFunction) => {
    req.usuario = { id: 'user-1', email: 'u@elyon.test', papel, tenantId };
    req.tenantId = tenantId;
    next();
  });
}

describe('default deny REST', () => {
  beforeEach(() => {
    autenticar.mockReset();
    autenticar.mockImplementation((_req: Request, res: Response) => {
      res.status(401).json({ erro: 'Token não fornecido' });
    });
  });

  it.each(ROTAS_PUBLICAS)('mantém pública somente $metodo $caminho', async ({ metodo, caminho }) => {
    const agente = request(criarApp());
    const resposta = metodo === 'GET' ? await agente.get(caminho) : await agente.post(caminho);
    expect(resposta.status).toBe(200);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it('nega rota privada sem JWT, inclusive rota desconhecida', async () => {
    const resposta = await request(criarApp()).get('/api/clientes');
    expect(resposta.status).toBe(401);
    expect(autenticar).toHaveBeenCalledTimes(1);
  });

  it('deriva e normaliza tenant exclusivamente do usuário autenticado', async () => {
    autenticarComo();

    const resposta = await request(criarApp())
      .post('/api/blacklist?tenantId=tenant-a')
      .set('x-tenant-id', 'tenant-a')
      .send({ tenantId: 'tenant-a' });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      tenantId: 'tenant-a',
      headerTenant: 'tenant-a',
      queryTenant: 'tenant-a',
      bodyTenant: 'tenant-a'
    });
  });

  it('retorna 403 em divergência cross-tenant por header, query ou body', async () => {
    autenticarComo();
    const app = criarApp();

    const respostas = await Promise.all([
      request(app).get('/api/clientes').set('x-tenant-id', 'tenant-b'),
      request(app).get('/api/clientes?tenantId=tenant-b'),
      request(app).post('/api/blacklist').send({ tenantId: 'tenant-b' })
    ]);

    expect(respostas.map((resposta) => resposta.status)).toEqual([403, 403, 403]);
  });

  it('preserva alvo explícito apenas em operação SUPER_ADMIN já protegida', async () => {
    autenticarComo('SUPER_ADMIN', 'tenant-admin');

    const resposta = await request(criarApp())
      .post('/api/billing/admin/adicionar-creditos')
      .send({ tenantId: 'tenant-alvo' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.bodyTenant).toBe('tenant-alvo');
  });
});
