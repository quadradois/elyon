import { Router } from 'express';
import { prisma } from '../lib/db';
import { verificarSuperAdmin } from '../middleware/middleware-auth';
import { responderErro } from '../utilitarios/resposta';

const router = Router();

// GET /api/admin/auditoria
// Rota exclusiva para SUPER_ADMIN visualizar todos os logs do sistema
router.get('/', verificarSuperAdmin, async (req, res) => {
  try {
    const pagina = parseInt(req.query.pagina as string) || 1;
    const limite = parseInt(req.query.limite as string) || 50;
    
    // Filtros
    const acao = req.query.acao as string;
    const tenantId = req.query.tenantId as string;
    const busca = req.query.busca as string;

    const where: any = {};
    if (acao) where.acao = acao;
    if (tenantId) where.tenantId = tenantId;
    if (busca) {
      where.OR = [
        { acao: { contains: busca, mode: 'insensitive' } },
        { entidade: { contains: busca, mode: 'insensitive' } },
        { ip: { contains: busca, mode: 'insensitive' } }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.logAuditoria.findMany({
        where,
        include: {
          usuario: {
            select: { id: true, nome: true, email: true }
          },
          tenant: {
            select: { id: true, nome: true }
          }
        },
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite
      }),
      prisma.logAuditoria.count({ where })
    ]);

    res.json({
      dados: logs,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite)
      }
    });

  } catch (error) {
    console.error('[Auditoria] Erro ao listar logs:', error);
    responderErro(res, 500, 'Erro interno ao listar logs de auditoria');
  }
});

// GET /api/admin/auditoria/acoes
// Retorna os tipos de ações únicas para popular o filtro no frontend
router.get('/acoes', verificarSuperAdmin, async (req, res) => {
  try {
    const acoes = await prisma.logAuditoria.groupBy({
      by: ['acao'],
      _count: { acao: true },
      orderBy: { _count: { acao: 'desc' } }
    });
    
    res.json(acoes.map((a: any) => a.acao));
  } catch (error) {
    console.error('[Auditoria] Erro ao listar tipos de ações:', error);
    responderErro(res, 500, 'Erro interno');
  }
});

export default router;
