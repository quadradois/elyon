const mockPrisma = { atividade: { findMany: jest.fn() } };
jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));

import { consultarAgendaEspecialista, formatarAgendaEspecialista } from '../specialist-agenda-query';

describe('specialist agenda query', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sempre restringe por usuário e tenant', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([]);
    const inicio = new Date('2026-08-04T03:00:00.000Z');
    const fim = new Date('2026-08-05T02:59:59.999Z');
    await consultarAgendaEspecialista({ tenantId: 'tenant-a', usuarioId: 'user-a', inicio, fim });
    expect(mockPrisma.atividade.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        corretorAtualId: 'user-a',
        lead: { tenantId: 'tenant-a' },
        agendadoPara: { gte: inicio, lte: fim },
      }),
    }));
  });

  it('explica o período consultado quando não há atendimentos', () => {
    const periodo = {
      inicio: new Date('2026-08-04T03:00:00.000Z'),
      fim: new Date('2026-08-05T02:59:59.999Z'),
      descricao: 'amanha' as const,
      dataLocal: '2026-08-04',
    };
    expect(formatarAgendaEspecialista([], periodo)).toBe('Você não possui atendimentos ativos amanhã.');
  });

  it('formata uma data explícita na resposta', () => {
    const periodo = {
      inicio: new Date('2026-08-05T03:00:00.000Z'),
      fim: new Date('2026-08-06T02:59:59.999Z'),
      descricao: 'data_explicita' as const,
      dataLocal: '2026-08-05',
    };
    expect(formatarAgendaEspecialista([], periodo)).toBe('Você não possui atendimentos ativos em 05/08/2026.');
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
