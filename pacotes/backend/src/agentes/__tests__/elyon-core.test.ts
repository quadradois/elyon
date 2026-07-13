const mockPrisma = {
  conversa: {
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  lead: {
    findMany: jest.fn(),
  },
};

const mockRagConversasService = {
  processarConversaFinalizada: jest.fn(),
};

const mockMetricasSDRService = {
  registrarMetrica: jest.fn(),
};

const mockConverterExecute = jest.fn();
const MockConverterParaLeadUseCase = jest.fn().mockImplementation(() => ({
  execute: mockConverterExecute,
}));

jest.mock('../../lib/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../servicos/rag-conversas', () => ({
  ragConversasService: mockRagConversasService,
}));

jest.mock('../../servicos/metricas-sdr', () => ({
  metricasSDRService: mockMetricasSDRService,
}));

jest.mock('../../casos-de-uso/agentes/converter-para-lead.usecase', () => ({
  ConverterParaLeadUseCase: MockConverterParaLeadUseCase,
}));

// Mock OpenAI — retorna "SIM" por padrão (aceitação detectada)
const mockOpenAICreate = jest.fn().mockResolvedValue({
  choices: [{ message: { content: 'SIM' } }],
});
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
}));

// Mock orchestrator-queries (buscarConfiguracaoTenant)
jest.mock('../orchestrator-queries', () => ({
  buscarConfiguracaoTenant: jest.fn().mockResolvedValue(null),
  buscarContextoConversa: jest.fn(),
}));

