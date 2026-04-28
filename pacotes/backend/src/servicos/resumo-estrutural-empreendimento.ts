import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';

export interface ResumoEstruturalMapa {
  fonte: 'PREFEITURA_MAPA';
  codigoEdificio: number;
  nomeEdificio: string;
  logradouro?: string | null;
  bairro?: string | null;
  totalUnidades: number;
  numeroPavimentos?: number | null;
  numeroElevadores?: number | null;
  vagasCobertas?: number | null;
  vagasDescobertas?: number | null;
  numeroGaragens?: number | null;
  areaTerreno?: number | null;
  areaEdificada?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  tipoEdificacao1?: number | null;
  tipoEdificacao2?: number | null;
  estrutura?: number | null;
  esquadrias?: number | null;
  piso?: number | null;
  forro?: number | null;
  descricoes: {
    tipoEdificacao1?: string | null;
    tipoEdificacao2?: string | null;
    estrutura?: string | null;
    esquadrias?: string | null;
    piso?: string | null;
    forro?: string | null;
  };
}

interface BuscarResumoParams {
  nomeEmpreendimento?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  codigoEdificio?: number | null;
}

const TITULO_BLOCO_MAPA = '### Dados estruturais da prefeitura/MAPA';
const BLOCO_MAPA_REGEX = /\n{0,2}### Dados estruturais da prefeitura\/MAPA[\s\S]*?(?=\n{2}### |\s*$)/;

export class ResumoEstruturalEmpreendimentoService {
  private sanitizarTexto(valor?: string | null): string | null {
    const texto = (valor || '').trim();
    return texto.length ? texto : null;
  }

  private sanitizarInteiroPositivo(valor?: number | null): number | null {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return null;
    return Math.trunc(valor);
  }

