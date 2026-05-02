const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@openai/agents', () => ({
  tool: (cfg: any) => cfg,
}));

jest.mock('../../lib/db', () => ({
  prisma: mockPrisma,
}));

const mockEnviarParaCrm = jest.fn();
jest.mock('../../servicos/crm-service', () => ({
  enviarParaCrm: (...args: any[]) => mockEnviarParaCrm(...args),
}));

const mockMoverExecute = jest.fn();
const mockRegistrarOptoutExecute = jest.fn();

jest.mock('../../casos-de-uso/agentes', () => ({
  ConverterParaLeadUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  MoverParaFaseUseCase: jest.fn().mockImplementation(() => ({ execute: mockMoverExecute })),
  SalvarDadosImovelUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  AgendarFollowupUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  EncaminharCorretorUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  AtualizarDadosLeadUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  QualificarLeadUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  RegistrarOptoutUseCase: jest.fn().mockImplementation(() => ({ execute: mockRegistrarOptoutExecute })),
}));

import {
  moverParaFaseTool,
  enviarParaCrmTool,
  registrarOptoutTool,
} from '../sdr-tools-agents';

describe('P0-04 ownership cross-tenant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloqueia mover_para_fase quando lead pertence a outro tenant', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-cross-1',
      tenantId: 'tenant-b',
    });

    const raw = await (moverParaFaseTool as any).execute(
      {
        leadId: 'lead-cross-1',
        faseDestino: 'FASE2',
        motivo: 'teste',
        dadosAdicionais: null,
      },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('TENANT_OWNERSHIP_DENIED');
    expect(mockMoverExecute).not.toHaveBeenCalled();
  });

  it('bloqueia enviar_para_crm e não chama integração externa em cross-tenant', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-cross-2',
      tenantId: 'tenant-b',
    });

    const raw = await (enviarParaCrmTool as any).execute(
      { leadId: 'lead-cross-2' },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('TENANT_OWNERSHIP_DENIED');
    expect(mockEnviarParaCrm).not.toHaveBeenCalled();
  });

  it('bloqueia registrar_optout em cross-tenant', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-cross-3',
      tenantId: 'tenant-b',
    });

    const raw = await (registrarOptoutTool as any).execute(
      { contatoId: 'lead-cross-3', motivo: 'NAO_INCOMODAR' },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('TENANT_OWNERSHIP_DENIED');
    expect(mockRegistrarOptoutExecute).not.toHaveBeenCalled();
  });
});