// Mock byok-resolver
jest.mock('../byok-resolver', () => ({
  resolverChaveAgentes: jest.fn().mockReturnValue({ apiKey: 'fake-key', baseUrl: undefined }),
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { ElyonCore } from '../elyon-core';

// Garantir OPENAI_API_KEY para que basePlatformClient não seja null
const ORIG_KEY = process.env.OPENAI_API_KEY;
beforeAll(() => { process.env.OPENAI_API_KEY = 'test-key'; });
afterAll(() => { process.env.OPENAI_API_KEY = ORIG_KEY; });

describe('ElyonCore', () => {
  const core = new ElyonCore();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRagConversasService.processarConversaFinalizada.mockResolvedValue(undefined);
    mockMetricasSDRService.registrarMetrica.mockResolvedValue('metrica-1');
    mockConverterExecute.mockResolvedValue({ success: true, leadId: 'lead-convertido' });
  });

  describe('finalizarConversa', () => {
    it('finaliza conversa e dispara processamento RAG em background', async () => {
      mockPrisma.conversa.update.mockResolvedValue({});

      await core.finalizarConversa('conv-1');

      expect(mockPrisma.conversa.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: expect.objectContaining({ estadoConversa: 'finalizada' }),
      });

      expect(mockRagConversasService.processarConversaFinalizada).toHaveBeenCalledWith('conv-1');
    });

    it('não propaga erro quando update da conversa falha', async () => {
      mockPrisma.conversa.update.mockRejectedValue(new Error('Erro DB'));

      await expect(core.finalizarConversa('conv-2')).resolves.toBeUndefined();
      expect(mockRagConversasService.processarConversaFinalizada).not.toHaveBeenCalled();
    });
  });

  describe('processarConversasInativas', () => {
    it('busca conversas inativas e finaliza em batch via updateMany', async () => {
      mockPrisma.conversa.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      mockPrisma.conversa.updateMany.mockResolvedValue({ count: 2 });

      const result = await core.processarConversasInativas(12);

      expect(result).toBe(2);
      expect(mockPrisma.conversa.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estadoConversa: 'ativa' }),
          take: 50,
        })
      );
      expect(mockPrisma.conversa.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2'] } },
        data: expect.objectContaining({ estadoConversa: 'finalizada' }),
      });
      expect(mockRagConversasService.processarConversaFinalizada).toHaveBeenCalledTimes(2);
    });

    it('retorna 0 quando busca de conversas inativas falha', async () => {
      mockPrisma.conversa.findMany.mockRejectedValue(new Error('Falha consulta'));

      const result = await core.processarConversasInativas();

      expect(result).toBe(0);
    });
  });

  describe('fiscalizarConversoesPendentes', () => {
    it('retorna zerado quando não há contatos pendentes', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.conversa.findMany.mockResolvedValue([]);

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 0, convertidas: 0, erros: 0 });
      expect(mockConverterExecute).not.toHaveBeenCalled();
    });

    it('converte contato quando detecta sinal de aceitação', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'contato-1',
          nome: 'Maria',
          telefone: '5511999991111',
          campanhaOrigem: { tenantId: 'tenant-1', empreendimento: null },
        },
      ]);

      // Batch findMany retorna conversa associada ao contato-1
      mockPrisma.conversa.findMany.mockResolvedValue([{
        id: 'conv-1',
        leadId: 'contato-1',
        lead: { telefone: '5511999991111' },
        mensagens: [
          { remetente: 'usuario', conteudo: 'Podemos agendar dia 10/03 às 10:30?' },
          { remetente: 'usuario', conteudo: 'Apartamento com 3 quartos' },
          { remetente: 'agente', conteudo: 'Perfeito' },
        ],
      }]);

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 1, erros: 0 });
      expect(MockConverterParaLeadUseCase).toHaveBeenCalledTimes(1);
      expect(mockConverterExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 'contato-1',
          tipoInteresse: 'VENDA',
          temperatura: 'QUENTE',
          timeline: '10/03',
          quartosImovel: 3,
        })
      );

      expect(mockMetricasSDRService.registrarMetrica).toHaveBeenCalledWith(
        expect.objectContaining({
          conversaId: 'conv-1',
          tenantId: 'tenant-1',
          acaoSupervisor: 'ENVIAR',
        })
      );
    });

    it('não tenta converter quando não há sinais de fechamento', async () => {
      // LLM retorna "NAO" — sem sinal de aceitação
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'NAO' } }],
      });

      mockPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'contato-2',
          nome: 'João',
          telefone: '5511988887777',
          campanhaOrigem: { tenantId: 'tenant-2' },
        },
      ]);

      mockPrisma.conversa.findMany.mockResolvedValue([{
        id: 'conv-2',
        leadId: 'contato-2',
        lead: { telefone: '5511988887777' },
        mensagens: [
          { remetente: 'usuario', conteudo: 'Vou pensar e te aviso depois.' },
        ],
      }]);

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 0, erros: 0 });
      expect(mockConverterExecute).not.toHaveBeenCalled();
      expect(mockMetricasSDRService.registrarMetrica).not.toHaveBeenCalled();
    });

    it('contabiliza erro quando conversão automática falha', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'contato-3',
          nome: 'Carlos',
          telefone: '5511977776666',
          campanhaOrigem: { tenantId: 'tenant-3' },
        },
      ]);

      mockPrisma.conversa.findMany.mockResolvedValue([{
        id: 'conv-3',
        leadId: 'contato-3',
        lead: { telefone: '5511977776666' },
        mensagens: [{ remetente: 'usuario', conteudo: 'Fechado, pode anunciar.' }],
      }]);

      mockConverterExecute.mockRejectedValue(new Error('Erro conversão'));

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 0, erros: 1 });
    });

    it('contabiliza erro quando LLM de avaliação falha e regex também não detecta', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'contato-4',
          nome: 'Paula',
          telefone: '5511966665555',
          campanhaOrigem: { tenantId: 'tenant-4' },
        },
      ]);

      mockPrisma.conversa.findMany.mockResolvedValue([{
        id: 'conv-4',
        leadId: 'contato-4',
        lead: { telefone: '5511966665555' },
        mensagens: [{ remetente: 'usuario', conteudo: 'Aceito a proposta, pode anunciar.' }],
      }]);

      mockConverterExecute.mockRejectedValueOnce(new Error('Erro conversão'));

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 0, erros: 1 });
    });

    it('retorna zerado quando consulta principal falha', async () => {
      mockPrisma.lead.findMany.mockRejectedValue(new Error('DB indisponível'));

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 0, convertidas: 0, erros: 0 });
    });
  });
});
