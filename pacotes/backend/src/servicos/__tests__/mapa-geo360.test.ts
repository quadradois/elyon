import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../../lib/db';
import { mapaService } from '../mapa';

jest.mock('../../lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn<any>(),
    edificio: {
      findMany: jest.fn<any>()
    },
    imovel: {
      findMany: jest.fn<any>(),
      count: jest.fn<any>()
    },
    imovelRancho: {
      count: jest.fn<any>(),
      findMany: jest.fn<any>()
    }
  }
}));

describe('MapaService - descoberta GEO360', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna referência tipada quando encontra um alias validado', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      {
        cidade: 'goiania',
        id_lote: 405683,
        nome: 'WISH VACA BRAVA',
        endereco_oficial: 'R T-53, SETOR BUENO',
        total_unidades: 287,
        encontrado_por: 'alias'
      }
    ]);

    const resultado = await mapaService.buscarEmpreendimentosGeo360('wish vaca brava', 20);

    expect(resultado).toEqual([
      expect.objectContaining({
        codigo: 405683,
        idLote: 405683,
        cidade: 'goiania',
        fonte: 'geo360',
        encontradoPor: 'alias',
        nome: 'WISH VACA BRAVA',
        totalUnidades: 287
      })
    ]);
  });

  it('normaliza acentos antes de consultar a GEO360', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([]);

    await mapaService.buscarEmpreendimentosGeo360('Condomínio Lago Azul', 20);

    const chamada = (prisma.$queryRaw as any).mock.calls[0];
    expect(chamada).toContain('%CONDOMINIOLAGOAZUL%');
    expect(chamada).toContain('CONDOMINIOLAGOAZUL');
  });

  it('não mistura o legado quando a GEO360 encontra o empreendimento', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      {
        cidade: 'goiania',
        id_lote: 22366,
        nome: 'GRAN CANÁRIA',
        endereco_oficial: 'R DA DIVISA AP 402-BL03, BAIRRO S MORADA DO SOL',
        total_unidades: 112,
        encontrado_por: 'nome_oficial'
      }
    ]);

    const resultado = await mapaService.buscarEdificiosPorNome('Gran Canaria', 20);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toEqual(expect.objectContaining({
      idLote: 22366,
      fonte: 'geo360',
      nome: 'GRAN CANÁRIA'
    }));
    expect(prisma.edificio.findMany).not.toHaveBeenCalled();
    expect(prisma.imovel.findMany).not.toHaveBeenCalled();
  });

  it('usa o legado somente como fallback quando a GEO360 não encontra resultados', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([]);
    (prisma.edificio.findMany as any).mockResolvedValue([
      {
        codigo: 9001,
        nome: 'EDIFÍCIO SOMENTE LEGADO',
        logradouro: 'R TESTE',
        bairro: null
      }
    ]);
    (prisma.imovel.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const resultado = await mapaService.buscarEdificiosPorNome('Somente Legado', 20);

    expect(resultado).toEqual([
      expect.objectContaining({
        codigo: 9001,
        fonte: 'legado',
        encontradoPor: 'legado'
      })
    ]);
  });

  it('lista unidades pelo par cidade e idLote, sem usar codigoEdificio', async () => {
    (prisma.imovelRancho.count as any).mockResolvedValue(1);
    (prisma.imovelRancho.findMany as any).mockResolvedValue([
      {
        inscricaoCartografica: '43918305000010',
        complemento: 'AP 101',
        nrLote: null,
        logradouro: 'R MANACA',
        endereco: null,
        bairro: 'LOT AGUA AZUL',
        areaConstruida: 52.4
      }
    ]);

    const resultado = await mapaService.buscarUnidadesPorLoteGeo360(
      'goiania',
      76693,
      0,
      100,
      'CONDOMÍNIO LAGO AZUL I'
    );

    expect(prisma.imovelRancho.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cidade: 'goiania', idLote: 76693 }
      })
    );
    expect(resultado).toEqual({
      total: 1,
      hasMore: false,
      unidades: [
        expect.objectContaining({
          nrinscr: '43918305000010',
          nmedificio: 'CONDOMÍNIO LAGO AZUL I',
          incompl: 'AP 101',
          nmlogradou: 'R MANACA'
        })
      ]
    });
  });
});
