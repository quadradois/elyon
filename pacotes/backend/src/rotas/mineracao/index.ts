/**
 * Módulo de Mineração - Agregador de Rotas
 * 
 * Este arquivo monta todas as sub-rotas do módulo de mineração.
 * 
 * Arquivos:
 * - busca.rotas.ts        → Busca hierárquica, unificada, condominios
 * - processamento.rotas.ts → Scraper IPTU, Assertiva, persistência
 */

import { Router } from 'express';

import buscaRotas from './busca.rotas';
import fotosEmpreendimentosRotas from './fotos-empreendimentos.rotas';
import processamentoRotas from './processamento.rotas';
import proprietariosBaseRotas from './proprietarios-base.rotas';
import unidadesLoteRotas from './unidades-lote.rotas';

const router = Router();

// Rotas de busca (hierárquica, unificada, condomínios, endereço)
router.use('/', buscaRotas);

// Identificação em lote pela base local (M2M, Lab Captação+Mineração)
router.use('/', proprietariosBaseRotas);

// Fotos de empreendimentos pela base GEO360 (M2M, Lab Captação+Mineração)
router.use('/', fotosEmpreendimentosRotas);

// Unidades por lote GEO360 — resultado da busca por nome (M2M, Lab Captação)
router.use('/', unidadesLoteRotas);

// Rotas de processamento (scraper, enriquecimento, persistência)
router.use('/', processamentoRotas);

export default router;
