import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mapaService } from '../../../servicos/mapa';

jest.mock('../../../servicos/mapa', () => ({
  mapaService: {
    buscarEdificiosPorNome: jest.fn<any>(),
    buscarCondominiosHorizontais: jest.fn<any>()
  }
}));

import buscaRotas from '../busca.rotas';

const app = express();
app.use(express.json());
app.use('/api/mineracao', buscaRotas);

describe('GET /api/mineracao/buscar-imoveis - GEO360', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mapaService.buscarCondominiosHorizontais as any).mockResolvedValue([]);
  });

  it('preserva fonte, cidade e idLote no contrato da busca', async () => {
    (mapaService.buscarEdificiosPorNome as any).mockResolvedValue([
      {
        codigo: 405683,
        nome: 'WISH VACA BRAVA',
        logradouro: 'R T-53, SETOR BUENO',
        fonte: 'geo360',
        cidade: 'goiania',
        idLote: 405683,
        encontradoPor: 'alias',
        totalUnidades: 287
      }
    ]);

    const resposta = await request(app)
      .get('/api/mineracao/buscar-imoveis')
      .query({ termo: 'wish vaca brava' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.resultados).toEqual([
      expect.objectContaining({
        codigo: 405683,
        fonte: 'geo360',
        cidade: 'goiania',
        idLote: 405683,
        encontradoPor: 'alias',
        totalUnidades: 287
      })
    ]);
  });
});
