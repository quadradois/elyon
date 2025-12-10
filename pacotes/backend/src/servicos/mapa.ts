import axios from 'axios';
import { prisma } from '../lib/db';

const MAPA_API_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';

interface BuscaParams {
  nmedificio?: string;
  nmbairro?: string;
  nmlogradou?: string;
  nrinscr?: string;
}

interface Bairro {
  codigo: number;
  nome: string;
}

interface Edificio {
  codigo: number;
  nome: string;
  logradouro: string;
  totalUnidades?: number;
}

interface UnidadeImovel {
  nrinscr: string;
  nmedificio: string;
  incompl: string;
  nmlogradou: string;
  nmbairro: string;
  areaedif?: number;
  cdedificio?: number;
}

export class MapaService {
  
  // ============================================
  // NOVOS MÉTODOS: Busca Hierárquica
  // ============================================

  /**
   * Lista todos os bairros disponíveis na base
   * Ideal para cachear (mudar raramente)
   */
  async listarBairros(): Promise<Bairro[]> {
    console.log('[MapaService] Listando bairros...');
    
    try {
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: '1=1',
          outFields: 'cdbairro,nmbairro',
          returnDistinctValues: true,
          orderByFields: 'nmbairro ASC',
          returnGeometry: false,
          f: 'json'
        },
        timeout: 15000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      const bairros = features
        .map((f: any) => ({
          codigo: f.attributes.cdbairro,
          nome: f.attributes.nmbairro
        }))
        .filter((b: Bairro) => b.codigo && b.nome); // Remove nulos

      console.log(`[MapaService] ${bairros.length} bairros encontrados`);
      return bairros;

    } catch (error) {
      console.error('[MapaService] Erro ao listar bairros:', error);
      // Fallback: bairros mais comuns de Goiânia
      return this.mockBairros();
    }
  }

  /**
   * Lista todos os edifícios de um bairro específico
   * Implementa cache-first strategy
   */
  async listarEdificiosPorBairro(cdbairro: number): Promise<Edificio[]> {
    console.log(`[MapaService] Listando edifícios do bairro ${cdbairro}...`);
    
    // 1. Tentar cache primeiro
    const doCache = await this.buscarEdificiosDoBairroNoCache(cdbairro);
    if (doCache.length > 0) {
      console.log(`[MapaService] ✅ ${doCache.length} edifícios do cache (bairro ${cdbairro})`);
      return doCache;
    }
    
    // 2. Tentar API externa
    try {
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: `cdbairro = ${cdbairro} AND cdedificio IS NOT NULL AND nmedificio IS NOT NULL`,
          outFields: 'cdedificio,nmedificio,nmlogradou',
          returnDistinctValues: true,
          orderByFields: 'nmedificio ASC',
          returnGeometry: false,
          f: 'json'
        },
        timeout: 15000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      
      // Agrupar para contar unidades por edifício
      const edificiosMap = new Map<number, Edificio>();
      
      for (const f of features) {
        const codigo = f.attributes.cdedificio;
        if (!edificiosMap.has(codigo)) {
          edificiosMap.set(codigo, {
            codigo,
            nome: f.attributes.nmedificio,
            logradouro: f.attributes.nmlogradou || '',
            totalUnidades: 1
          });
        } else {
          edificiosMap.get(codigo)!.totalUnidades!++;
        }
      }

      const edificios = Array.from(edificiosMap.values());
      console.log(`[MapaService] ✅ ${edificios.length} edifícios da API (bairro ${cdbairro})`);
      
      return edificios;

    } catch (error) {
      console.error('[MapaService] ❌ Erro ao listar edifícios:', error);
      console.log('[MapaService] API indisponível - retornando lista vazia');
      return [];
    }
  }

  /**
   * Busca edifícios de um bairro no cache local
   */
  private async buscarEdificiosDoBairroNoCache(cdbairro: number): Promise<Edificio[]> {
    try {
      // Primeiro precisamos descobrir o nome do bairro pelo código
      // Por enquanto, retornamos vazio pois não temos cdbairro no cache
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Busca todas as unidades de um edifício específico (com paginação)
   * Suporta busca por cdedificio OU por nome do edifício (para cache)
   */
  async buscarUnidadesPorEdificio(
    cdedificio: number, 
    offset: number = 0, 
    limit: number = 500,
    nomeEdificio?: string // Novo parâmetro opcional para buscar por nome
  ): Promise<{ unidades: UnidadeImovel[]; total: number; hasMore: boolean }> {
    console.log(`[MapaService] Buscando unidades do edifício ${cdedificio} (offset: ${offset}, limit: ${limit})...`);
    
    // 1. PRIMEIRO: Se temos nome do edifício, tentar buscar no cache local
    if (nomeEdificio) {
      const doCache = await this.buscarUnidadesNoCache(nomeEdificio, offset, limit);
      if (doCache.unidades.length > 0) {
        console.log(`[MapaService] ✅ ${doCache.unidades.length} unidades encontradas no CACHE (${nomeEdificio})`);
        return doCache;
      }
    }
    
    // 2. Tentar API externa
    try {
      // Primeiro, contar total de registros
      const countResponse = await axios.get(MAPA_API_URL, {
        params: {
          where: `cdedificio = ${cdedificio}`,
          returnCountOnly: true,
          f: 'json'
        },
        timeout: 15000
      });
      
      const total = countResponse.data.count || 0;
      
      // Buscar página atual
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: `cdedificio = ${cdedificio}`,
          outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nmbairro,areaedif,cdedificio',
          orderByFields: 'incompl ASC',
          resultOffset: offset,
          resultRecordCount: limit,
          returnGeometry: false,
          f: 'json'
        },
        timeout: 15000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      const unidades = features.map((f: any) => ({
        nrinscr: f.attributes.nrinscr,
        nmedificio: f.attributes.nmedificio || '',
        incompl: f.attributes.incompl || '',
        nmlogradou: f.attributes.nmlogradou || '',
        nmbairro: f.attributes.nmbairro || '',
        areaedif: f.attributes.areaedif,
        cdedificio: f.attributes.cdedificio
      }));

      const hasMore = (offset + unidades.length) < total;
      console.log(`[MapaService] ${unidades.length} unidades (${offset + 1}-${offset + unidades.length} de ${total})`);
      
      // Salvar no cache em background
      this.salvarNoCache(unidades).catch(err => 
        console.error('[MapaService] Erro ao salvar cache:', err)
      );

      return { unidades, total, hasMore };

    } catch (error) {
      console.error('[MapaService] ❌ Erro na API externa:', error);
      
      // 3. Fallback: Buscar no cache pelo nome do edifício (se tiver)
      if (nomeEdificio) {
        console.log(`[MapaService] Tentando fallback por nome: "${nomeEdificio}"...`);
        const doCache = await this.buscarUnidadesNoCache(nomeEdificio, offset, limit);
        if (doCache.unidades.length > 0) {
          console.log(`[MapaService] ✅ Fallback: ${doCache.unidades.length} unidades do cache`);
          return doCache;
        }
      }
      
      console.log('[MapaService] API indisponível e cache vazio');
      return { unidades: [], total: 0, hasMore: false };
    }
  }

  /**
   * Busca unidades de um edifício no cache local (por nome)
   */
  private async buscarUnidadesNoCache(
    nomeEdificio: string, 
    offset: number = 0, 
    limit: number = 500
  ): Promise<{ unidades: UnidadeImovel[]; total: number; hasMore: boolean }> {
    try {
      // Contar total
      const total = await prisma.imovel.count({
        where: {
          nomeEdificio: {
            contains: nomeEdificio,
            mode: 'insensitive'
          }
        }
      });

      // Buscar unidades
      const imoveisCache = await prisma.imovel.findMany({
        where: {
          nomeEdificio: {
            contains: nomeEdificio,
            mode: 'insensitive'
          }
        },
        skip: offset,
        take: limit,
        orderBy: { complemento: 'asc' }
      });

      const unidades = imoveisCache.map(i => ({
        nrinscr: i.inscricaoIptu,
        nmedificio: i.nomeEdificio || '',
        incompl: i.complemento || '',
        nmlogradou: i.logradouro || '',
        nmbairro: i.bairro || '',
        areaedif: i.areaEdificada || undefined,
        cdedificio: undefined
      }));

      const hasMore = (offset + unidades.length) < total;
      
      return { unidades, total, hasMore };
    } catch (error) {
      console.error('[MapaService] Erro ao buscar unidades no cache:', error);
      return { unidades: [], total: 0, hasMore: false };
    }
  }

  /**
   * Busca edifícios por nome (com retorno do código para seleção precisa)
   * Implementa cache-first: tenta cache local primeiro, depois API externa
   */
  async buscarEdificiosPorNome(termo: string, limite: number = 20): Promise<Edificio[]> {
    console.log(`[MapaService] Buscando edifícios por nome: "${termo}"...`);
    
    // 1. PRIMEIRO: Tentar buscar no cache local
    const doCache = await this.buscarEdificiosNoCache(termo, limite);
    if (doCache.length > 0) {
      console.log(`[MapaService] ✅ ${doCache.length} edifícios encontrados no CACHE`);
      // Tentar atualizar cache em background (não bloqueia)
      this.atualizarCacheEdificiosBackground(termo, limite).catch(() => {});
      return doCache;
    }
    
    // 2. Se cache vazio, tentar API externa
    console.log(`[MapaService] Cache vazio, tentando API externa...`);
    
    try {
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: `nmedificio LIKE '%${termo.toUpperCase()}%' AND cdedificio IS NOT NULL`,
          outFields: 'cdedificio,nmedificio,nmlogradou,nmbairro',
          returnDistinctValues: true,
          orderByFields: 'nmedificio ASC',
          resultRecordCount: limite,
          returnGeometry: false,
          f: 'json'
        },
        timeout: 15000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      
      // Agrupar por cdedificio para evitar duplicatas
      const edificiosMap = new Map<number, Edificio>();
      
      for (const f of features) {
        const codigo = f.attributes.cdedificio;
        if (!edificiosMap.has(codigo)) {
          edificiosMap.set(codigo, {
            codigo,
            nome: f.attributes.nmedificio,
            logradouro: `${f.attributes.nmlogradou || ''} - ${f.attributes.nmbairro || ''}`
          });
        }
      }

      const edificios = Array.from(edificiosMap.values());
      console.log(`[MapaService] ✅ ${edificios.length} edifícios encontrados na API`);
      
      // Salvar no cache para próximas buscas
      this.salvarEdificiosNoCache(edificios, termo).catch(err => 
        console.error('[MapaService] Erro ao salvar cache de edifícios:', err)
      );
      
      return edificios;

    } catch (error) {
      console.error('[MapaService] ❌ Erro na API externa:', error);
      console.log('[MapaService] API indisponível e cache vazio - retornando mock');
      
      // 3. Fallback Final: Mock de edifícios conhecidos
      return this.mockEdificiosPorNome(termo);
    }
  }

  /**
   * Busca edifícios no cache local (tabela Imovel)
   */
  private async buscarEdificiosNoCache(termo: string, limite: number): Promise<Edificio[]> {
    try {
      const imoveisCache = await prisma.imovel.findMany({
        where: {
          nomeEdificio: {
            contains: termo.toUpperCase(),
            mode: 'insensitive'
          }
        },
        select: {
          nomeEdificio: true,
          logradouro: true,
          bairro: true
        },
        distinct: ['nomeEdificio'],
        take: limite
      });

      // Converter para formato Edificio
      // Como não temos cdedificio no cache, geramos um hash do nome
      return imoveisCache
        .filter(i => i.nomeEdificio)
        .map((i, index) => ({
          codigo: this.hashString(i.nomeEdificio || '') + index,
          nome: i.nomeEdificio || '',
          logradouro: `${i.logradouro || ''} - ${i.bairro || ''}`
        }));
    } catch (error) {
      console.error('[MapaService] Erro ao buscar cache de edifícios:', error);
      return [];
    }
  }

  /**
   * Gera hash numérico de uma string (para simular cdedificio)
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Salva edifícios encontrados no cache
   */
  private async salvarEdificiosNoCache(edificios: Edificio[], termo: string): Promise<void> {
    // Os edifícios são salvos indiretamente quando buscamos unidades
    // Por enquanto, apenas logamos
    console.log(`[MapaService] ${edificios.length} edifícios prontos para cache (termo: "${termo}")`);
  }

  /**
   * Atualiza cache em background (não bloqueia a resposta)
   */
  private async atualizarCacheEdificiosBackground(termo: string, limite: number): Promise<void> {
    try {
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: `nmedificio LIKE '%${termo.toUpperCase()}%' AND cdedificio IS NOT NULL`,
          outFields: 'cdedificio,nmedificio,nmlogradou,nmbairro,nrinscr,incompl',
          returnDistinctValues: false,
          resultRecordCount: 500,
          returnGeometry: false,
          f: 'json'
        },
        timeout: 30000
      });

      if (response.data.features) {
        const imoveis = response.data.features.map((f: any) => ({
          nrinscr: f.attributes.nrinscr,
          nmedificio: f.attributes.nmedificio,
          nmbairro: f.attributes.nmbairro,
          nmlogradou: f.attributes.nmlogradou,
          incompl: f.attributes.incompl
        }));
        
        await this.salvarNoCache(imoveis);
        console.log(`[MapaService] Cache atualizado em background: ${imoveis.length} imóveis`);
      }
    } catch (error) {
      // Silencioso - não bloqueia o fluxo principal
    }
  }

  /**
   * Mock de edifícios conhecidos para fallback
   */
  private mockEdificiosPorNome(termo: string): Edificio[] {
    const edificiosConhecidos = [
      { codigo: 90001, nome: 'RESERVA BURITI', logradouro: 'RUA 1041 - SETOR PEDRO LUDOVICO' },
      { codigo: 90002, nome: 'RESERVA PARQUE CASCAVEL', logradouro: 'AV. CIRCULAR - JARDIM ATLÂNTICO' },
      { codigo: 90003, nome: 'MANHATTAN BUSINESS', logradouro: 'AV. T-63 - SETOR BUENO' },
      { codigo: 90004, nome: 'MANHATTAN RESIDENCE', logradouro: 'AV. T-4 - SETOR BUENO' },
      { codigo: 90005, nome: 'ILHAS GREGAS', logradouro: 'RUA 9 - SETOR OESTE' },
      { codigo: 90006, nome: 'PORTAL DO SOL', logradouro: 'AV. MUTIRÃO - SETOR BUENO' },
      { codigo: 90007, nome: 'JARDINS FLORENÇA', logradouro: 'AL. BOTAFOGO - JARDIM GOIÁS' },
      { codigo: 90008, nome: 'ALPHAVILLE FLAMBOYANT', logradouro: 'ALPHAVILLE GOIÁS' },
      { codigo: 90009, nome: 'GRAN VILLAGE', logradouro: 'AV. ARAGUAIA - SETOR SUL' },
      { codigo: 90010, nome: 'LIVING PARK', logradouro: 'RUA 22 - SETOR OESTE' },
    ];
    
    const termoUpper = termo.toUpperCase();
    return edificiosConhecidos.filter(e => 
      e.nome.includes(termoUpper) || termoUpper.includes(e.nome.split(' ')[0])
    );
  }

  // ============================================
  // MÉTODOS: Condomínios Horizontais (Casas)
  // ============================================

  /**
   * Busca condomínios horizontais pelo nome
   * Condomínios horizontais são cadastrados como BAIRROS na base
   * Ex: "JARDINS FLORENÇA", "JD MADRI", "ALPHAVILLE GOIÁS"
   * 
   * @param termo - Termo de busca
   * @param limite - Máximo de resultados (default: 50)
   */
  async buscarCondominiosHorizontais(termo: string, limite: number = 50): Promise<Bairro[]> {
    console.log(`[MapaService] Buscando condomínios horizontais: "${termo}" (limite: ${limite})...`);
    
    try {
      // Buscar bairros que contêm o termo - sem limite na API para pegar todos
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: `nmbairro LIKE '%${termo.toUpperCase()}%'`,
          outFields: 'cdbairro,nmbairro',
          returnDistinctValues: true,
          orderByFields: 'nmbairro ASC',
          resultRecordCount: 2000, // Aumentar para pegar mais resultados
          returnGeometry: false,
          f: 'json'
        },
        timeout: 30000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      console.log(`[MapaService] API retornou ${features.length} bairros contendo "${termo}"`);
      
      // Remover duplicatas
      const bairrosMap = new Map<number, Bairro>();
      
      // Prefixos/padrões comuns de condomínios horizontais
      const padroesCondominio = [
        'JARDINS', 'JARDIM', 'JD ', 'JD.', 
        'ALPHAVILLE', 'ALDEIA', 'PORTAL', 
        'RESIDENCIAL', 'RES ', 'RES.', 
        'COND ', 'COND.', 'CONDOMINIO', 'CONDOMÍNIO',
        'VILLAGE', 'RESERVA', 'GRANVILLE', 
        'GOIANIA GOLF', 'GOIÂNIA GOLF',
        'ALTO DA BOA VISTA', 'PARQUE'
      ];
      
      // Bairros tradicionais que NÃO são condomínios horizontais
      const bairrosTradicionais = [
        'SETOR', 'CENTRO', 'VILA', 'BAIRRO', 'CONJUNTO', 'NUCLEO'
      ];
      
      for (const f of features) {
        const codigo = f.attributes.cdbairro;
        const nome = f.attributes.nmbairro?.trim()?.toUpperCase() || '';
        
        if (!codigo || bairrosMap.has(codigo)) continue;
        
        // Verificar se é bairro tradicional (NÃO incluir)
        const ehBairroTradicional = bairrosTradicionais.some(p => nome.startsWith(p));
        
        // Verificar se parece ser um condomínio horizontal
        const pareceCondominio = padroesCondominio.some(p => nome.includes(p));
        
        // Incluir se:
        // 1. Parece condomínio E não é bairro tradicional
        // 2. OU nome começa exatamente com o termo buscado (ex: buscar "florença" → "FLORENÇA RESIDENCE")
        if ((pareceCondominio && !ehBairroTradicional) || nome.startsWith(termo.toUpperCase())) {
          bairrosMap.set(codigo, {
            codigo,
            nome: f.attributes.nmbairro?.trim() || ''
          });
        }
      }

      // Ordenar por relevância: começa com o termo primeiro
      let bairros = Array.from(bairrosMap.values());
      bairros.sort((a, b) => {
        const aStartsWith = a.nome.toUpperCase().startsWith(termo.toUpperCase());
        const bStartsWith = b.nome.toUpperCase().startsWith(termo.toUpperCase());
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.nome.localeCompare(b.nome);
      });
      
      // Aplicar limite
      bairros = bairros.slice(0, limite);
      
      console.log(`[MapaService] ${bairros.length} condomínios horizontais encontrados (de ${features.length} bairros na API)`);
      
      return bairros;

    } catch (error) {
      console.error('[MapaService] Erro ao buscar condomínios:', error);
      return [];
    }
  }

  /**
   * Lista TODAS as casas/lotes de um condomínio horizontal (bairro)
   * Busca automaticamente todas as páginas da API
   */
  async listarTodasCasasPorCondominio(cdbairro: number): Promise<{ casas: any[]; total: number }> {
    console.log(`[MapaService] Buscando TODAS as casas do condomínio ${cdbairro}...`);
    
    try {
      // Primeiro, contar total de registros
      const countResponse = await axios.get(MAPA_API_URL, {
        params: {
          where: `cdbairro = ${cdbairro}`,
          returnCountOnly: true,
          f: 'json'
        },
        timeout: 30000
      });
      
      const total = countResponse.data.count || 0;
      console.log(`[MapaService] Total de casas no condomínio: ${total}`);
      
      if (total === 0) {
        return { casas: [], total: 0 };
      }

      // Buscar em lotes de 1000 registros (limite seguro da API ArcGIS)
      const BATCH_SIZE = 1000;
      const todasCasas: any[] = [];
      let offset = 0;
      
      while (offset < total) {
        console.log(`[MapaService] Buscando lote ${offset}-${offset + BATCH_SIZE} de ${total}...`);
        
        const response = await axios.get(MAPA_API_URL, {
          params: {
            where: `cdbairro = ${cdbairro}`,
            outFields: 'nrinscr,nmlogradou,nmbairro,areaterr,areaedif,incompl,nrimovel,nrquadra,nrlote',
            orderByFields: 'nrquadra ASC, nrlote ASC',
            resultOffset: offset,
            resultRecordCount: BATCH_SIZE,
            returnGeometry: false,
            f: 'json'
          },
          timeout: 60000 // Timeout maior para grandes volumes
        });

        if (response.data.error) {
          throw new Error(`Erro na API: ${response.data.error.message}`);
        }

        const features = response.data.features || [];
        
        for (const f of features) {
          todasCasas.push({
            nrinscr: f.attributes.nrinscr,
            nmedificio: '', // Casas não têm nome de edifício
            incompl: f.attributes.nrimovel || f.attributes.incompl || '',
            nmlogradou: f.attributes.nmlogradou?.trim() || '',
            nmbairro: f.attributes.nmbairro?.trim() || '',
            areaedif: f.attributes.areaedif || 0,
            areaterr: f.attributes.areaterr || 0,
            nrquadra: f.attributes.nrquadra?.trim() || '',
            nrlote: f.attributes.nrlote?.trim() || ''
          });
        }
        
        offset += BATCH_SIZE;
        
        // Se recebeu menos que o batch, acabou
        if (features.length < BATCH_SIZE) break;
      }

      console.log(`[MapaService] Total carregado: ${todasCasas.length} casas`);
      
      // Salvar no cache em background
      this.salvarNoCache(todasCasas).catch(err => 
        console.error('[MapaService] Erro ao salvar cache:', err)
      );

      return { casas: todasCasas, total: todasCasas.length };

    } catch (error) {
      console.error('[MapaService] Erro ao listar todas as casas:', error);
      return { casas: [], total: 0 };
    }
  }

  /**
   * Lista casas/lotes de um condomínio horizontal (bairro) - com paginação manual
   * @deprecated Usar listarTodasCasasPorCondominio para buscar todas de uma vez
   */
  async listarCasasPorCondominio(
    cdbairro: number,
    offset: number = 0,
    limit: number = 500
  ): Promise<{ casas: any[]; total: number; hasMore: boolean }> {
    console.log(`[MapaService] Listando casas do condomínio ${cdbairro} (offset: ${offset}, limit: ${limit})...`);
    
    try {
      // Primeiro, contar total de registros
      const countResponse = await axios.get(MAPA_API_URL, {
        params: {
          where: `cdbairro = ${cdbairro}`,
          returnCountOnly: true,
          f: 'json'
        },
        timeout: 30000
      });
      
      const total = countResponse.data.count || 0;
      
      // Buscar página atual
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: `cdbairro = ${cdbairro}`,
          outFields: 'nrinscr,nmlogradou,nmbairro,areaterr,areaedif,incompl,nrimovel,nrquadra,nrlote',
          orderByFields: 'nrquadra ASC, nrlote ASC',
          resultOffset: offset,
          resultRecordCount: limit,
          returnGeometry: false,
          f: 'json'
        },
        timeout: 30000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      const casas = features.map((f: any) => ({
        nrinscr: f.attributes.nrinscr,
        nmedificio: '', // Casas não têm nome de edifício
        incompl: f.attributes.nrimovel || f.attributes.incompl || '',
        nmlogradou: f.attributes.nmlogradou?.trim() || '',
        nmbairro: f.attributes.nmbairro?.trim() || '',
        areaedif: f.attributes.areaedif || 0,
        areaterr: f.attributes.areaterr || 0,
        nrquadra: f.attributes.nrquadra?.trim() || '',
        nrlote: f.attributes.nrlote?.trim() || ''
      }));

      const hasMore = (offset + casas.length) < total;
      console.log(`[MapaService] ${casas.length} casas (${offset + 1}-${offset + casas.length} de ${total})`);
      
      // Salvar no cache em background
      this.salvarNoCache(casas).catch(err => 
        console.error('[MapaService] Erro ao salvar cache:', err)
      );

      return { casas, total, hasMore };

    } catch (error) {
      console.error('[MapaService] Erro ao listar casas:', error);
      return { casas: [], total: 0, hasMore: false };
    }
  }

  // ============================================
  // MÉTODO: Busca por Endereço
  // ============================================

  /**
   * Busca imóveis por endereço (rua/avenida + número opcional)
   * Ideal para encontrar casas avulsas ou imóveis específicos
   * @param endereco - Nome da rua/avenida (ex: "Alameda dos Buritis", "T-63", "Rua 85")
   * @param numero - Número do imóvel (opcional)
   * @param limite - Máximo de resultados
   */
  async buscarPorEndereco(
    endereco: string,
    numero?: string,
    limite: number = 50
  ): Promise<any[]> {
    console.log(`[MapaService] Buscando por endereço: "${endereco}" ${numero ? `Nº ${numero}` : ''}...`);
    
    try {
      // Construir cláusula WHERE
      const whereClauses: string[] = [];
      
      // Busca pelo logradouro (nome da rua)
      const enderecoLimpo = endereco.toUpperCase().trim();
      whereClauses.push(`nmlogradou LIKE '%${enderecoLimpo}%'`);
      
      // Se tiver número, adiciona filtro
      if (numero) {
        const numeroLimpo = numero.trim();
        whereClauses.push(`nrimovel LIKE '%${numeroLimpo}%'`);
      }
      
      const response = await axios.get(MAPA_API_URL, {
        params: {
          where: whereClauses.join(' AND '),
          outFields: 'nrinscr,nmedificio,incompl,nmlogradou,nrimovel,nmbairro,areaedif,areaterr,cdedificio',
          orderByFields: 'nmlogradou ASC, nrimovel ASC',
          resultRecordCount: limite,
          returnGeometry: false,
          f: 'json'
        },
        timeout: 30000
      });

      if (response.data.error) {
        throw new Error(`Erro na API: ${response.data.error.message}`);
      }

      const features = response.data.features || [];
      const imoveis = features.map((f: any) => ({
        nrinscr: f.attributes.nrinscr,
        nmedificio: f.attributes.nmedificio?.trim() || '',
        incompl: f.attributes.incompl?.trim() || '',
        nmlogradou: f.attributes.nmlogradou?.trim() || '',
        nrimovel: f.attributes.nrimovel?.trim() || '',
        nmbairro: f.attributes.nmbairro?.trim() || '',
        areaedif: f.attributes.areaedif || 0,
        areaterr: f.attributes.areaterr || 0,
        cdedificio: f.attributes.cdedificio || null,
        // Flag para indicar se é casa (sem edifício) ou apartamento
        tipo: f.attributes.nmedificio ? 'apartamento' : 'casa'
      }));

      console.log(`[MapaService] ${imoveis.length} imóveis encontrados`);
      
      // Salvar no cache em background
      this.salvarNoCache(imoveis).catch(err => 
        console.error('[MapaService] Erro ao salvar cache:', err)
      );

      return imoveis;

    } catch (error) {
      console.error('[MapaService] Erro ao buscar por endereço:', error);
      return [];
    }
  }

  // Mock de bairros para fallback
  private mockBairros(): Bairro[] {
    return [
      { codigo: 1, nome: 'SETOR BUENO' },
      { codigo: 2, nome: 'SETOR OESTE' },
      { codigo: 3, nome: 'SETOR MARISTA' },
      { codigo: 4, nome: 'JARDIM GOIÁS' },
      { codigo: 5, nome: 'SETOR SUL' },
      { codigo: 6, nome: 'ALTO DA GLÓRIA' },
      { codigo: 7, nome: 'SETOR CENTRAL' },
      { codigo: 8, nome: 'PARQUE AMAZÔNIA' },
      { codigo: 9, nome: 'JARDIM AMÉRICA' },
      { codigo: 10, nome: 'SETOR PEDRO LUDOVICO' },
    ];
  }

  // ============================================
  // MÉTODOS LEGADOS (mantidos para compatibilidade)
  // ============================================

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
