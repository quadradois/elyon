const mockPrisma = {
  lead: { findUnique: jest.fn() },
  atividade: { findMany: jest.fn() },
};
const mockResolverEspecialista = jest.fn();
const mockGoogleCalendar = {
  isConfigurado: jest.fn(() => false),
  consultarSlotsLivres: jest.fn(),
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../resolucao-especialista-campanha', () => ({
  resolverEspecialistaCampanha: (...args: unknown[]) => mockResolverEspecialista(...args),
}));
jest.mock('../google-calendar', () => ({ googleCalendarService: mockGoogleCalendar }));

import {
  consultarHorariosDisponiveisCanonico,
  formatarRespostaHorariosDisponiveis,
} from '../consulta-horarios-disponiveis';

describe('consultarHorariosDisponiveisCanonico', () => {
  const agora = new Date('2026-08-04T18:49:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleCalendar.isConfigurado.mockReturnValue(false);
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1', tenantId: 'tenant-1', campanhaOrigemId: 'campanha-1',
    });
    mockResolverEspecialista.mockResolvedValue({ usuarioId: 'user-1', nome: 'Guilherme' });
    mockPrisma.atividade.findMany.mockResolvedValue([]);
  });

  it('retorna somente horários da data solicitada', async () => {
    const resultado = await consultarHorariosDisponiveisCanonico({
      leadId: 'lead-1', tenantId: 'tenant-1', dataPreferida: '2026-08-05', agora,
    });

    expect(resultado.success).toBe(true);
    expect(resultado.sugestoes).toHaveLength(2);
    expect(resultado.sugestoes?.every((item) => item.dataHora.startsWith('05/08/2026'))).toBe(true);
    expect(formatarRespostaHorariosDisponiveis(resultado)).toContain('Qual funciona melhor');
  });

  it('falha fechada para lead de outro tenant', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1', tenantId: 'tenant-2', campanhaOrigemId: 'campanha-1',
    });
    await expect(consultarHorariosDisponiveisCanonico({
      leadId: 'lead-1', tenantId: 'tenant-1', agora,
    })).resolves.toMatchObject({ success: false, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
    expect(mockResolverEspecialista).not.toHaveBeenCalled();
  });

  it('não oferece horário ocupado na agenda local', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([
      { agendadoPara: new Date('2026-08-05T11:00:00.000Z'), duracao: 30 },
    ]);
    const resultado = await consultarHorariosDisponiveisCanonico({
      leadId: 'lead-1', tenantId: 'tenant-1', dataPreferida: '2026-08-05', agora,
    });
    expect(resultado.sugestoes?.some((item) => item.inicioUtc === '2026-08-05T11:00:00.000Z')).toBe(false);
  });
});
