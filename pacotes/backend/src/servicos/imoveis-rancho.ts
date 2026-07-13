/**
 * Serviço de Consulta — Base Imobiliária GEO360/ICAD (tabela `imoveis_rancho`)
 *
 * Fonte de consulta PRIMÁRIA para identificação de proprietário (Goiânia + Aparecida),
 * importada do portal público GEO360/ICAD. Substitui o scraper da Prefeitura:
 * em vez de raspar o site a cada consulta, lê do nosso banco (instantâneo, sem carga na API).
 *
 * Escopo de dados: imóvel + nome/CPF do proprietário (uso imobiliário). Ver SOP em
 * docs/API GEO 360/SOP_Importacao_Imoveis_Goiania_Aparecida.md
 */

import { prisma } from '../lib/db';
import { parsearEnderecoPrefeitura } from './scraper-iptu';

/** Saída compatível com o contrato do fluxo de mineração (mesmo formato do scraper). */
export interface DadosImovelBase {
  nrinscr: string;
  nome?: string;
  cpf?: string;
  endereco_correspondencia?: string;
  logradouro?: string;
  numero?: string;
  apartamento?: string;
  bloco?: string;
  unidade?: string;
  quadra?: string;
  lote?: string;
  nomeEdificio?: string;
  box?: string;
  tipoImovel?: string;
  areaConstruida?: number;
  areaTerreno?: number;
  valorVenal?: number; // não disponível na base GEO360 (mantido p/ compatibilidade com o scraper)
  anoConstituicao?: number; // idem
  // Extras da base GEO360 (não existiam no scraper)
  cidade?: string;
  bairro?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
  tipoPessoa?: number; // 1 = física, 2 = jurídica
  origem: 'BASE_GEO360';
}

const soDigitos = (v: string) => (v || '').replace(/\D/g, '');

type LinhaRancho = NonNullable<Awaited<ReturnType<typeof prisma.imovelRancho.findUnique>>>;

/** Converte uma linha da tabela no formato esperado pelo fluxo de mineração. */
function mapear(row: LinhaRancho): DadosImovelBase {
  // Reaproveita o parser de endereço da Prefeitura sobre o complemento/endereço
  const baseEndereco = [row.logradouro, row.complemento].filter(Boolean).join(' ');
  const parsed = parsearEnderecoPrefeitura(baseEndereco || row.endereco || '');

  return {
    nrinscr: row.inscricaoCartografica,
    nome: row.nomePessoa ?? undefined,
    cpf: row.cpfCnpj ?? undefined,
    endereco_correspondencia: row.endereco ?? undefined,
    logradouro: row.logradouro ?? parsed.logradouro,
    numero: parsed.numero,
    apartamento: parsed.apartamento,
    bloco: parsed.bloco,
    unidade: parsed.unidade,
    quadra: parsed.quadra,
    lote: parsed.lote ?? row.nrLote ?? undefined,
    nomeEdificio: parsed.nomeEdificio,
    box: parsed.box,
    tipoImovel: row.tipoEdificacao != null ? String(row.tipoEdificacao) : undefined,
    areaConstruida: row.areaConstruida ?? undefined,
    areaTerreno: row.areaTerreno ?? undefined,
    cidade: row.cidade,
    bairro: row.bairro ?? undefined,
    cep: row.cep ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    tipoPessoa: row.tipoPessoa ?? undefined,
    origem: 'BASE_GEO360',
  };
}

export class ImoveisRanchoService {
  /**
   * Identifica o proprietário de um imóvel pela inscrição cadastral (IPTU).
   * Retorna `null` se não houver imóvel na base (permite fallback ao scraper).
   */
  async consultarProprietario(nrinscr: string): Promise<DadosImovelBase | null> {
    const inscricao = (nrinscr || '').trim();
    if (!inscricao) return null;

    const row = await prisma.imovelRancho.findUnique({
      where: { inscricaoCartografica: inscricao },
    });
    return row ? mapear(row) : null;
  }

  /** Consulta em lote por várias inscrições (otimiza a mineração de muitos imóveis). */
  async consultarVarios(inscricoes: string[]): Promise<Map<string, DadosImovelBase>> {
    const limpas = [...new Set(inscricoes.map((i) => (i || '').trim()).filter(Boolean))];
    if (limpas.length === 0) return new Map();

    const rows = await prisma.imovelRancho.findMany({
      where: { inscricaoCartografica: { in: limpas } },
    });
    return new Map(rows.map((r) => [r.inscricaoCartografica, mapear(r)]));
  }

  /** Lista todos os imóveis de um proprietário (CPF/CNPJ). */
  async buscarPorCpf(cpfCnpj: string): Promise<DadosImovelBase[]> {
    const doc = soDigitos(cpfCnpj);
    if (!doc) return [];
    const rows = await prisma.imovelRancho.findMany({
      where: { cpfCnpj: doc },
      take: 500,
    });
    return rows.map(mapear);
  }

  /** Busca imóveis por bairro (case-insensitive), opcionalmente filtrando por cidade. */
  async buscarPorBairro(bairro: string, cidade?: string, limite = 200): Promise<DadosImovelBase[]> {
    if (!bairro?.trim()) return [];
    const rows = await prisma.imovelRancho.findMany({
      where: {
        bairro: { contains: bairro.trim(), mode: 'insensitive' },
        ...(cidade ? { cidade } : {}),
      },
      take: limite,
    });
    return rows.map(mapear);
  }

  /** Conta imóveis de um setor (e opcionalmente quadra) — útil para dimensionar prospecção. */
  async contarPorSetor(cidade: string, idSetor: number, idQuadra?: number): Promise<number> {
    return prisma.imovelRancho.count({
      where: { cidade, idSetor, ...(idQuadra != null ? { idQuadra } : {}) },
    });
  }
}

export const imoveisRanchoService = new ImoveisRanchoService();
