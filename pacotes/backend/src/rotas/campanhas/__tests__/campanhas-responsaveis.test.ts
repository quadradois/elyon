import express from 'express';
import request from 'supertest';

const mockPrisma = {
  campanha: { findFirst: jest.fn(), update: jest.fn() },
  usuario: { findFirst: jest.fn() },
};
const mockAuditoria = { registrar: jest.fn() };

jest.mock('../../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../../servicos/cep', () => ({ consultaCEP: {} }));
jest.mock('../../../servicos/rag-empreendimentos', () => ({ ragEmpreendimentos: {} }));
jest.mock('../../../servicos/resumo-estrutural-empreendimento', () => ({ resumoEstruturalEmpreendimento: {} }));
jest.mock('../../../servicos/servico-auditoria', () => ({ ServicoAuditoria: mockAuditoria }));

import campanhasRotas from '../campanhas.rotas';

const RESPONSAVEL_ID = '11111111-1111-4111-8111-111111111111';
const FALLBACK_ID = '22222222-2222-4222-8222-222222222222';

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.tenantId = 'tenant-1';
    req.usuario = { id: 'admin-1' };
    next();
  });
  app.use('/campanhas', campanhasRotas);
  return app;
}

describe('PATCH /campanhas/:id/responsaveis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.campanha.findFirst.mockResolvedValue({
      id: 'campanha-1', responsavelCorretorId: null, fallbackCorretorId: null,
    });
    mockPrisma.usuario.findFirst
      .mockResolvedValueOnce({ id: RESPONSAVEL_ID })
      .mockResolvedValueOnce({ id: FALLBACK_ID });
    mockPrisma.campanha.update.mockResolvedValue({
      id: 'campanha-1',
      responsavelCorretorId: RESPONSAVEL_ID,
      fallbackCorretorId: FALLBACK_ID,
      responsavelCorretor: { id: RESPONSAVEL_ID, nome: 'Guilherme', estaAtivo: true },
      fallbackCorretor: { id: FALLBACK_ID, nome: 'Eloisa', estaAtivo: true },
    });
  });

  it('atualiza principal e fallback do mesmo tenant e audita a mudança', async () => {
    const response = await request(criarApp())
      .patch('/campanhas/campanha-1/responsaveis')
      .send({ responsavelCorretorId: RESPONSAVEL_ID, fallbackCorretorId: FALLBACK_ID });

    expect(response.status).toBe(200);
    expect(response.body.campanha).toMatchObject({
      responsavelCorretorId: RESPONSAVEL_ID,
      fallbackCorretorId: FALLBACK_ID,
    });
    expect(mockPrisma.campanha.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'campanha-1', tenantId: 'tenant-1' },
    }));
    expect(mockAuditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      acao: 'ATUALIZAR_RESPONSAVEIS_CAMPANHA', entidadeId: 'campanha-1',
    }));
  });

  it('rejeita responsável e fallback iguais', async () => {
    const response = await request(criarApp())
      .patch('/campanhas/campanha-1/responsaveis')
      .send({ responsavelCorretorId: RESPONSAVEL_ID, fallbackCorretorId: RESPONSAVEL_ID });

    expect(response.status).toBe(400);
    expect(mockPrisma.campanha.update).not.toHaveBeenCalled();
  });

  it('não permite editar campanha fora do tenant', async () => {
    mockPrisma.campanha.findFirst.mockResolvedValue(null);

    const response = await request(criarApp())
      .patch('/campanhas/campanha-externa/responsaveis')
      .send({ responsavelCorretorId: RESPONSAVEL_ID, fallbackCorretorId: FALLBACK_ID });

    expect(response.status).toBe(404);
    expect(mockPrisma.campanha.update).not.toHaveBeenCalled();
  });
});
