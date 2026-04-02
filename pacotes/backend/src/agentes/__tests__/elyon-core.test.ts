const mockPrisma = {
  conversa: {
    update: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  contato: {
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

import { ElyonCore } from '../elyon-core';

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
    it('busca conversas inativas e finaliza cada uma', async () => {
      mockPrisma.conversa.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      const spyFinalizar = jest.spyOn(core, 'finalizarConversa').mockResolvedValue(undefined);

      const result = await core.processarConversasInativas(12);

      expect(result).toBe(2);
      expect(mockPrisma.conversa.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estadoConversa: 'ativa' }),
          take: 50,
        })
      );
      expect(spyFinalizar).toHaveBeenCalledTimes(2);
      expect(spyFinalizar).toHaveBeenNthCalledWith(1, 'c1');
      expect(spyFinalizar).toHaveBeenNthCalledWith(2, 'c2');

      spyFinalizar.mockRestore();
    });

    it('retorna 0 quando busca de conversas inativas falha', async () => {
      mockPrisma.conversa.findMany.mockRejectedValue(new Error('Falha consulta'));

      const result = await core.processarConversasInativas();

      expect(result).toBe(0);
    });
  });

  describe('fiscalizarConversoesPendentes', () => {
    it('retorna zerado quando não há contatos pendentes', async () => {
      mockPrisma.contato.findMany.mockResolvedValue([]);

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 0, convertidas: 0, erros: 0 });
      expect(mockPrisma.conversa.findFirst).not.toHaveBeenCalled();
      expect(mockConverterExecute).not.toHaveBeenCalled();
    });

    it('converte contato quando detecta sinal de aceitação', async () => {
      mockPrisma.contato.findMany.mockResolvedValue([
        {
          id: 'contato-1',
          nome: 'Maria',
          telefone: '5511999991111',
          campanha: { tenantId: 'tenant-1', empreendimento: null },
        },
      ]);

      mockPrisma.conversa.findFirst.mockResolvedValue({
        id: 'conv-1',
        mensagens: [
          { remetente: 'usuario', conteudo: 'Podemos agendar dia 10/03 às 10:30?' },
          { remetente: 'usuario', conteudo: 'Apartamento com 3 quartos' },
          { remetente: 'agente', conteudo: 'Perfeito' },
        ],
      });

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 1, erros: 0 });
      expect(MockConverterParaLeadUseCase).toHaveBeenCalledTimes(1);
      expect(mockConverterExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          contatoId: 'contato-1',
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
      mockPrisma.contato.findMany.mockResolvedValue([
        {
          id: 'contato-2',
          nome: 'João',
          telefone: '5511988887777',
          campanha: { tenantId: 'tenant-2' },
        },
      ]);

      mockPrisma.conversa.findFirst.mockResolvedValue({
        id: 'conv-2',
        mensagens: [
          { remetente: 'usuario', conteudo: 'Vou pensar e te aviso depois.' },
        ],
      });

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 0, erros: 0 });
      expect(mockConverterExecute).not.toHaveBeenCalled();
      expect(mockMetricasSDRService.registrarMetrica).not.toHaveBeenCalled();
    });

    it('contabiliza erro quando conversão automática falha', async () => {
      mockPrisma.contato.findMany.mockResolvedValue([
        {
          id: 'contato-3',
          nome: 'Carlos',
          telefone: '5511977776666',
          campanha: { tenantId: 'tenant-3' },
        },
      ]);

      mockPrisma.conversa.findFirst.mockResolvedValue({
        id: 'conv-3',
        mensagens: [{ remetente: 'usuario', conteudo: 'Fechado, pode anunciar.' }],
      });

      mockConverterExecute.mockRejectedValue(new Error('Erro conversão'));

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 0, erros: 1 });
    });

    it('retorna parcialmente com erro quando análise de contato falha', async () => {
      mockPrisma.contato.findMany.mockResolvedValue([
        {
          id: 'contato-4',
          nome: 'Paula',
          telefone: '5511966665555',
          campanha: { tenantId: 'tenant-4' },
        },
      ]);

      mockPrisma.conversa.findFirst.mockRejectedValue(new Error('Erro consulta conversa'));

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 1, convertidas: 0, erros: 1 });
    });

    it('retorna zerado quando consulta principal falha', async () => {
      mockPrisma.contato.findMany.mockRejectedValue(new Error('DB indisponível'));

      const result = await core.fiscalizarConversoesPendentes();

      expect(result).toEqual({ analisadas: 0, convertidas: 0, erros: 0 });
    });
  });
});
