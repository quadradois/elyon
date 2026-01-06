/**
 * Rotas de Blacklist de Telefones
 * 
 * Endpoints para gerenciar telefones bloqueados
 */

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
    const { pagina = '1', limite = '50', tenantId, busca, motivo } = req.query;

    const resultado = await blacklistService.listar(
      tenantId as string,
      parseInt(pagina as string),
      parseInt(limite as string),
      busca as string | undefined,
      motivo as string | undefined
    );

    return res.json(resultado);
  } catch (error: any) {
    console.error('[Blacklist] Erro ao listar:', error);
    return res.status(500).json({ erro: 'Erro ao listar blacklist' });
  }
});

/**
 * GET /api/blacklist/estatisticas
 * Estatísticas da blacklist por motivo
 */
router.get('/estatisticas', async (req, res) => {
  try {
    const { tenantId } = req.query;

    const contagens = await blacklistService.contarPorMotivo(tenantId as string);

    const total = Object.values(contagens).reduce((a, b) => a + b, 0);

    return res.json({
      total,
      porMotivo: contagens
    });
  } catch (error: any) {
    console.error('[Blacklist] Erro ao buscar estatísticas:', error);
    return res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

/**
 * GET /api/blacklist/verificar/:telefone
 * Verifica se um telefone está na blacklist
 */
router.get('/verificar/:telefone', async (req, res) => {
  try {
    const { telefone } = req.params;
    const { tenantId } = req.query;

    const bloqueado = await blacklistService.estaBlacklist(telefone, tenantId as string);

    return res.json({
      telefone,
      bloqueado
    });
  } catch (error: any) {
    console.error('[Blacklist] Erro ao verificar:', error);
    return res.status(500).json({ erro: 'Erro ao verificar telefone' });
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

    await blacklistService.adicionar(dados);

    return res.json({
      sucesso: true,
      mensagem: 'Telefone adicionado à blacklist'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    console.error('[Blacklist] Erro ao adicionar:', error);
    return res.status(500).json({ erro: 'Erro ao adicionar à blacklist' });
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

    const { telefones, motivo, tenantId, observacoes } = schema.parse(req.body);

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
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    console.error('[Blacklist] Erro ao adicionar em lote:', error);
    return res.status(500).json({ erro: 'Erro ao adicionar em lote' });
  }
});

/**
 * DELETE /api/blacklist/:telefone
 * Remove telefone da blacklist
 */
router.delete('/:telefone', async (req, res) => {
  try {
    const { telefone } = req.params;
    const { tenantId } = req.query;

    const removido = await blacklistService.remover(telefone, tenantId as string);

    if (removido) {
      return res.json({
        sucesso: true,
        mensagem: 'Telefone removido da blacklist'
      });
    } else {
      return res.status(404).json({
        erro: 'Telefone não encontrado na blacklist'
      });
    }
  } catch (error: any) {
    console.error('[Blacklist] Erro ao remover:', error);
    return res.status(500).json({ erro: 'Erro ao remover da blacklist' });
  }
});

export default router;
