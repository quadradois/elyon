/**
 * ROTAS DE JOBS/TAREFAS AGENDADAS
 * 
 * Endpoints para executar e monitorar jobs do sistema.
 * Protegidos por autenticação (admin only).
 */

import { Router, Request, Response } from 'express';
import { processarRecontatos } from '../jobs/recontato-automatico';
import { experienceReplayService } from '../servicos/experience-replay';
import { executarReenviosCrmFalhos } from '../jobs/job-reenvio-crm';
import { executarRetornoIa } from '../jobs/job-retomar-ia';
import {
  executarConvitesConfirmacaoCorretor,
  executarLembretesConfirmacaoCorretor,
  executarCutoffRemanejamentoCorretor
} from '../jobs/job-confirmacao-corretor';
import { verificarSuperAdmin } from '../middleware/middleware-auth';

const router = Router();
router.use(verificarSuperAdmin);

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
    
    const contatos = await prisma.lead.findMany({
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
        campanhaOrigem: {
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
        campanha: c.campanhaOrigem?.nome,
        campanhaAtiva: c.campanhaOrigem?.status === 'ATIVA'
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
    const tenantId = req.tenantId;
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
      prisma.lead.count({
        where: { statusProspeccao: 'MORNO_FUTURO' }
      }),
      prisma.lead.count({
        where: {
          statusProspeccao: 'MORNO_FUTURO',
          dataRecontato: { lte: hoje }
        }
      }),
      prisma.lead.count({
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

/**
 * POST /api/jobs/reenvio-crm
 *
 * Retenta envio ao CRM para leads com crmSyncStatus='failed'.
 * Processa até 20 leads por execução.
 */
router.post('/reenvio-crm', async (req: Request, res: Response) => {
  try {
    console.log('[Jobs] Executando job de reenvio CRM...');
    const resultado = await executarReenviosCrmFalhos();
    res.json({ success: true, resultado });
  } catch (error: any) {
    console.error('[Jobs] Erro no reenvio CRM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/retomar-ia
 *
 * Devolve à IA todos os contatos em modo HUMANO que ultrapassaram o SLA.
 * Parâmetro opcional: { slaHoras: number } (padrão: 4h).
 */
router.post('/retomar-ia', async (req: Request, res: Response) => {
  try {
    const slaHoras = typeof req.body?.slaHoras === 'number' ? req.body.slaHoras : 4;
    console.log(`[Jobs] Executando retorno automático HUMANO→IA (SLA=${slaHoras}h)...`);
    const resultado = await executarRetornoIa(slaHoras);
    res.json({ success: true, resultado });
  } catch (error: any) {
    console.error('[Jobs] Erro no retorno IA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/confirmacao-corretor/convites
 * Dispara convites de confirmação T-120.
 */
router.post('/confirmacao-corretor/convites', async (_req: Request, res: Response) => {
  try {
    const resultado = await executarConvitesConfirmacaoCorretor();
    res.json({ success: true, resultado });
  } catch (error: any) {
    console.error('[Jobs] Erro no job convites corretor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/confirmacao-corretor/lembretes
 * Dispara lembretes de confirmação T-90.
 */
router.post('/confirmacao-corretor/lembretes', async (_req: Request, res: Response) => {
  try {
    const resultado = await executarLembretesConfirmacaoCorretor();
    res.json({ success: true, resultado });
  } catch (error: any) {
    console.error('[Jobs] Erro no job lembretes corretor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs/confirmacao-corretor/cutoff
 * Executa cutoff T-60 e remanejamento automático.
 */
router.post('/confirmacao-corretor/cutoff', async (_req: Request, res: Response) => {
  try {
    const resultado = await executarCutoffRemanejamentoCorretor();
    res.json({ success: true, resultado });
  } catch (error: any) {
    console.error('[Jobs] Erro no job cutoff corretor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
