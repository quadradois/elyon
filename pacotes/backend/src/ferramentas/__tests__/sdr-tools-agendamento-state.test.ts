const tx = {
  lead: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
  },
  milestoneAgenda: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  atividade: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  usuario: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(tx)),
};

jest.mock('@openai/agents', () => ({
  tool: (config: any) => config,
}));

jest.mock('../../lib/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../casos-de-uso/agentes', () => ({
  ConverterParaLeadUseCase: jest.fn(),
  MoverParaFaseUseCase: jest.fn(),
  SalvarDadosImovelUseCase: jest.fn(),
  AgendarFollowupUseCase: jest.fn(),
  EncaminharCorretorUseCase: jest.fn(),
  AtualizarDadosLeadUseCase: jest.fn(),
  QualificarLeadUseCase: jest.fn(),
  RegistrarOptoutUseCase: jest.fn(),
}));

const mockResolverEspecialista = jest.fn();
jest.mock('../../servicos/resolucao-especialista-campanha', () => ({
  resolverEspecialistaCampanha: (...args: any[]) => mockResolverEspecialista(...args),
}));

const mockExecutarComandoAgenda = jest.fn();
jest.mock('../../servicos/coerencia-agenda-estado', () => ({
  AGENDA_COMMERCIAL_POLICY_VERSION: 'agenda-commercial-v1',
  executarComandoAgenda: (...args: any[]) => mockExecutarComandoAgenda(...args),
}));

jest.mock('../../servicos/google-calendar', () => ({
  googleCalendarService: {
    isConfigurado: () => false,
  },
}));

import {
  agendarReuniaoCloserTool,
  cancelarAgendamentoTool,
  consultarStatusAgendamentoTool,
  enviarLinkAgendamentoTool,
} from '../sdr-tools-agents';

