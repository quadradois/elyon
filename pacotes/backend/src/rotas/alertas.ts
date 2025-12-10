/**
 * Rotas de Alertas para Corretores
 * 
 * Endpoints para gerenciar alertas de escalação do SDR
 * Integração com WebSocket para notificações em tempo real
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';

const router = Router();

/**
 * GET /api/alertas
 * Lista alertas do corretor logado
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const status = req.query.status as string || 'pendente';
    const limite = parseInt(req.query.limite as string) || 50;
    
    if (!tenantId) {
      return res.status(400).json({ erro: 'Tenant ID não informado' });
    }
    
    const alertas = await (prisma as any).alertaCorretor.findMany({
      where: {
        tenantId,
        status
      },
      orderBy: [
        { prioridade: 'desc' },
        { criadoEm: 'desc' }
      ],
      take: limite
    });
    
    return res.json({
      sucesso: true,
      alertas,
      total: alertas.length
    });
    
  } catch (error) {
    console.error('[ALERTAS] Erro ao listar:', error);
    return res.status(500).json({ erro: 'Erro ao listar alertas' });
  }
});

/**
 * GET /api/alertas/resumo
 * Retorna contagem de alertas por status
 */
router.get('/resumo', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ erro: 'Tenant ID não informado' });
    }
    
    const [pendentes, visualizados, resolvidos] = await Promise.all([
      (prisma as any).alertaCorretor.count({
        where: { tenantId, status: 'pendente' }
      }),
      (prisma as any).alertaCorretor.count({
        where: { tenantId, status: 'visualizado' }
      }),
      (prisma as any).alertaCorretor.count({
        where: { tenantId, status: 'resolvido' }
      })
    ]);
    
    return res.json({
      sucesso: true,
      resumo: {
        pendentes,
        visualizados,
        resolvidos,
        total: pendentes + visualizados + resolvidos
      }
    });
    
  } catch (error) {
    console.error('[ALERTAS] Erro ao obter resumo:', error);
    return res.status(500).json({ erro: 'Erro ao obter resumo de alertas' });
  }
});

/**
 * GET /api/alertas/:id
 * Retorna detalhes de um alerta específico
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    const alerta = await (prisma as any).alertaCorretor.findFirst({
      where: { 
        id,
        tenantId 
      }
    });
    
    if (!alerta) {
      return res.status(404).json({ erro: 'Alerta não encontrado' });
    }
    
    // Buscar lead se existir
    let lead = null;
    if (alerta.leadId) {
      lead = await prisma.lead.findUnique({
        where: { id: alerta.leadId },
        select: { id: true, nome: true, telefone: true, email: true }
      });
    }
    
    return res.json({
      sucesso: true,
      alerta: { ...alerta, lead }
    });
    
  } catch (error) {
    console.error('[ALERTAS] Erro ao buscar alerta:', error);
    return res.status(500).json({ erro: 'Erro ao buscar alerta' });
  }
});

/**
 * PATCH /api/alertas/:id/visualizar
 * Marca alerta como visualizado
 */
router.patch('/:id/visualizar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    const alerta = await (prisma as any).alertaCorretor.update({
      where: { id },
      data: {
        status: 'visualizado',
        visualizadoEm: new Date()
      }
    });
    
    return res.json({
      sucesso: true,
      alerta
    });
    
  } catch (error) {
    console.error('[ALERTAS] Erro ao visualizar alerta:', error);
    return res.status(500).json({ erro: 'Erro ao visualizar alerta' });
  }
});

/**
 * PATCH /api/alertas/:id/resolver
 * Marca alerta como resolvido
 */
router.patch('/:id/resolver', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolvidoPor } = req.body;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    const alerta = await (prisma as any).alertaCorretor.update({
      where: { id },
      data: {
        status: 'resolvido',
        resolvidoEm: new Date(),
        resolvidoPor
      }
    });
    
    return res.json({
      sucesso: true,
      alerta
    });
    
  } catch (error) {
    console.error('[ALERTAS] Erro ao resolver alerta:', error);
    return res.status(500).json({ erro: 'Erro ao resolver alerta' });
  }
});

/**
 * POST /api/alertas/visualizar-todos
 * Marca todos os alertas pendentes como visualizados
 */
router.post('/visualizar-todos', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ erro: 'Tenant ID não informado' });
    }
    
    const resultado = await (prisma as any).alertaCorretor.updateMany({
      where: {
        tenantId,
        status: 'pendente'
      },
      data: {
        status: 'visualizado',
        visualizadoEm: new Date()
      }
    });
    
    return res.json({
      sucesso: true,
      atualizados: resultado.count
    });
    
  } catch (error) {
    console.error('[ALERTAS] Erro ao visualizar todos:', error);
    return res.status(500).json({ erro: 'Erro ao visualizar alertas' });
  }
});

export default router;
