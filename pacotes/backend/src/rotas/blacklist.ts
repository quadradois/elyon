/**
 * Rotas de Blacklist de Telefones
 * 
 * Endpoints para gerenciar telefones bloqueados
 */

import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { z } from 'zod';
import { blacklistService } from '../servicos/blacklist';

const router = Router();

/**
 * GET /api/blacklist
 * Lista telefones na blacklist
 */
router.get('/', async (req, res) => {
  try {
    const { pagina = '1', limite = '50', busca, motivo } = req.query;
    const tenantId = req.tenantId as string;

    const resultado = await blacklistService.listar(
      tenantId,
      parseInt(pagina as string),
      parseInt(limite as string),
      busca as string | undefined,
      motivo as string | undefined
    );

    return res.json(resultado);
  } catch (error: any) {
    console.error('[Blacklist] Erro ao listar:', error);
    return responderErro(res, 500, 'Erro ao listar blacklist');
  }
});

/**
 * GET /api/blacklist/estatisticas
 * Estatísticas da blacklist por motivo
 */
router.get('/estatisticas', async (req, res) => {
  try {
    const tenantId = req.tenantId as string;

    const contagens = await blacklistService.contarPorMotivo(tenantId);

    const total = Object.values(contagens).reduce((a, b) => a + b, 0);

    return res.json({
      total,
      porMotivo: contagens
    });
  } catch (error: any) {
    console.error('[Blacklist] Erro ao buscar estatísticas:', error);
    return responderErro(res, 500, 'Erro ao buscar estatísticas');
  }
});

/**
 * GET /api/blacklist/verificar/:telefone
 * Verifica se um telefone está na blacklist
 */
router.get('/verificar/:telefone', async (req, res) => {
  try {
    const { telefone } = req.params;
    const tenantId = req.tenantId as string;

    const bloqueado = await blacklistService.estaBlacklist(telefone, tenantId);

    return res.json({
      telefone,
      bloqueado
    });
  } catch (error: any) {
    console.error('[Blacklist] Erro ao verificar:', error);
    return responderErro(res, 500, 'Erro ao verificar telefone');
  }
});

/**
 * POST /api/blacklist
 * Adiciona telefone à blacklist
 */
router.post('/', async (req, res) => {
  try {
    const schema = z.object({
      telefone: z.string().min(8, 'Telefone inválido'),
      motivo: z.enum(['OPTOUT', 'INVALIDO', 'RECLAMACAO', 'BLOQUEADO_WHATSAPP', 'MANUAL', 'CONTATO_PESSOAL']),
      tenantId: z.string().optional(),
      nomeContato: z.string().optional(),
      campanhaOrigem: z.string().optional(),
      observacoes: z.string().optional()
    });

    const dados = schema.parse(req.body);

    await blacklistService.adicionar({ ...dados, tenantId: req.tenantId });

    return res.json({
      sucesso: true,
      mensagem: 'Telefone adicionado à blacklist'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
    }
    console.error('[Blacklist] Erro ao adicionar:', error);
    return responderErro(res, 500, 'Erro ao adicionar à blacklist');
  }
});

/**
 * POST /api/blacklist/lote
 * Adiciona múltiplos telefones à blacklist
 */
router.post('/lote', async (req, res) => {
  try {
    const schema = z.object({
      telefones: z.array(z.string().min(8)),
      motivo: z.enum(['OPTOUT', 'INVALIDO', 'RECLAMACAO', 'BLOQUEADO_WHATSAPP', 'MANUAL', 'CONTATO_PESSOAL']),
      tenantId: z.string().optional(),
      observacoes: z.string().optional()
    });

    const { telefones, motivo, observacoes } = schema.parse(req.body);
    const tenantId = req.tenantId as string;

    let adicionados = 0;
    let erros = 0;

    for (const telefone of telefones) {
      try {
        await blacklistService.adicionar({
          telefone,
          motivo,
          tenantId,
          observacoes
        });
        adicionados++;
      } catch (e) {
        erros++;
      }
    }

    return res.json({
      sucesso: true,
      adicionados,
      erros,
      total: telefones.length
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
    }
    console.error('[Blacklist] Erro ao adicionar em lote:', error);
    return responderErro(res, 500, 'Erro ao adicionar em lote');
  }
});

/**
 * DELETE /api/blacklist/:telefone
 * Remove telefone da blacklist
 */
router.delete('/:telefone', async (req, res) => {
  try {
    const { telefone } = req.params;
    const tenantId = req.tenantId as string;

    const removido = await blacklistService.remover(telefone, tenantId);

    if (removido) {
      return res.json({
        sucesso: true,
        mensagem: 'Telefone removido da blacklist'
      });
    } else {
      return responderErro(res, 404, 'Telefone não encontrado na blacklist');
    }
  } catch (error: any) {
    console.error('[Blacklist] Erro ao remover:', error);
    return responderErro(res, 500, 'Erro ao remover da blacklist');
  }
});

export default router;
