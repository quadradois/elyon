// Rotas para Leads VIP (do site de vendas)
// Integração com Supabase

import { Router, Request, Response } from 'express';
import * as servicoSupabase from '../servicos/servico-supabase';
import { verificarSuperAdmin } from '../middleware/middleware-auth';

const router = Router();

// ====================================
// LISTAR LEADS VIP
// ====================================

/**
 * GET /leads-vip
 * Lista todos os leads do site de vendas
 */
router.get('/', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limite = parseInt(req.query.limite as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const apenasNaoAtendidos = req.query.apenasNaoAtendidos === 'true';
    
    const leads = await servicoSupabase.listarLeadsVIP({
      limite,
      offset,
      apenasNaoAtendidos
    });
    
    const contagem = await servicoSupabase.contarLeadsVIP();
    
    res.json({
      sucesso: true,
      leads,
      contagem
    });
  } catch (erro: any) {
    console.error('Erro ao listar leads VIP:', erro);
    res.status(500).json({ erro: 'Erro ao buscar leads', detalhes: erro.message });
  }
});

// ====================================
// CONTAGEM
// ====================================

/**
 * GET /leads-vip/contagem
 * Retorna contagem de leads
 */
router.get('/contagem', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const contagem = await servicoSupabase.contarLeadsVIP();
    res.json({ sucesso: true, ...contagem });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao contar leads' });
  }
});

// ====================================
// BUSCAR UM LEAD
// ====================================

/**
 * GET /leads-vip/:id
 * Busca um lead específico
 */
router.get('/:id', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const lead = await servicoSupabase.buscarLeadVIP(id);
    
    if (!lead) {
      return res.status(404).json({ erro: 'Lead não encontrado' });
    }
    
    res.json({ sucesso: true, lead });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar lead' });
  }
});

// ====================================
// MARCAR COMO ATENDIDO
// ====================================

/**
 * POST /leads-vip/:id/atender
 * Marca lead como atendido
 */
router.post('/:id/atender', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { notas } = req.body;
    
    const sucesso = await servicoSupabase.marcarComoAtendido(id, notas);
    
    if (!sucesso) {
      return res.status(500).json({ erro: 'Falha ao atualizar' });
    }
    
    res.json({ sucesso: true, mensagem: 'Lead marcado como atendido' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar lead' });
  }
});

// ====================================
// ATUALIZAR STATUS
// ====================================

/**
 * PATCH /leads-vip/:id/status
 * Atualiza status do lead
 */
router.patch('/:id/status', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, notas } = req.body;
    
    if (!status) {
      return res.status(400).json({ erro: 'Status é obrigatório' });
    }
    
    const sucesso = await servicoSupabase.atualizarStatusLead(id, status, notas);
    
    if (!sucesso) {
      return res.status(500).json({ erro: 'Falha ao atualizar' });
    }
    
    res.json({ sucesso: true, mensagem: `Status atualizado para ${status}` });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

export default router;
