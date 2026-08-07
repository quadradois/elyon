import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../../lib/db';
import {
  normalizarTermoMonitoramento,
  registrarBuscaFallbackLegado
} from '../geo360-busca-monitoramento';

jest.mock('../../lib/db', () => ({
  prisma: {
    geo360BuscaFallback: {
      upsert: jest.fn<any>()
    }
  }
}));

describe('monitoramento de fallback GEO360', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normaliza nome de empreendimento sem conservar caracteres sensíveis', () => {
    expect(normalizarTermoMonitoramento('  Edifício Gran Canária  ')).toBe(
      'EDIFICIO GRAN CANARIA'
    );
  });

  it.each(['43918305000010', '123456', '12.345.678/0001-90'])(
    'não persiste termo numérico potencialmente sensível: %s',
    async (termo) => {
      await registrarBuscaFallbackLegado(termo, [
        { codigo: 1, nome: 'TESTE', logradouro: 'R TESTE' }
      ]);

      expect(prisma.geo360BuscaFallback.upsert).not.toHaveBeenCalled();
    }
  );

  it('agrega ocorrências por hash e salva somente o resumo do legado', async () => {
    (prisma.geo360BuscaFallback.upsert as any).mockResolvedValue({});

    await registrarBuscaFallbackLegado('Residencial Exemplo', [
      {
        codigo: 9001,
        nome: 'RESIDENCIAL EXEMPLO',
        logradouro: 'R TESTE',
        totalUnidades: 20
      }
    ]);

    expect(prisma.geo360BuscaFallback.upsert).toHaveBeenCalledWith({
      where: { termoHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      create: expect.objectContaining({
        termoNormalizado: 'RESIDENCIAL EXEMPLO',
        resultadosLegado: [
          {
            codigo: 9001,
            nome: 'RESIDENCIAL EXEMPLO',
            logradouro: 'R TESTE',
            totalUnidades: 20
          }
        ]
      }),
      update: expect.objectContaining({
        ocorrencias: { increment: 1 },
        ultimoEm: expect.any(Date),
        status: 'PENDENTE',
        resolvidoEm: null
      })
    });
  });

  it('não interrompe a busca quando a gravação de monitoramento falha', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (prisma.geo360BuscaFallback.upsert as any).mockRejectedValue(new Error('banco indisponível'));

    await expect(registrarBuscaFallbackLegado('Residencial Exemplo', [
      { codigo: 9001, nome: 'RESIDENCIAL EXEMPLO', logradouro: 'R TESTE' }
    ])).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