  private sanitizarArea(valor?: number | null, maximo: number = 1_000_000): number | null {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > maximo) return null;
    return Number(valor.toFixed(2));
  }

  private primeiroNumeroValido(valores: Array<number | null | undefined>): number | null {
    for (const valor of valores) {
      if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) return valor;
    }
    return null;
  }

  private maximoValido(valores: Array<number | null | undefined>): number | null {
    const validos = valores
      .map((valor) => this.sanitizarInteiroPositivo(valor))
      .filter((valor): valor is number => valor !== null);

    return validos.length ? Math.max(...validos) : null;
  }

  private somaValida(valores: Array<number | null | undefined>): number | null {
    const soma = valores.reduce((total: number, valor) => {
      const normalizado = this.sanitizarInteiroPositivo(valor);
      return total + (normalizado || 0);
    }, 0);

    return soma > 0 ? soma : null;
  }

  private codigoMaisFrequente(valores: Array<number | null | undefined>): number | null {
    const frequencias = new Map<number, number>();

    for (const valor of valores) {
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) continue;
      frequencias.set(valor, (frequencias.get(valor) || 0) + 1);
    }

    let melhor: number | null = null;
    let maiorFrequencia = 0;

    for (const [valor, frequencia] of frequencias.entries()) {
      if (frequencia > maiorFrequencia) {
        melhor = valor;
        maiorFrequencia = frequencia;
      }
    }

    return melhor;
  }

  private descreverTipoEdificacao(codigo?: number | null): string | null {
    if (!codigo) return null;

    const mapa: Record<number, string> = {
      1: 'Casa',
      2: 'Apartamento',
      3: 'Sala/Loja',
      4: 'Galpão'
    };

    return mapa[codigo] || `Código ${codigo}`;
  }

  private descreverCodigoConstrutivo(codigo?: number | null): string | null {
    if (!codigo) return null;
    return `Código ${codigo}`;
  }

  async buscarResumo(params: BuscarResumoParams): Promise<ResumoEstruturalMapa | null> {
    const nomeEmpreendimento = this.sanitizarTexto(params.nomeEmpreendimento);
    const logradouro = this.sanitizarTexto(params.logradouro);
    const bairro = this.sanitizarTexto(params.bairro);

    if (!params.codigoEdificio && !nomeEmpreendimento) return null;

    const select = {
        codigoEdificio: true,
        nomeEdificio: true,
        logradouro: true,
        bairro: true,
        areaTerreno: true,
        areaEdificada: true,
        latitude: true,
        longitude: true,
        numeroPavimentos: true,
        numeroElevadores: true,
        vagasCobertas: true,
        vagasDescobertas: true,
        numeroGaragens: true,
        tipoEdificacao1: true,
        tipoEdificacao2: true,
        estrutura: true,
        esquadrias: true,
        piso: true,
        forro: true
      } satisfies Prisma.ImovelSelect;
    type ImovelResumo = Prisma.ImovelGetPayload<{ select: typeof select }>;

    const whereComFiltros: Prisma.ImovelWhereInput = params.codigoEdificio
      ? { codigoEdificio: params.codigoEdificio }
      : {
          nomeEdificio: { contains: nomeEmpreendimento!, mode: 'insensitive' as const },
          ...(logradouro ? { logradouro: { contains: logradouro, mode: 'insensitive' as const } } : {}),
          ...(bairro ? { bairro: { contains: bairro, mode: 'insensitive' as const } } : {}),
        };

    let imoveis: ImovelResumo[] = await prisma.imovel.findMany({
      where: whereComFiltros,
      select,
      take: 2000
    });

    if (!imoveis.length && !params.codigoEdificio && nomeEmpreendimento && logradouro && bairro) {
      imoveis = await prisma.imovel.findMany({
        where: {
          nomeEdificio: { contains: nomeEmpreendimento, mode: 'insensitive' as const },
          logradouro: { contains: logradouro, mode: 'insensitive' as const },
        },
        select,
        take: 2000
      });
    }

    if (!imoveis.length && !params.codigoEdificio && nomeEmpreendimento && !logradouro && bairro) {
      imoveis = await prisma.imovel.findMany({
        where: { nomeEdificio: { contains: nomeEmpreendimento, mode: 'insensitive' as const } },
        select,
        take: 2000
      });
    }

    const grupos = new Map<number, typeof imoveis>();
    for (const imovel of imoveis) {
      if (!imovel.codigoEdificio) continue;
      grupos.set(imovel.codigoEdificio, [...(grupos.get(imovel.codigoEdificio) || []), imovel]);
    }

    const [codigoEdificio, unidades] = [...grupos.entries()]
      .sort((a, b) => b[1].length - a[1].length)[0] || [];

    if (!codigoEdificio || !unidades?.length) return null;

    const primeiro = unidades[0];
    const areasEdificadasValidas = unidades
      .map((unidade) => this.sanitizarArea(unidade.areaEdificada, 1000))
      .filter((area): area is number => area !== null);

    const tipoEdificacao1 = this.codigoMaisFrequente(unidades.map((u) => u.tipoEdificacao1));
    const tipoEdificacao2 = this.codigoMaisFrequente(unidades.map((u) => u.tipoEdificacao2));
    const estrutura = this.codigoMaisFrequente(unidades.map((u) => u.estrutura));
    const esquadrias = this.codigoMaisFrequente(unidades.map((u) => u.esquadrias));
    const piso = this.codigoMaisFrequente(unidades.map((u) => u.piso));
    const forro = this.codigoMaisFrequente(unidades.map((u) => u.forro));

    return {
      fonte: 'PREFEITURA_MAPA',
      codigoEdificio,
      nomeEdificio: primeiro.nomeEdificio || nomeEmpreendimento || '',
      logradouro: primeiro.logradouro,
      bairro: primeiro.bairro,
      totalUnidades: unidades.length,
      numeroPavimentos: this.maximoValido(unidades.map((u) => u.numeroPavimentos)),
      numeroElevadores: this.maximoValido(unidades.map((u) => u.numeroElevadores)),
      vagasCobertas: this.somaValida(unidades.map((u) => u.vagasCobertas)),
      vagasDescobertas: this.somaValida(unidades.map((u) => u.vagasDescobertas)),
      numeroGaragens: this.somaValida(unidades.map((u) => u.numeroGaragens)),
      areaTerreno: this.sanitizarArea(Math.max(...unidades.map((u) => this.sanitizarArea(u.areaTerreno) || 0))),
      areaEdificada: areasEdificadasValidas.length
        ? Number(areasEdificadasValidas.reduce((total, area) => total + area, 0).toFixed(2))
        : null,
      latitude: this.primeiroNumeroValido(unidades.map((u) => u.latitude)),
      longitude: this.primeiroNumeroValido(unidades.map((u) => u.longitude)),
      tipoEdificacao1,
      tipoEdificacao2,
      estrutura,
      esquadrias,
      piso,
      forro,
      descricoes: {
        tipoEdificacao1: this.descreverTipoEdificacao(tipoEdificacao1),
        tipoEdificacao2: this.descreverTipoEdificacao(tipoEdificacao2),
        estrutura: this.descreverCodigoConstrutivo(estrutura),
        esquadrias: this.descreverCodigoConstrutivo(esquadrias),
        piso: this.descreverCodigoConstrutivo(piso),
        forro: this.descreverCodigoConstrutivo(forro)
      }
    };
  }

  mesclarBriefingEstruturado(briefing: unknown, resumo: ResumoEstruturalMapa | null): Record<string, any> {
    const base = briefing && typeof briefing === 'object' && !Array.isArray(briefing)
      ? { ...(briefing as Record<string, any>) }
      : {};

    if (!resumo) return base;

    return {
      ...base,
      dadosEstruturaisMapa: resumo
    };
  }

  gerarBlocoTexto(resumo: ResumoEstruturalMapa | null): string {
    if (!resumo) return '';

    const linhas = [
      TITULO_BLOCO_MAPA,
      `Fonte: Prefeitura/MAPA de Goiânia.`,
      `Edifício: ${resumo.nomeEdificio}.`,
      `Código do edifício na prefeitura: ${resumo.codigoEdificio}.`,
      `Total de unidades identificadas: ${resumo.totalUnidades}.`,
      resumo.numeroPavimentos ? `Pavimentos: ${resumo.numeroPavimentos}.` : null,
      resumo.numeroElevadores ? `Elevadores: ${resumo.numeroElevadores}.` : null,
      resumo.vagasCobertas ? `Vagas cobertas: ${resumo.vagasCobertas}.` : null,
      resumo.vagasDescobertas ? `Vagas descobertas: ${resumo.vagasDescobertas}.` : null,
      resumo.numeroGaragens ? `Garagens: ${resumo.numeroGaragens}.` : null,
      resumo.areaTerreno ? `Área do terreno: ${resumo.areaTerreno} m².` : null,
      resumo.areaEdificada ? `Área edificada estimada: ${resumo.areaEdificada} m².` : null,
      resumo.latitude && resumo.longitude ? `Geolocalização: ${resumo.latitude}, ${resumo.longitude}.` : null,
      resumo.descricoes.tipoEdificacao1 ? `Tipo predominante: ${resumo.descricoes.tipoEdificacao1}.` : null,
      resumo.estrutura ? `Estrutura: ${resumo.descricoes.estrutura}.` : null,
      resumo.esquadrias ? `Esquadrias: ${resumo.descricoes.esquadrias}.` : null,
      resumo.piso ? `Piso: ${resumo.descricoes.piso}.` : null,
      resumo.forro ? `Forro: ${resumo.descricoes.forro}.` : null,
    ].filter(Boolean);

    return linhas.join('\n');
  }

  anexarBlocoTexto(briefingCompleto: string | null | undefined, resumo: ResumoEstruturalMapa | null): string | undefined {
    if (!resumo) return briefingCompleto || undefined;

    const textoHumano = (briefingCompleto || '').replace(BLOCO_MAPA_REGEX, '').trim();
    const blocoMapa = this.gerarBlocoTexto(resumo);

    return [textoHumano, blocoMapa].filter(Boolean).join('\n\n');
  }
}

export const resumoEstruturalEmpreendimento = new ResumoEstruturalEmpreendimentoService();
