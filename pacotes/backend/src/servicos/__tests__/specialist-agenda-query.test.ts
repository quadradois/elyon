const mockPrisma = { atividade: { findMany: jest.fn() } };
jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));

import { consultarAgendaEspecialista, formatarAgendaEspecialista } from '../specialist-agenda-query';

describe('specialist agenda query', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sempre restringe por usuário e tenant', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([]);
    await consultarAgendaEspecialista({ tenantId: 'tenant-a', usuarioId: 'user-a' });
    expect(mockPrisma.atividade.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ corretorAtualId: 'user-a', lead: { tenantId: 'tenant-a' } }),
    }));
  });

  it('não inventa imóvel ausente e formata somente dados retornados', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([{
      id: 'a1', canal: 'TELEFONE', statusAgendamento: 'CONFIRMADO', agendadoPara: new Date('2026-08-04T15:00:00Z'),
      lead: { nome: 'Ivonet', nomeEdificio: null, enderecoImovel: null, briefingCloser: null, observacoesSpin: null, campanhaOrigem: null },
    }]);
    const result = await consultarAgendaEspecialista({ tenantId: 'tenant-a', usuarioId: 'user-a' });
    expect(result[0].imovel).toBe('');
    expect(formatarAgendaEspecialista(result)).toContain('Ivonet');
    expect(formatarAgendaEspecialista(result)).not.toContain('undefined');
  });
});
