import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { criarJobUnidades } from '../../../servicos/job-unidades';

jest.mock('../../../servicos/job-unidades', () => ({
  criarJobUnidades: jest.fn<any>(),
  obterStatusJobUnidades: jest.fn<any>()
}));

import unidadesJobsRotas from '../unidades-jobs.rotas';

const app = express();
app.use(express.json());
app.use('/api/mineracao/unidades/jobs', unidadesJobsRotas);

describe('POST /api/mineracao/unidades/jobs/iniciar - GEO360', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (criarJobUnidades as any).mockResolvedValue('job-geo360-1');
  });

  it('repassa a identidade canônica do lote para o job', async () => {
    const resposta = await request(app)
      .post('/api/mineracao/unidades/jobs/iniciar')
      .send({
        cdedificio: 405683,
        tipo: 'edificio',
        nomeEdificio: 'WISH VACA BRAVA',
        fonte: 'geo360',
        cidade: 'goiania',
        idLote: 405683
      });

    expect(resposta.status).toBe(201);
    expect(criarJobUnidades).toHaveBeenCalledWith(
      405683,
      'edificio',
      'WISH VACA BRAVA',
      'geo360',
      'goiania',
      405683
    );
  });

  it('mantém legado como padrão para clientes antigos', async () => {
    const resposta = await request(app)
      .post('/api/mineracao/unidades/jobs/iniciar')
      .send({
        cdedificio: 1234,
        tipo: 'edificio',
        nomeEdificio: 'EDIFÍCIO LEGADO'
      });

    expect(resposta.status).toBe(201);
    expect(criarJobUnidades).toHaveBeenCalledWith(
      1234,
      'edificio',
      'EDIFÍCIO LEGADO',
      'legado',
      'goiania',
      undefined
    );
  });
});

