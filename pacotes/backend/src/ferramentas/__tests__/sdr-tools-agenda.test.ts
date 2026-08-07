const mockPrisma = {
  lead: { findUnique: jest.fn(), findFirst: jest.fn() },
  atividade: { findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};
const mockExecutarComandoAgenda = jest.fn();

jest.mock('@openai/agents', () => ({ tool: (config: any) => config }));
jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../casos-de-uso/agentes', () => ({
  ConverterParaLeadUseCase: jest.fn(), MoverParaFaseUseCase: jest.fn(), SalvarDadosImovelUseCase: jest.fn(),
  AgendarFollowupUseCase: jest.fn(), EncaminharCorretorUseCase: jest.fn(), AtualizarDadosLeadUseCase: jest.fn(),
  QualificarLeadUseCase: jest.fn(), RegistrarOptoutUseCase: jest.fn(),
}));
jest.mock('../../servicos/resolucao-especialista-campanha', () => ({ resolverEspecialistaCampanha: jest.fn() }));
jest.mock('../../servicos/coerencia-agenda-estado', () => ({
  AGENDA_COMMERCIAL_POLICY_VERSION: 'agenda-commercial-v1',
  executarComandoAgenda: (...args: any[]) => mockExecutarComandoAgenda(...args),
}));
jest.mock('../../servicos/google-calendar', () => ({ googleCalendarService: { isConfigurado: () => false } }));

import { cancelarAgendamentoTool } from '../sdr-tools-agents';

describe('cancelar_agendamento temporal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T11:01:00.000Z'));
    mockPrisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', tenantId: 'tenant-1' });
  });
  afterEach(() => jest.useRealTimers());

  it('retorna APPOINTMENT_STARTED sem chamar comando para compromisso iniciado', async () => {
    mockPrisma.atividade.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'atividade-1', agendadoPara: new Date('2026-08-03T11:01:00Z'),
    });
    const raw = await (cancelarAgendamentoTool as any).execute({ contatoId: 'lead-1', motivo: null }, {
      context: { tenantId: 'tenant-1', durableExecutionId: 'exec-1' },
    });
    expect(JSON.parse(raw)).toMatchObject({ success: false, reasonCode: 'APPOINTMENT_STARTED', atividadeId: 'atividade-1' });
    expect(mockExecutarComandoAgenda).not.toHaveBeenCalled();
  });

  it('nao confirma cancelamento quando houver conflito de versao', async () => {
    mockPrisma.atividade.findFirst.mockResolvedValueOnce({
      id: 'atividade-2', versao: 4, agendadoPara: new Date('2026-08-03T12:00:00Z'),
    });
    mockExecutarComandoAgenda.mockResolvedValue({ success: false, reasonCode: 'STALE_EVENT', atividadeId: 'atividade-2' });
    const raw = await (cancelarAgendamentoTool as any).execute({ contatoId: 'lead-1', motivo: 'Pedido do lead' }, {
      context: { tenantId: 'tenant-1', durableExecutionId: 'exec-2' },
    });
    expect(JSON.parse(raw)).toMatchObject({ success: false, reasonCode: 'STALE_EVENT' });
    expect(raw).toContain('Não confirme o cancelamento');
  });

  it('cancela solicitação futura antes de considerar compromisso passado', async () => {
    mockPrisma.atividade.findFirst.mockResolvedValueOnce({
      id: 'atividade-futura',
      versao: 2,
      agendadoPara: new Date('2026-08-05T15:00:00.000Z'),
    });
    mockExecutarComandoAgenda.mockResolvedValue({
      success: true,
      reasonCode: 'CANCELLED',
      atividadeId: 'atividade-futura',
    });

    const raw = await (cancelarAgendamentoTool as any).execute({
      contatoId: 'lead-1',
      motivo: 'Especialista ainda não confirmou',
    }, {
      context: { tenantId: 'tenant-1', durableExecutionId: 'exec-solicitada' },
    });

    expect(JSON.parse(raw)).toMatchObject({
      success: true,
      atividadeId: 'atividade-futura',
      statusAgendamento: 'CANCELADO',
    });
    expect(mockPrisma.atividade.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        statusAgendamento: { in: ['PROPOSTO', 'SOLICITADO', 'PENDENTE', 'CONFIRMADO'] },
        agendadoPara: { gt: expect.any(Date) },
      }),
      orderBy: { agendadoPara: 'asc' },
    }));
    expect(mockExecutarComandoAgenda).toHaveBeenCalledWith(expect.objectContaining({
      operacao: 'CANCELAR',
      atividadeId: 'atividade-futura',
      expectedVersion: 2,
    }));
  });
});
