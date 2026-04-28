import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { prisma } from '../../lib/db';
import { ResumoEstruturalEmpreendimentoService } from '../resumo-estrutural-empreendimento';

jest.mock('../../lib/db', () => ({
  prisma: {
    imovel: {
      findMany: jest.fn<any>(),
    },
  },
}));

describe('ResumoEstruturalEmpreendimentoService', () => {
  const service = new ResumoEstruturalEmpreendimentoService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agrega dados estruturais da prefeitura por codigoEdificio', async () => {
    (prisma.imovel.findMany as jest.Mock<any>).mockResolvedValue([
      {
        codigoEdificio: 834,
        nomeEdificio: 'TOCANTINS',
        logradouro: 'AV TOCANTINS',
        bairro: 'CENTRO',
        areaTerreno: 1111.4,
        areaEdificada: 80,
        latitude: 8155253.05302,
        longitude: 685588.27918,
        numeroPavimentos: 54,
        numeroElevadores: 3,
        vagasCobertas: 1,
        vagasDescobertas: 0,
        numeroGaragens: 1,
        tipoEdificacao1: 2,
        tipoEdificacao2: 9,
        estrutura: 2,
        esquadrias: 2,
        piso: 6,
        forro: 1,
      },
      {
        codigoEdificio: 834,
        nomeEdificio: 'TOCANTINS',
        logradouro: 'AV TOCANTINS',
        bairro: 'CENTRO',
        areaTerreno: 1111.4,
        areaEdificada: 90,
        latitude: 8155253.05302,
        longitude: 685588.27918,
        numeroPavimentos: 54,
        numeroElevadores: 3,
        vagasCobertas: 1,
        vagasDescobertas: null,
        numeroGaragens: 1,
        tipoEdificacao1: 2,
        tipoEdificacao2: 9,
        estrutura: 2,
        esquadrias: 2,
        piso: 6,
        forro: 1,
      },
    ]);

    const resumo = await service.buscarResumo({ nomeEmpreendimento: 'TOCANTINS' });

    expect(resumo).toMatchObject({
      fonte: 'PREFEITURA_MAPA',
      codigoEdificio: 834,
      nomeEdificio: 'TOCANTINS',
      totalUnidades: 2,
      numeroPavimentos: 54,
      numeroElevadores: 3,
      vagasCobertas: 2,
      numeroGaragens: 2,
      areaTerreno: 1111.4,
      areaEdificada: 170,
      tipoEdificacao1: 2,
      descricoes: {
        tipoEdificacao1: 'Apartamento',
        estrutura: 'Código 2',
      },
    });
  });

  it('mescla dadosEstruturaisMapa sem apagar briefing humano', () => {
    const resumo: any = {
      fonte: 'PREFEITURA_MAPA',
      codigoEdificio: 4798,
      nomeEdificio: 'ED PEDRA DA LUA',
      totalUnidades: 207,
      areaTerreno: 14885.88,
      descricoes: {},
    };

    const estruturado = service.mesclarBriefingEstruturado(
      { resumo_sdr: 'Briefing comercial', diferenciais: ['localização'] },
      resumo
    );
    const completo = service.anexarBlocoTexto('Briefing humano do corretor.', resumo);

    expect(estruturado.resumo_sdr).toBe('Briefing comercial');
    expect(estruturado.dadosEstruturaisMapa.codigoEdificio).toBe(4798);
    expect(completo).toContain('Briefing humano do corretor.');
    expect(completo).toContain('### Dados estruturais da prefeitura/MAPA');
    expect(completo).toContain('Total de unidades identificadas: 207.');
  });

  it('substitui bloco MAPA anterior para evitar duplicidade', () => {
    const resumo: any = {
      fonte: 'PREFEITURA_MAPA',
      codigoEdificio: 4798,
      nomeEdificio: 'ED PEDRA DA LUA',
      totalUnidades: 207,
      descricoes: {},
    };

    const primeiraVersao = service.anexarBlocoTexto('Briefing humano.', resumo)!;
    const segundaVersao = service.anexarBlocoTexto(primeiraVersao, resumo)!;

    expect((segundaVersao.match(/Dados estruturais da prefeitura\/MAPA/g) || []).length).toBe(1);
    expect(segundaVersao).toContain('Briefing humano.');
  });
});
