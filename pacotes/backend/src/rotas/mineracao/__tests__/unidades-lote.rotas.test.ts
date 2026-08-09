import express from 'express';
import request from 'supertest';

const count = jest.fn();
const findMany = jest.fn();

jest.mock('../../../lib/db', () => ({
  prisma: {
    imovelRancho: {
      count: (...args: unknown[]) => count(...args),
      findMany: (...args: unknown[]) => findMany(...args)
    }
  }
}));

import unidadesLoteRotas from '../unidades-lote.rotas';

function criarApp(): express.Express {
  const app = express();
  app.use('/api/mineracao', unidadesLoteRotas);
  return app;
}

describe('GET /api/mineracao/unidades-lote', () => {
  beforeEach(() => {
    count.mockReset();
    findMany.mockReset();
  });

  it('lista as unidades do lote no formato das demais rotas de unidades', async () => {
    count.mockResolvedValue(232);
    findMany.mockResolvedValue([
      {
        inscricaoCartografica: '30400202310012',
        complemento: 'APTO 806',
        logradouro: 'AV T4',
        endereco: 'AV T4 S/N',
        bairro: 'SET BUENO',
        areaConstruida: 78.5
      }
    ]);

    const resposta = await request(criarApp())
      .get('/api/mineracao/unidades-lote?cidade=goiania&idLote=238184&limit=1');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      total: 232,
      offset: 0,
      limit: 1,
      hasMore: true,
      cidade: 'goiania',
      idLote: 238184,
      bairro: 'SET BUENO'
    });
    expect(resposta.body.unidades[0]).toEqual({
      nrinscr: '30400202310012',
      incompl: 'APTO 806',
      nmlogradou: 'AV T4',
      nmbairro: 'SET BUENO',
      areaedif: 78.5
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cidade: 'goiania', idLote: 238184 },
        skip: 0,
        take: 1
      })
    );
  });

  it('hasMore vira false na última página', async () => {
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([
      { inscricaoCartografica: 'B', complemento: null, logradouro: null, endereco: 'RUA X', bairro: null, areaConstruida: null }
    ]);

    const resposta = await request(criarApp())
      .get('/api/mineracao/unidades-lote?cidade=goiania&idLote=99&offset=1&limit=100');

    expect(resposta.status).toBe(200);
    expect(resposta.body.hasMore).toBe(false);
    expect(resposta.body.unidades[0].nmlogradou).toBe('RUA X'); // cai para endereco
  });

  it('rejeita parâmetros ausentes ou inválidos com 400', async () => {
    const app = criarApp();
    const respostas = await Promise.all([
      request(app).get('/api/mineracao/unidades-lote'),
      request(app).get('/api/mineracao/unidades-lote?cidade=goiania'),
      request(app).get('/api/mineracao/unidades-lote?cidade=goiania&idLote=abc')
    ]);
    expect(respostas.map((r) => r.status)).toEqual([400, 400, 400]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
