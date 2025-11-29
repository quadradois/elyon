import axios from 'axios';
import { prisma } from '../servidor';

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

interface BuscaParams {
  nmedificio?: string;
  nmbairro?: string;
  nmlogradou?: string;
  nrinscr?: string;
}

export class MapaService {
  async buscarImoveis(params: BuscaParams) {
    const whereClauses: string[] = [];

    if (params.nrinscr) {
      const iptuLimpo = params.nrinscr.replace(/[^0-9]/g, '');
      whereClauses.push(`nrinscr = '${iptuLimpo}'`);
    }

    if (params.nmedificio) {
      whereClauses.push(`nmedificio LIKE '%${params.nmedificio.toUpperCase()}%'`);
    }

    if (params.nmbairro) {
      whereClauses.push(`nmbairro LIKE '%${params.nmbairro.toUpperCase()}%'`);
    }

    if (params.nmlogradou) {
      whereClauses.push(`nmlogradou LIKE '%${params.nmlogradou.toUpperCase()}%'`);
    }

    // Se não houver filtros, não busca nada para evitar carga excessiva
    if (whereClauses.length === 0) {
      return [];
    }

    const where = whereClauses.join(' AND ');

    // 1. Tentar API Externa primeiro (para garantir dados atualizados e popular cache)
    console.log('[MapaService] Buscando na API externa...');
    try {
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: where,
          outFields: 'nrinscr,nmedificio,nmbairro,nmlogradou,incompl',
          returnGeometry: false,
          f: 'json'
        }
      });

      if (response.data.error) {
        throw new Error(`Erro na API do Mapa: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      const resultados = features.map((f: any) => f.attributes);

      // 2. Salvar no Cache (Background)
      this.salvarNoCache(resultados).catch(err => 
        console.error('[MapaService] Erro ao salvar cache:', err)
      );

      return resultados;
    } catch (error) {
      console.error('Erro na API oficial:', error);
      console.log('⚠️ API instável ou bloqueada. Tentando Cache Local...');

      // 3. Fallback: Busca no Cache Local
      const doCache = await this.buscarNoCache(params);
      if (doCache.length > 0) {
        console.log(`[MapaService] Recuperado do cache: ${doCache.length} registros`);
        return doCache;
      }

      // 4. Fallback Final: Mock
      console.log('⚠️ Cache vazio. Usando Mock.');
      return this.mockBuscarImoveis(params);
    }
  }

  private async buscarNoCache(params: BuscaParams) {
    const whereLocal: any = {};
    
    if (params.nrinscr) {
      whereLocal.inscricaoIptu = params.nrinscr.replace(/[^0-9]/g, '');
    }
    if (params.nmedificio) {
      whereLocal.nomeEdificio = { contains: params.nmedificio.toUpperCase() };
    }
    if (params.nmbairro) {
      whereLocal.bairro = { contains: params.nmbairro.toUpperCase() };
    }
    if (params.nmlogradou) {
      whereLocal.logradouro = { contains: params.nmlogradou.toUpperCase() };
    }

    if (Object.keys(whereLocal).length === 0) return [];

    const imoveisLocais = await prisma.imovel.findMany({
      where: whereLocal,
      take: 1000
    });

    return imoveisLocais.map((i: any) => ({
      nrinscr: i.inscricaoIptu,
      nmedificio: i.nomeEdificio || '',
      nmbairro: i.bairro,
      nmlogradou: i.logradouro,
      incompl: i.complemento || ''
    }));
  }

  // Método auxiliar para salvar resultados no banco
  private async salvarNoCache(resultados: any[]) {
    if (resultados.length === 0) return;
    console.log(`[MapaService] Salvando ${resultados.length} imóveis no cache...`);
    
    for (const r of resultados) {
      if (!r.nrinscr) continue;
      
      await prisma.imovel.upsert({
        where: { inscricaoIptu: r.nrinscr },
        update: {
          nomeEdificio: r.nmedificio,
          bairro: r.nmbairro,
          logradouro: r.nmlogradou,
          complemento: r.incompl
        },
        create: {
          inscricaoIptu: r.nrinscr,
          nomeEdificio: r.nmedificio,
          bairro: r.nmbairro || 'Desconhecido',
          logradouro: r.nmlogradou || 'Desconhecido',
          complemento: r.incompl,
          statusCaptacao: 'IDENTIFICADO' // Apenas identificado, ainda não é lead
        }
      });
    }
    console.log('[MapaService] Cache atualizado com sucesso.');
  }

  private mockBuscarImoveis(params: BuscaParams) {
    // Retorna dados simulados se a API falhar
    if (params.nrinscr) {
      return [{
        nrinscr: params.nrinscr,
        nmedificio: 'EDIFICIO MOCK RESIDENCE',
        nmbairro: 'SETOR BUENO',
        nmlogradou: 'AVENIDA T 63',
        incompl: 'APTO 1001'
      }];
    }

    if (params.nmedificio) {
      return Array.from({ length: 5 }).map((_, i) => ({
        nrinscr: `323137029600${10 + i}`,
        nmedificio: params.nmedificio?.toUpperCase(),
        nmbairro: 'SETOR OESTE',
        nmlogradou: 'RUA 9',
        incompl: `APTO ${100 + i}`
      }));
    }

    return [];
  }
}

export const mapaService = new MapaService();
