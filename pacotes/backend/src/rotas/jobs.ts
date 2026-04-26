/**
 * ROTAS DE JOBS/TAREFAS AGENDADAS
 * 
 * Endpoints para executar e monitorar jobs do sistema.
 * Protegidos por autenticação (admin only).
 */

import { Router, Request, Response } from 'express';
import { processarRecontatos } from '../jobs/recontato-automatico';
import { experienceReplayService } from '../servicos/experience-replay';

const router = Router();

/**
 * POST /api/jobs/recontato
 * 
 * Executa o job de recontato automático manualmente.
 * Processa todos os contatos MORNO_FUTURO com dataRecontato vencida.
 */
router.post('/recontato', async (req: Request, res: Response) => {
  try {
    console.log('[Jobs] Executando job de recontato manualmente...');
    
    const resultado = await processarRecontatos();
    
    res.json({
      success: true,
      message: 'Job de recontato executado com sucesso',
      resultado
    });
    
  } catch (error: any) {
    console.error('[Jobs] Erro ao executar recontato:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/jobs/recontato/preview
 * 
 * Lista contatos que seriam processados no próximo recontato.
 * Útil para preview antes de executar.
 */
router.get('/recontato/preview', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('../lib/db');
    
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    const contatos = await prisma.contato.findMany({
      where: {
        statusProspeccao: 'MORNO_FUTURO',
        dataRecontato: {
          lte: hoje
        }
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        dataRecontato: true,
        motivoRecontato: true,
        nomeEdificio: true,
        campanha: {
          select: {
            nome: true,
            status: true
          }
        }
      },
      orderBy: {
        dataRecontato: 'asc'
      },
      take: 50
    });
    
    res.json({
      success: true,
      total: contatos.length,
      contatos: contatos.map(c => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        dataRecontato: c.dataRecontato,
        motivo: c.motivoRecontato,
        empreendimento: c.nomeEdificio,
        campanha: c.campanha?.nome,
        campanhaAtiva: c.campanha?.status === 'ATIVA'
      }))
    });
    
  } catch (error: any) {
    console.error('[Jobs] Erro ao buscar preview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/jobs/experience-replay
 *
 * Dispara execução manual do Experience Replay (por tenant).
 */
router.post('/experience-replay', async (req: Request, res: Response) => {
  try {
    const tenantIdBody = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : '';
    const tenantIdHeader = typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'].trim() : '';
    const tenantId = tenantIdBody || tenantIdHeader;
    const forcar = req.body?.forcar !== false;

    const resultado = await experienceReplayService.executarReplayDiario({
      forcar,
      tenantIds: tenantId ? [tenantId] : undefined,
    });

    res.json({
      success: true,
      message: 'Experience Replay executado',
      resultado,
    });
  } catch (error: any) {
    console.error('[Jobs] Erro ao executar experience replay:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/jobs/status
 * 
 * Retorna status geral dos jobs agendados.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('../lib/db');
    
    // Contagem de contatos por status
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    const [
      mornoFuturoTotal,
      pendentesHoje,
      pendentesSemana,
      ultimoReplay
    ] = await Promise.all([
      prisma.contato.count({
        where: { statusProspeccao: 'MORNO_FUTURO' }
      }),
      prisma.contato.count({
        where: {
          statusProspeccao: 'MORNO_FUTURO',
          dataRecontato: { lte: hoje }
        }
      }),
      prisma.contato.count({
        where: {
          statusProspeccao: 'MORNO_FUTURO',
          dataRecontato: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      (prisma as any).auditoriaReplayAprendizado.findFirst({
        orderBy: { executadoEm: 'desc' },
        select: {
          executadoEm: true,
          status: true,
          padroesAjustados: true,
          ajusteTotalAbs: true
        }
      })
    ]);
    
    res.json({
      success: true,
      jobs: {
        recontato: {
          name: 'Recontato Automático',
          schedule: 'Diariamente às 9h',
          stats: {
            mornoFuturoTotal,
            pendentesHoje,
            pendentesSemana
          }
        },
        experienceReplay: {
          name: 'Experience Replay',
          schedule: 'Diário (acoplado ao job de conversas inativas)',
          ultimo: ultimoReplay || null
        }
      }
    });
    
  } catch (error: any) {
    console.error('[Jobs] Erro ao buscar status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
