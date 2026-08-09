import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';

const autenticar = jest.fn();

jest.mock('../middleware-auth', () => ({
  verificarAutenticacao: (...args: unknown[]) => autenticar(...args)
}));

const findUnique = jest.fn();
const update = jest.fn();

jest.mock('../../lib/db', () => ({
  prisma: {
    chaveApi: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args)
    }
  }
}));

import { exigirAutenticacaoPorPadrao } from '../default-deny';

const CHAVE = 'ely_0123456789abcdef0123456789abcdef';
const HASH = createHash('sha256').update(CHAVE).digest('hex');

function chaveValida(extras: Record<string, unknown> = {}) {
  return {
    id: 'chave-1',
    nome: 'QuadraDois CRM',
    prefixo: CHAVE.slice(0, 8),
    chaveHash: HASH,
    escopos: ['mineracao:read'],
    ativa: true,
    expiraEm: null,
    ...extras
  };
}

function criarApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(exigirAutenticacaoPorPadrao);
  app.all('*', (req, res) => res.json({ ok: true, chave: req.chaveApi?.nome ?? null }));
  return app;
}

describe('autenticação por API key (M2M)', () => {
  beforeEach(() => {
    autenticar.mockReset();
    findUnique.mockReset();
    update.mockReset();
    autenticar.mockImplementation((_req: Request, res: Response) => {
      res.status(401).json({ erro: 'Token não fornecido' });
    });
    update.mockResolvedValue({});
  });

  it('sem header x-api-key o fluxo JWT permanece intacto', async () => {
    const resposta = await request(criarApp()).get('/api/mineracao/bairros');
    expect(resposta.status).toBe(401);
    expect(autenticar).toHaveBeenCalledTimes(1);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('chave válida com escopo mineracao:read acessa rota de busca sem JWT', async () => {
    findUnique.mockResolvedValue(chaveValida());
    const resposta = await request(criarApp())
      .get('/api/mineracao/bairros')
      .set('x-api-key', CHAVE);
    expect(resposta.status).toBe(200);
    expect(resposta.body.chave).toBe('QuadraDois CRM');
    expect(autenticar).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({ where: { chaveHash: HASH } });
  });

  it.each([
    ['GET', '/api/mineracao/edificios/123'],
    ['GET', '/api/mineracao/unidades/456'],
    ['GET', '/api/mineracao/buscar-imoveis'],
    ['GET', '/api/mineracao/condominios'],
    ['GET', '/api/mineracao/casas/789'],
    ['GET', '/api/mineracao/endereco'],
    ['POST', '/api/mineracao/proprietarios-base'],
    ['POST', '/api/mineracao/fotos-empreendimentos']
  ])('escopo mineracao:read cobre %s %s', async (metodo, caminho) => {
    findUnique.mockResolvedValue(chaveValida());
    const agente = request(criarApp());
    const resposta =
      metodo === 'GET'
        ? await agente.get(caminho).set('x-api-key', CHAVE)
        : await agente.post(caminho).set('x-api-key', CHAVE).send({});
    expect(resposta.status).toBe(200);
  });

  it('chave desconhecida recebe 401 e nunca cai para o fluxo JWT', async () => {
    findUnique.mockResolvedValue(null);
    const resposta = await request(criarApp())
      .get('/api/mineracao/bairros')
      .set('x-api-key', 'ely_chave_que_nao_existe_0000000000');
    expect(resposta.status).toBe(401);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it('chave desativada recebe 401', async () => {
    findUnique.mockResolvedValue(chaveValida({ ativa: false }));
    const resposta = await request(criarApp())
      .get('/api/mineracao/bairros')
      .set('x-api-key', CHAVE);
    expect(resposta.status).toBe(401);
  });

  it('chave expirada recebe 401', async () => {
    findUnique.mockResolvedValue(chaveValida({ expiraEm: new Date('2020-01-01') }));
    const resposta = await request(criarApp())
      .get('/api/mineracao/bairros')
      .set('x-api-key', CHAVE);
    expect(resposta.status).toBe(401);
  });

  it.each([
    ['GET', '/api/auth/perfil'],
    ['POST', '/api/mineracao/identificar-proprietarios'],
    ['GET', '/api/mineracao/jobs/123'],
    ['GET', '/api/mineracao/unidades/jobs/123'],
    ['POST', '/api/mineracao/confirmar-leads'],
    ['GET', '/api/clientes']
  ])('rota fora do escopo recebe 403: %s %s', async (metodo, caminho) => {
    findUnique.mockResolvedValue(chaveValida());
    const agente = request(criarApp());
    const resposta =
      metodo === 'GET'
        ? await agente.get(caminho).set('x-api-key', CHAVE)
        : await agente.post(caminho).set('x-api-key', CHAVE).send({});
    expect(resposta.status).toBe(403);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it('registra o uso da chave no acesso autorizado', async () => {
    findUnique.mockResolvedValue(chaveValida());
    await request(criarApp()).get('/api/mineracao/bairros').set('x-api-key', CHAVE);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'chave-1' } })
    );
  });
});
