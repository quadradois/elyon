import express from 'express';
import request from 'supertest';

const imovelFindMany = jest.fn();
const ranchoFindMany = jest.fn();
const midiaFindMany = jest.fn();

jest.mock('../../../lib/db', () => ({
  prisma: {
    imovel: { findMany: (...args: unknown[]) => imovelFindMany(...args) },
    imovelRancho: { findMany: (...args: unknown[]) => ranchoFindMany(...args) },
    geo360MidiaLote: { findMany: (...args: unknown[]) => midiaFindMany(...args) }
  }
}));

import fotosEmpreendimentosRotas from '../fotos-empreendimentos.rotas';

function criarApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/mineracao', fotosEmpreendimentosRotas);
  return app;
}

describe('POST /api/mineracao/fotos-empreendimentos', () => {
  beforeEach(() => {
    imovelFindMany.mockReset();
    ranchoFindMany.mockReset();
    midiaFindMany.mockReset();
  });

  it('resolve foto principal por edifício via lote GEO360 (edifício sem foto fica fora)', async () => {
    imovelFindMany.mockResolvedValue([
      { codigoEdificio: 555, codigoBairro: null, inscricaoIptu: '111' },
      { codigoEdificio: 777, codigoBairro: null, inscricaoIptu: '222' }
    ]);
    ranchoFindMany.mockResolvedValue([
      { inscricaoCartografica: '111', cidade: 'goiania', idLote: 90 },
      { inscricaoCartografica: '222', cidade: 'goiania', idLote: 91 }
    ]);
    midiaFindMany.mockResolvedValue([
      { cidade: 'goiania', idLote: 90, link: 'https://fotos.geo360.test/90.jpeg', principal: 1 }
    ]);

    const resposta = await request(criarApp())
      .post('/api/mineracao/fotos-empreendimentos')
      .send({ edificios: [555, 777] });

    expect(resposta.status).toBe(200);
    expect(resposta.body.fotos.edificios).toEqual({ '555': 'https://fotos.geo360.test/90.jpeg' });
    expect(resposta.body.fotos.condominios).toEqual({});
  });

  it('resolve condomínios horizontais pelo codigoBairro', async () => {
    imovelFindMany.mockResolvedValue([
      { codigoEdificio: null, codigoBairro: 77, inscricaoIptu: '333' }
    ]);
    ranchoFindMany.mockResolvedValue([
      { inscricaoCartografica: '333', cidade: 'goiania', idLote: 95 }
    ]);
    midiaFindMany.mockResolvedValue([
      { cidade: 'goiania', idLote: 95, link: 'https://fotos.geo360.test/95.jpeg', principal: 1 }
    ]);

    const resposta = await request(criarApp())
      .post('/api/mineracao/fotos-empreendimentos')
      .send({ condominios: [77] });

    expect(resposta.status).toBe(200);
    expect(resposta.body.fotos.condominios).toEqual({ '77': 'https://fotos.geo360.test/95.jpeg' });
  });

  it('rejeita corpo sem listas, listas vazias ou acima de 100 com 400', async () => {
    const app = criarApp();
    const respostas = await Promise.all([
      request(app).post('/api/mineracao/fotos-empreendimentos').send({}),
      request(app).post('/api/mineracao/fotos-empreendimentos').send({ edificios: [] }),
      request(app).post('/api/mineracao/fotos-empreendimentos')
        .send({ edificios: Array.from({ length: 101 }, (_, i) => i) })
    ]);
    expect(respostas.map((r) => r.status)).toEqual([400, 400, 400]);
    expect(imovelFindMany).not.toHaveBeenCalled();
  });
});
