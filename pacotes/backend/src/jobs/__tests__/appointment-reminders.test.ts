const mockPrisma = {
  atividade: { findMany: jest.fn() },
  efeitoAgendaOutbox: { createMany: jest.fn() },
};
const mockConfig = jest.fn();

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../servicos/agenda-pilot-config', () => ({ resolverAgendaPilotConfig: (...args: any[]) => mockConfig(...args) }));

import { executarLembretesProximidadeAgendamento } from '../job-lembretes-agendamento';

describe('appointment proximity reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('falha fechado quando o Copilot não está no escopo ativo', async () => {
    mockConfig.mockResolvedValue({ effects: { enabled: true }, specialistCopilot: { enabled: false } });
    expect(await executarLembretesProximidadeAgendamento()).toEqual({ processados: 0, enfileirados: 0, erros: 0 });
    expect(mockPrisma.atividade.findMany).not.toHaveBeenCalled();
  });

  it('enfileira uma mensagem por parte com chaves estáveis', async () => {
    mockConfig.mockResolvedValue({
      scope: { tenantId: 'tenant-1', startedAtUtc: '2026-08-03T00:00:00.000Z' },
      effects: { enabled: true }, specialistCopilot: { enabled: true },
    });
    mockPrisma.atividade.findMany.mockResolvedValue([{
      id: 'a1', versao: 3, agendadoPara: new Date('2026-08-03T16:00:00.000Z'), corretorAtualId: 'u1',
      lead: { id: 'l1', nome: 'Ivonet', tenantId: 'tenant-1' },
    }]);
    mockPrisma.efeitoAgendaOutbox.createMany.mockResolvedValue({ count: 2 });
    const result = await executarLembretesProximidadeAgendamento(new Date('2026-08-03T15:00:00.000Z'));
    expect(result).toEqual({ processados: 1, enfileirados: 2, erros: 0 });
    const effects = mockPrisma.efeitoAgendaOutbox.createMany.mock.calls[0][0].data;
    expect(effects).toHaveLength(2);
    expect(effects.map((item: any) => item.destinatarioTipo)).toEqual(['LEAD', 'USUARIO']);
    expect(new Set(effects.map((item: any) => item.chaveIdempotencia)).size).toBe(2);
  });
});
