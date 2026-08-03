const mockPrisma: any = {
  $queryRaw: jest.fn(),
  conviteEspecialistaAgenda: { findMany: jest.fn(), upsert: jest.fn() },
  atividade: { findMany: jest.fn(), findFirst: jest.fn() },
};
jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));

import { buscarConvitesAcionaveis, resolverEspecialistaPorTelefone } from '../specialist-copilot-context';

describe('specialist copilot context', () => {
  beforeEach(() => jest.clearAllMocks());

  it('falha fechado quando o telefone resolve mais de um usuário', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'u1', tenantId: 't1', nome: 'Um', telefone: '62999990001' },
      { id: 'u2', tenantId: 't1', nome: 'Dois', telefone: '62999990001' },
    ]);
    expect(await resolverEspecialistaPorTelefone('t1', '5562999990001')).toBeNull();
  });

  it('descarta convite cujo responsável atual não é o remetente', async () => {
    mockPrisma.conviteEspecialistaAgenda.findMany.mockResolvedValue([{
      id: 'c1', atividadeId: 'a1', tentativa: 1, prazoEm: new Date('2026-08-04T18:00:00Z'),
    }]);
    mockPrisma.atividade.findMany.mockResolvedValue([{
      id: 'a1', corretorAtualId: 'outro', agendadoPara: new Date('2026-08-04T15:00:00Z'),
      statusAgendamento: 'SOLICITADO', versao: 1, lead: { id: 'l1', nome: 'Lead' },
    }]);
    const result = await buscarConvitesAcionaveis(
      { id: 'u1', tenantId: 't1', nome: 'Especialista', telefone: '62999990001' },
      new Date('2026-08-03T18:00:00Z'),
    );
    expect(result).toEqual([]);
  });
});
