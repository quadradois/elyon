const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
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
jest.mock('../../casos-de-uso/agentes', () => ({
  ConverterParaLeadUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  MoverParaFaseUseCase: jest.fn().mockImplementation(() => ({ execute: mockMoverExecute })),
  SalvarDadosImovelUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  AgendarFollowupUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  EncaminharCorretorUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  AtualizarDadosLeadUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  QualificarLeadUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
  RegistrarOptoutUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
}));

const mockGerarContrato = jest.fn();
jest.mock('../../contratos/contrato-service', () => ({
  __esModule: true,
  default: {
    gerarContratoCaptacao: (...args: any[]) => mockGerarContrato(...args),
  },
}));

import {
  enviarParaCrmTool,
  gerarLinkContratoTool,
  moverParaFaseTool,
} from '../sdr-tools-agents';

describe('P0-05 policy deterministica para ações irreversíveis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AGENT_AUTO_CAPTADO_AFTER_CRM;
    delete process.env.AGENT_REQUIRE_MANUAL_APPROVAL_CRM;
    delete process.env.AGENT_REQUIRE_MANUAL_APPROVAL_CONTRACT;
    delete process.env.AGENT_REQUIRE_MANUAL_APPROVAL_CAPTADO;
  });

  it('bloqueia enviar_para_crm sem aprovação humana e não chama CRM', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-1', tenantId: 'tenant-a' })
      .mockResolvedValueOnce({
        id: 'lead-1',
        tenantId: 'tenant-a',
        status: 'ONBOARDING',
        tipoImovel: 'Apartamento',
        valorPretendido: '700000',
        quartosImovel: 2,
        tipoAutorizacao: 'exclusiva',
        comissaoAcordada: '6%',
      });

    const raw = await (enviarParaCrmTool as any).execute(
      { leadId: 'lead-1' },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('MANUAL_APPROVAL_REQUIRED');
    expect(mockEnviarParaCrm).not.toHaveBeenCalled();
  });

  it('envia para CRM com aprovação e não move CAPTADO automaticamente por padrão', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-2', tenantId: 'tenant-a' })
      .mockResolvedValueOnce({
        id: 'lead-2',
        tenantId: 'tenant-a',
        status: 'ONBOARDING',
        tipoImovel: 'Apartamento',
        valorPretendido: '750000',
        quartosImovel: 3,
        tipoAutorizacao: 'exclusiva',
        comissaoAcordada: '6%',
      });

    mockEnviarParaCrm.mockResolvedValue({
      success: true,
      property_id: 'p1',
      property_code: 'C123',
    });

    const raw = await (enviarParaCrmTool as any).execute(
      { leadId: 'lead-2', aprovacaoHumana: true },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(true);
    expect(result.statusAtualizado).toBeNull();
    expect(mockEnviarParaCrm).toHaveBeenCalledTimes(1);
    expect(mockMoverExecute).not.toHaveBeenCalled();
  });

  it('bloqueia gerar_link_contrato sem aprovação humana', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-3', tenantId: 'tenant-a' })
      .mockResolvedValueOnce({
        id: 'lead-3',
        tenantId: 'tenant-a',
        status: 'DOCUMENTACAO',
        tipoAutorizacao: 'exclusiva',
        comissaoAcordada: '6%',
        prazoTrabalho: 90,
        autorizouAnuncio: true,
      });

    const raw = await (gerarLinkContratoTool as any).execute(
      { leadId: 'lead-3', tipoContrato: 'CAPTACAO' },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('MANUAL_APPROVAL_REQUIRED');
    expect(mockGerarContrato).not.toHaveBeenCalled();
  });

  it('bloqueia mover_para_fase CAPTADO sem aprovação humana', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-captado-4', tenantId: 'tenant-a' })
      .mockResolvedValueOnce({ status: 'ONBOARDING', crmSyncStatus: 'synced' });

    const raw = await (moverParaFaseTool as any).execute(
      { leadId: 'lead-captado-4', faseDestino: 'CAPTADO', motivo: 'teste', dadosAdicionais: null },
      { context: { tenantId: 'tenant-a' } }
    );

    const result = JSON.parse(raw);
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('MANUAL_APPROVAL_REQUIRED');
    expect(mockMoverExecute).not.toHaveBeenCalled();
  });
});
