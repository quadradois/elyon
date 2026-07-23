import { prisma } from '../../lib/db';
import {
  aliasesGeo360Validados,
  sincronizarAliasesGeo360Validados,
} from '../geo360-aliases';

jest.mock('../../lib/db', () => ({
  prisma: {
    geo360Lote: { findUnique: jest.fn() },
    geo360LoteAlias: { upsert: jest.fn() },
  },
}));

describe('aliases comerciais GEO360', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cadastra Wish Vaca Brava como alias validado sem alterar o nome oficial', async () => {
    (prisma.geo360Lote.findUnique as jest.Mock).mockResolvedValue({ idLote: 405683 });
    (prisma.geo360LoteAlias.upsert as jest.Mock).mockResolvedValue({});

    const resultado = await sincronizarAliasesGeo360Validados();

    expect(resultado).toEqual({ total: 1, cadastrados: 1, ignorados: 0 });
    expect(aliasesGeo360Validados[0]).toMatchObject({
      cidade: 'goiania',
      idLote: 405683,
      nome: 'WISH VACA BRAVA',
      construtora: 'EBM',
    });
    expect(prisma.geo360LoteAlias.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        nome: 'WISH VACA BRAVA',
        validado: true,
      }),
      update: expect.not.objectContaining({ nomeCondominio: expect.anything() }),
    }));
  });

  it('ignora o alias quando o lote ainda nao existe', async () => {
    (prisma.geo360Lote.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(sincronizarAliasesGeo360Validados())
      .resolves.toEqual({ total: 1, cadastrados: 0, ignorados: 1 });
    expect(prisma.geo360LoteAlias.upsert).not.toHaveBeenCalled();
  });
});
