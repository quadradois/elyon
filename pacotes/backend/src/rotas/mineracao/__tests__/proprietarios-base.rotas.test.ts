import express from 'express';
import request from 'supertest';

const findMany = jest.fn();

jest.mock('../../../lib/db', () => ({
  prisma: {
    imovelRancho: {
      findMany: (...args: unknown[]) => findMany(...args)
    }
  }
}));

import proprietariosBaseRotas from '../proprietarios-base.rotas';

function criarApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/mineracao', proprietariosBaseRotas);
  return app;
}

describe('POST /api/mineracao/proprietarios-base', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('identifica proprietários em lote lendo só a base local', async () => {
    findMany.mockResolvedValue([
      { inscricaoCartografica: '111', nomePessoa: 'Maria', cpfCnpj: '12345678901', tipoPessoa: 1 },
      { inscricaoCartografica: '222', nomePessoa: 'Empresa X', cpfCnpj: '11222333000144', tipoPessoa: 2 }
    ]);

    const resposta = await request(criarApp())
      .post('/api/mineracao/proprietarios-base')
      .send({ inscricoes: ['111', '222', '333-sem-dono'] });

    expect(resposta.status).toBe(200);
    expect(resposta.body.total).toBe(2);
    expect(resposta.body.proprietarios).toEqual([
      { inscricao: '111', nomePessoa: 'Maria', cpfCnpj: '12345678901', tipoPessoa: 1 },
      { inscricao: '222', nomePessoa: 'Empresa X', cpfCnpj: '11222333000144', tipoPessoa: 2 }
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inscricaoCartografica: { in: ['111', '222', '333-sem-dono'] } }
      })
    );
  });

  it('rejeita lote acima de 500 inscrições com 400', async () => {
    const resposta = await request(criarApp())
      .post('/api/mineracao/proprietarios-base')
      .send({ inscricoes: Array.from({ length: 501 }, (_, i) => String(i)) });

    expect(resposta.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejeita corpo inválido com 400', async () => {
    const respostas = await Promise.all([
      request(criarApp()).post('/api/mineracao/proprietarios-base').send({}),
      request(criarApp()).post('/api/mineracao/proprietarios-base').send({ inscricoes: [] }),
      request(criarApp()).post('/api/mineracao/proprietarios-base').send({ inscricoes: [123] })
    ]);
    expect(respostas.map((resposta) => resposta.status)).toEqual([400, 400, 400]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
