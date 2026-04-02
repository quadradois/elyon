/**
 * Módulo de Campanhas - Agregador de Rotas
 * 
 * Este arquivo monta todas as sub-rotas do módulo de campanhas.
 * Estrutura refatorada para melhor manutenibilidade.
 * 
 * IMPORTANTE: A ordem de registro importa!
 * Rotas com paths fixos devem vir ANTES de rotas com parâmetros dinâmicos.
 * 
 * Arquivos:
 * - disparo.rotas.ts    → Disparo, funil, dashboard (PRIMEIRO - tem rotas fixas)
 * - campanhas.rotas.ts  → CRUD campanhas, CEP, cache
 * - contatos.rotas.ts   → Gestão de contatos, importação
 * - mensagens.rotas.ts  → Chat e histórico
 */

import { Router } from 'express';

// Importar sub-rotas
import campanhasRotas from './campanhas.rotas';
import contatosRotas from './contatos.rotas';
import disparoRotas from './disparo.rotas';
import mensagensRotas from './mensagens.rotas';

const router = Router();

// ============================================
// MONTAR ROTAS - ORDEM IMPORTA!
// ============================================

// 1. Rotas de disparo e dashboard (PRIMEIRO - tem rotas fixas como /funil-prospeccao)
// GET /funil-prospeccao, GET /leads-quentes, GET /avaliacoes-agendadas
// POST /:id/disparar, POST /:id/pausar, POST /:id/reativar
// GET /:id/status-disparo, GET/PUT /:id/config-disparo
router.use('/', disparoRotas);

// 2. Rotas de campanhas (CRUD, CEP, cache)
// GET/POST / , GET/DELETE /:id, PUT /:id/briefing, PATCH /:id/status
// GET /cep/:cep, GET/DELETE /cache-empreendimentos
router.use('/', campanhasRotas);

// 3. Rotas de contatos (importação, vinculação)
// GET /:id/contatos, PATCH /:campanhaId/contatos/:contatoId
// POST /:id/importar-contatos, POST /:id/importar-csv
// POST /:id/vincular-leads-minerados, POST /:id/vincular-leads-banco
// GET /template-csv
router.use('/', contatosRotas);

// 4. Rotas de mensagens e histórico
// GET /contatos/:id, GET /contatos/:id/mensagens, POST /contatos/:id/mensagens
// GET /contatos/:id/historico
router.use('/', mensagensRotas);

export default router;