describe('agendamento SDR — regressão de estado e fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T22:00:00.000Z'));
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(tx));
    mockPrisma.atividade.findFirst.mockResolvedValue(null);
    mockPrisma.usuario.findUnique.mockResolvedValue({ nome: 'Guilherme' });
    mockPrisma.lead.findFirst.mockResolvedValue({ status: 'NOVO' });
    mockPrisma.atividade.create.mockResolvedValue({ id: 'nota-tool-1' });
    tx.atividade.create.mockResolvedValue({ id: 'atividade-agenda-1' });
    tx.lead.updateMany.mockResolvedValue({ count: 1 });
    tx.milestoneAgenda.create.mockResolvedValue({ id: 'milestone-1' });
    mockResolverEspecialista.mockResolvedValue({
      tipo: 'USUARIO_EQUIPE',
      origem: 'RESPONSAVEL_CAMPANHA',
      usuarioId: 'usuario-especialista-1',
      nome: 'Especialista Teste',
      telefone: '5562999999999',
      cargo: 'Corretor Especialista',
    });
    mockExecutarComandoAgenda.mockResolvedValue({
      success: true,
      reasonCode: 'CANCELLED',
      atividadeId: 'atividade-agenda-1',
      leadStatus: 'TENTATIVA_AGENDAMENTO',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('agenda atomicamente um lead NOVO sem depender de mover_para_fase', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' })
      .mockResolvedValueOnce({
        id: 'lead-agenda-123', nome: 'Ivonet', email: null, campanhaOrigemId: 'campanha-1',
      });
    tx.lead.findFirst.mockResolvedValue({ status: 'NOVO' });

    const raw = await (agendarReuniaoCloserTool as any).execute({
      contatoId: 'lead-agenda-123',
      dataHora: 'amanhã 14:00',
      modalidade: 'whatsapp_video',
      observacoesCloser: 'Lead quer avaliação do imóvel.',
    }, { context: {
      tenantId: 'tenant-1',
      durableExecutionId: 'inbound-batch:lote-agenda-1',
      mensagemAtual: 'Pode ser amanhã às 14:00',
    } });

    const result = JSON.parse(raw);
    expect(result).toMatchObject({
      success: true,
      dataHora: '01/08/2026 14:00',
      especialista: { nome: 'Especialista Teste' },
    });
    expect(result.mensagem).toContain('aguardando confirmação do especialista');
    expect(result.mensagem).not.toContain('está confirmado');
    expect(tx.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-agenda-123', tenantId: 'tenant-1', status: 'NOVO' },
      data: { status: 'VISITA_AGENDADA' },
    });
    expect(tx.atividade.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        leadId: 'lead-agenda-123',
        statusAgendamento: 'PENDENTE',
        corretorAtualId: 'usuario-especialista-1',
      }),
    }));
  });

  it('não agenda lead em estado terminal', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' })
      .mockResolvedValueOnce({
        id: 'lead-agenda-123', nome: 'Ivonet', email: null, campanhaOrigemId: 'campanha-1',
      });
    tx.lead.findFirst.mockResolvedValue({ status: 'PERDIDO' });
    mockPrisma.lead.findFirst.mockResolvedValue({ status: 'PERDIDO' });

    const raw = await (agendarReuniaoCloserTool as any).execute({
      contatoId: 'lead-agenda-123', dataHora: 'amanhã 14:00', modalidade: 'whatsapp_video', observacoesCloser: 'Teste',
    }, { context: {
      tenantId: 'tenant-1', durableExecutionId: 'inbound-batch:lote-agenda-2', mensagemAtual: 'Amanhã às 14:00',
    } });

    expect(JSON.parse(raw)).toMatchObject({ success: false, reasonCode: 'STATE_TRANSITION_DENIED' });
    expect(tx.atividade.create).not.toHaveBeenCalled();
  });

  it('bloqueia link de fallback quando o lead já informou data e hora', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' });

    const raw = await (enviarLinkAgendamentoTool as any).execute({
      contatoId: 'lead-agenda-123', observacoesCloser: 'Teste',
    }, { context: {
      tenantId: 'tenant-1', mensagemAtual: 'Pode ser dia 03/08 às 08:00',
    } });

    expect(JSON.parse(raw)).toMatchObject({
      success: false,
      reasonCode: 'EXPLICIT_DATETIME_ALREADY_PROVIDED',
    });
    expect(mockPrisma.atividade.create).not.toHaveBeenCalled();
  });

  it('não oferece evento pré-preenchido como autoagendamento rastreável', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' })
      .mockResolvedValueOnce({ id: 'lead-agenda-123', nome: 'Ivonet' });

    const raw = await (enviarLinkAgendamentoTool as any).execute({
      contatoId: 'lead-agenda-123', observacoesCloser: 'Teste',
    }, { context: {
      tenantId: 'tenant-1', mensagemAtual: 'Preciso olhar minha agenda',
    } });

    expect(JSON.parse(raw)).toMatchObject({
      success: false,
      reasonCode: 'TRACKABLE_BOOKING_LINK_UNAVAILABLE',
    });
    expect(raw).not.toContain('calendar.google.com/calendar/render');
    expect(mockPrisma.atividade.create).not.toHaveBeenCalled();
  });

  it('cancela o agendamento ativo antes de confirmar ao lead', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' });
    mockPrisma.atividade.findFirst.mockResolvedValueOnce({
      id: 'atividade-agenda-1',
      versao: 3,
      agendadoPara: new Date('2026-08-03T11:01:00.000Z'),
    });

    const raw = await (cancelarAgendamentoTool as any).execute({
      contatoId: 'lead-agenda-123',
      motivo: 'Solicitação do lead',
    }, { context: {
      tenantId: 'tenant-1',
      durableExecutionId: 'inbound-batch:lote-cancel-1',
      mensagemAtual: 'Vamos cancelar por hora',
    } });

    expect(JSON.parse(raw)).toMatchObject({
      success: true,
      statusAgendamento: 'CANCELADO',
      atividadeId: 'atividade-agenda-1',
    });
    expect(mockExecutarComandoAgenda).toHaveBeenCalledWith(expect.objectContaining({
      operacao: 'CANCELAR',
      tenantId: 'tenant-1',
      leadId: 'lead-agenda-123',
      atividadeId: 'atividade-agenda-1',
      expectedVersion: 3,
      requestIdentity: { source: 'INBOUND_BATCH', id: 'inbound-batch:lote-cancel-1:agenda-cancel' },
    }));
  });

  it('consulta no banco um agendamento confirmado e retorna os dados canônicos', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' });
    mockPrisma.atividade.findFirst.mockResolvedValueOnce({
      id: 'atividade-agenda-1',
      tipo: 'REUNIAO',
      agendadoPara: new Date('2026-08-03T13:00:00.000Z'),
      statusAgendamento: 'CONFIRMADO',
      statusConfirmacaoCorretor: 'CONFIRMADO',
      corretorAtualId: 'usuario-especialista-1',
      corretorOriginalId: null,
      canceladoEm: null,
      motivoCancelamento: null,
    });

    const raw = await (consultarStatusAgendamentoTool as any).execute({
      contatoId: 'lead-agenda-123',
    }, { context: { tenantId: 'tenant-1' } });

    expect(JSON.parse(raw)).toMatchObject({
      success: true,
      temAgendamentoAtivo: true,
      situacao: 'CONFIRMADO',
      agendamento: {
        atividadeId: 'atividade-agenda-1',
        statusAgendamento: 'CONFIRMADO',
        especialistaNome: 'Guilherme',
        tipoAtendimento: 'ligacao_telefonica',
      },
    });
    expect(mockPrisma.atividade.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ lead: { tenantId: 'tenant-1' } }),
    }));
  });

  it('informa pelo banco que o último agendamento está cancelado', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' });
    mockPrisma.atividade.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'atividade-agenda-1',
        tipo: 'REUNIAO',
        agendadoPara: new Date('2026-08-03T12:00:00.000Z'),
        statusAgendamento: 'CANCELADO',
        statusConfirmacaoCorretor: 'CONFIRMADO',
        corretorAtualId: 'usuario-especialista-1',
        corretorOriginalId: null,
        canceladoEm: new Date('2026-08-02T15:00:00.000Z'),
        motivoCancelamento: 'Solicitação do lead',
      });

    const raw = await (consultarStatusAgendamentoTool as any).execute({
      contatoId: 'lead-agenda-123',
    }, { context: { tenantId: 'tenant-1' } });

    expect(JSON.parse(raw)).toMatchObject({
      success: true,
      temAgendamentoAtivo: false,
      situacao: 'CANCELADO',
      ultimoAgendamento: {
        statusAgendamento: 'CANCELADO',
        especialistaNome: 'Guilherme',
        motivoCancelamento: 'Solicitação do lead',
      },
    });
  });

  it('não confirma cancelamento quando o comando transacional falha', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({ id: 'lead-agenda-123', tenantId: 'tenant-1' });
    mockPrisma.atividade.findFirst.mockResolvedValueOnce({
      id: 'atividade-agenda-1', versao: 3, agendadoPara: new Date('2026-08-03T11:01:00.000Z'),
    });
    mockExecutarComandoAgenda.mockResolvedValueOnce({
      success: false, reasonCode: 'STALE_EVENT', atividadeId: 'atividade-agenda-1',
    });

    const raw = await (cancelarAgendamentoTool as any).execute({
      contatoId: 'lead-agenda-123', motivo: null,
    }, { context: {
      tenantId: 'tenant-1', durableExecutionId: 'inbound-batch:lote-cancel-2', mensagemAtual: 'Pode cancelar',
    } });

    expect(JSON.parse(raw)).toMatchObject({ success: false, reasonCode: 'STALE_EVENT' });
    expect(raw).toContain('Não confirme o cancelamento');
  });
});
