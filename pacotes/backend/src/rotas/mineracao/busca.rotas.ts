/**
 * Rotas de Busca - Mineração de Imóveis
 * 
 * Responsabilidades:
 * - Busca hierárquica (bairros → edifícios → unidades)
 * - Busca unificada (edifícios + condomínios)
 * - Condomínios horizontais e casas
 * - Busca por endereço
 */

import { Router } from 'express';
import { mapaService } from '../../servicos/mapa';

const router = Router();

// ============================================
// BUSCA HIERÁRQUICA
// ============================================

/**
 * GET /bairros
 * Lista todos os bairros disponíveis para seleção
 */
router.get('/bairros', async (_req, res) => {
  try {
    console.log('[Mineracao] Listando bairros...');
    const bairros = await mapaService.listarBairros();
    
    return res.json({
      total: bairros.length,
      bairros
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao listar bairros:', error);
    return res.status(500).json({ erro: 'Erro ao listar bairros' });
  }
});

/**
 * GET /edificios/:cdbairro
 * Lista todos os edifícios de um bairro específico
 */
router.get('/edificios/:cdbairro', async (req, res) => {
  try {
    const cdbairro = parseInt(req.params.cdbairro);
    
    if (isNaN(cdbairro)) {
      return res.status(400).json({ erro: 'Código do bairro inválido' });
    }

    console.log(`[Mineracao] Listando edifícios do bairro ${cdbairro}...`);
    const edificios = await mapaService.listarEdificiosPorBairro(cdbairro);
    
    return res.json({
      total: edificios.length,
      cdbairro,
      edificios
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao listar edifícios:', error);
    return res.status(500).json({ erro: 'Erro ao listar edifícios' });
  }
});

/**
 * GET /unidades/:cdedificio?offset=0&limit=500&nome=NOME_EDIFICIO
 * Lista todas as unidades de um edifício específico (com paginação)
 */
router.get('/unidades/:cdedificio', async (req, res) => {
  try {
    const cdedificio = parseInt(req.params.cdedificio);
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
    const nomeEdificio = req.query.nome as string | undefined;
    
    if (isNaN(cdedificio)) {
      return res.status(400).json({ erro: 'Código do edifício inválido' });
    }

    console.log(`[Mineracao] Buscando unidades do edifício ${cdedificio} (nome: ${nomeEdificio || 'N/A'}, offset: ${offset}, limit: ${limit})...`);
    const resultado = await mapaService.buscarUnidadesPorEdificio(cdedificio, offset, limit, nomeEdificio);
    
    return res.json({
      total: resultado.total,
      offset,
      limit,
      hasMore: resultado.hasMore,
      cdedificio,
      nomeEdificio: resultado.unidades[0]?.nmedificio || nomeEdificio || '',
      bairro: resultado.unidades[0]?.nmbairro || '',
      unidades: resultado.unidades
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar unidades:', error);
    return res.status(500).json({ erro: 'Erro ao buscar unidades' });
  }
});

/**
 * GET /buscar-edificios?termo=reserva
 * Busca edifícios por nome (autocomplete)
 */
router.get('/buscar-edificios', async (req, res) => {
  try {
    const termo = req.query.termo as string;
    
    if (!termo || termo.length < 2) {
      return res.status(400).json({ erro: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    console.log(`[Mineracao] Buscando edifícios por termo: "${termo}"...`);
    const edificios = await mapaService.buscarEdificiosPorNome(termo);
    
    return res.json({
      total: edificios.length,
      termo,
      edificios
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar edifícios:', error);
    return res.status(500).json({ erro: 'Erro ao buscar edifícios' });
  }
});

// ============================================
// BUSCA UNIFICADA
// ============================================

/**
 * GET /buscar-imoveis?termo=jardins
 * Busca UNIFICADA que retorna tanto edifícios verticais quanto condomínios horizontais
 */
router.get('/buscar-imoveis', async (req, res) => {
  try {
    const termo = req.query.termo as string;
    
    if (!termo || termo.length < 2) {
      return res.status(400).json({ erro: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    console.log(`[Mineracao] Busca unificada por: "${termo}"...`);

    const [edificios, condominios] = await Promise.all([
      mapaService.buscarEdificiosPorNome(termo, 50),
      mapaService.buscarCondominiosHorizontais(termo, 100)
    ]);

    const resultados = [
      ...edificios.map(e => ({
        codigo: e.codigo,
        nome: e.nome,
        bairro: e.logradouro || '',
        tipo: 'edificio' as const,
        icone: '🏢'
      })),
      ...condominios.map(c => ({
        codigo: c.codigo,
        nome: c.nome,
        bairro: c.nome,
        tipo: 'condominio' as const,
        icone: '🏠'
      }))
    ];

    resultados.sort((a, b) => {
      const aStartsWith = a.nome.toUpperCase().startsWith(termo.toUpperCase());
      const bStartsWith = b.nome.toUpperCase().startsWith(termo.toUpperCase());
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.nome.localeCompare(b.nome);
    });

    console.log(`[Mineracao] Encontrados: ${edificios.length} edifícios + ${condominios.length} condomínios`);
    
    return res.json({
      total: resultados.length,
      termo,
      edificios: resultados.filter(r => r.tipo === 'edificio'),
      condominios: resultados.filter(r => r.tipo === 'condominio'),
      resultados
    });
  } catch (error) {
    console.error('[Mineracao] Erro na busca unificada:', error);
    return res.status(500).json({ erro: 'Erro ao buscar imóveis' });
  }
});

// ============================================
// CONDOMÍNIOS HORIZONTAIS (CASAS)
// ============================================

/**
 * GET /condominios?termo=jardins
 * Busca condomínios horizontais pelo nome
 */
router.get('/condominios', async (req, res) => {
  try {
    const termo = req.query.termo as string;
    
    if (!termo || termo.length < 2) {
      return res.status(400).json({ erro: 'Termo de busca deve ter pelo menos 2 caracteres' });
    }

    console.log(`[Mineracao] Buscando condomínios horizontais: "${termo}"...`);
    const condominios = await mapaService.buscarCondominiosHorizontais(termo);
    
    return res.json({
      total: condominios.length,
      termo,
      condominios
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar condomínios:', error);
    return res.status(500).json({ erro: 'Erro ao buscar condomínios' });
  }
});

/**
 * GET /casas/:cdbairro
 * Lista TODAS as casas de um condomínio horizontal
 */
router.get('/casas/:cdbairro', async (req, res) => {
  try {
    const cdbairro = parseInt(req.params.cdbairro);
    
    if (isNaN(cdbairro)) {
      return res.status(400).json({ erro: 'Código do condomínio inválido' });
    }

    console.log(`[Mineracao] Buscando TODAS as casas do condomínio ${cdbairro}...`);
    const resultado = await mapaService.listarTodasCasasPorCondominio(cdbairro);
    
    return res.json({
      total: resultado.total,
      cdbairro,
      nomeCondominio: resultado.casas[0]?.nmbairro || '',
      casas: resultado.casas
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao listar casas:', error);
    return res.status(500).json({ erro: 'Erro ao listar casas' });
  }
});

/**
 * GET /endereco?rua=...&numero=...
 * Busca imóveis por endereço (rua/avenida + número opcional)
 */
router.get('/endereco', async (req, res) => {
  try {
    const rua = req.query.rua as string;
    const numero = req.query.numero as string | undefined;
    
    if (!rua || rua.length < 3) {
      return res.status(400).json({ erro: 'Nome da rua deve ter pelo menos 3 caracteres' });
    }

    console.log(`[Mineracao] Buscando por endereço: "${rua}" ${numero ? `Nº ${numero}` : ''}...`);
    const imoveis = await mapaService.buscarPorEndereco(rua, numero);
    
    const casas = imoveis.filter(i => i.tipo === 'casa');
    const apartamentos = imoveis.filter(i => i.tipo === 'apartamento');
    
    return res.json({
      total: imoveis.length,
      casas: casas.length,
      apartamentos: apartamentos.length,
      rua,
      numero: numero || null,
      imoveis
    });
  } catch (error) {
    console.error('[Mineracao] Erro ao buscar por endereço:', error);
    return res.status(500).json({ erro: 'Erro ao buscar por endereço' });
  }
});

export default router;
