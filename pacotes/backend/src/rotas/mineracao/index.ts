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
import processamentoRotas from './processamento.rotas';

const router = Router();

// Rotas de busca (hierárquica, unificada, condomínios, endereço)
router.use('/', buscaRotas);

// Rotas de processamento (scraper, enriquecimento, persistência)
router.use('/', processamentoRotas);

export default router;
