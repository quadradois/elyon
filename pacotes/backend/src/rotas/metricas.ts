import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// ROTA: Dashboard de Métricas
// GET /api/metricas/dashboard
// ============================================

router.get('/dashboard', async (req, res) => {
  try {
    // ✅ Exigir tenantId - sem fallback inseguro
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    // Datas para filtros
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 7);
    
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    // ============================================
    // MÉTRICAS DE LEADS
    // ============================================
    
    const [
      totalLeads,
      leadsSemana,
      leadsMes,
      leadsPorStatus
    ] = await Promise.all([
      // Total de leads
      prisma.lead.count({
        where: { tenantId, deletadoEm: null }
      }),
      
      // Leads criados esta semana
      prisma.lead.count({
        where: {
          tenantId,
          deletadoEm: null,
          criadoEm: { gte: inicioSemana }
        }
      }),
      
      // Leads criados este mês
      prisma.lead.count({
        where: {
          tenantId,
          deletadoEm: null,
          criadoEm: { gte: inicioMes }
        }
      }),
      
      // Leads por status
      prisma.lead.groupBy({
        by: ['status'],
        where: { tenantId, deletadoEm: null },
        _count: { status: true }
      })
    ]);

    // ============================================
    // MÉTRICAS DE CAMPANHAS
    // ============================================
    
    const [
      totalCampanhas,
      campanhasAtivas,
      topCampanhas
    ] = await Promise.all([
      // Total de campanhas
      prisma.campanha.count({
        where: { tenantId }
      }),
      
      // Campanhas ativas
      prisma.campanha.count({
        where: { tenantId, status: 'ATIVA' }
      }),
      
      // Top 5 campanhas por leads
      prisma.campanha.findMany({
        where: { tenantId },
        orderBy: { totalLeads: 'desc' },
        take: 5,
        select: {
          id: true,
          nome: true,
          totalLeads: true,
          totalContatos: true,
          status: true,
          criadoEm: true
        }
      })
    ]);

    // ============================================
    // MÉTRICAS DE CONVERSAS (WhatsApp)
    // ============================================
    
    const [
      totalConversas,
      conversasSemana
    ] = await Promise.all([
      prisma.conversa.count({
        where: {
          lead: { tenantId }
        }
      }),
      
      prisma.conversa.count({
        where: {
          lead: { tenantId },
          iniciadaEm: { gte: inicioSemana }
        }
      })
    ]);

    // ============================================
    // MÉTRICAS DE CONSULTAS CPF (Assertiva)
    // ============================================
    
    const [
      consultasMes,
      consultasDoCache,
      gastoMes,
      economiaCache
    ] = await Promise.all([
      // Total de consultas no mês
      prisma.consultaCpf.count({
        where: {
          tenantId,
          consultadoEm: { gte: inicioMes }
        }
      }),
      
      // Consultas do cache (economia)
      prisma.consultaCpf.count({
        where: {
          tenantId,
          consultadoEm: { gte: inicioMes },
          veioDoCache: true
        }
      }),
      
      // Gasto total no mês
      prisma.consultaCpf.aggregate({
        where: {
          tenantId,
          consultadoEm: { gte: inicioMes },
          veioDoCache: false
        },
        _sum: { custoParaNos: true }
      }),
      
      // Economia com cache
      prisma.consultaCpf.aggregate({
        where: {
          tenantId,
          consultadoEm: { gte: inicioMes },
          veioDoCache: true
        },
        _count: true
      })
    ]);

    // Calcular economia estimada (R$ 2,00 por consulta evitada)
    const precoPorConsulta = 2.00;
    const economiaEstimada = (economiaCache._count || 0) * precoPorConsulta;
    const taxaCache = consultasMes > 0 
      ? ((consultasDoCache / consultasMes) * 100).toFixed(1) 
      : 0;

    // ============================================
    // MÉTRICAS DE CONVERSÃO
    // ============================================
    
    const leadsConvertidos = leadsPorStatus.find(l => l.status === 'CONVERTIDO')?._count?.status || 0;
    const leadsQualificados = leadsPorStatus.find(l => l.status === 'QUALIFICADO')?._count?.status || 0;
    const taxaConversao = totalLeads > 0 
      ? ((leadsConvertidos / totalLeads) * 100).toFixed(1) 
      : 0;

    // ============================================
    // HISTÓRICO SEMANAL (últimos 7 dias)
    // ============================================
    
    const historicoLeads = await prisma.$queryRaw<Array<{ dia: string; total: bigint }>>`
      SELECT 
        DATE(created_at) as dia,
        COUNT(*) as total
      FROM leads
      WHERE tenant_id = ${tenantId}
        AND deleted_at IS NULL
        AND created_at >= ${inicioSemana}
      GROUP BY DATE(created_at)
      ORDER BY dia ASC
    `.catch(() => []);

    // ============================================
    // RESPOSTA
    // ============================================
    
    return res.json({
      resumo: {
        leads: {
          total: totalLeads,
          semana: leadsSemana,
          mes: leadsMes,
          convertidos: leadsConvertidos,
          qualificados: leadsQualificados,
          taxaConversao: `${taxaConversao}%`
        },
        campanhas: {
          total: totalCampanhas,
          ativas: campanhasAtivas
        },
        conversas: {
          total: totalConversas,
          semana: conversasSemana
        },
        assertiva: {
          consultasMes,
          doCache: consultasDoCache,
          // Nota: gastoMes removido - informação confidencial do tenant
          economiaEstimada: economiaEstimada.toFixed(2),
          taxaCache: `${taxaCache}%`
        }
      },
      topCampanhas: topCampanhas.map(c => ({
        id: c.id,
        nome: c.nome,
        leads: c.totalLeads,
        contatos: c.totalContatos,
        status: c.status,
        criadoEm: c.criadoEm
      })),
      leadsPorStatus: leadsPorStatus.map(l => ({
        status: l.status,
        quantidade: l._count?.status || 0
      })),
      historicoSemanal: historicoLeads.map(h => ({
        dia: h.dia,
        leads: Number(h.total)
      })),
      atualizadoEm: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Metricas] Erro ao buscar dashboard:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ============================================
// ROTA: Métricas de Mineração
// GET /api/metricas/mineracao
// ============================================

router.get('/mineracao', async (req, res) => {
  try {
    // ✅ Exigir tenantId - sem fallback inseguro
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Leads minerados (origem = mineracao)
    const [leadsMinerados, leadsMineradosMes] = await Promise.all([
      prisma.lead.count({
        where: { tenantId, origem: 'mineracao', deletadoEm: null }
      }),
      prisma.lead.count({
        where: { 
          tenantId, 
          origem: 'mineracao', 
          deletadoEm: null,
          criadoEm: { gte: inicioMes }
        }
      })
    ]);

    // Imóveis cadastrados
    const imoveisCadastrados = await prisma.imovel.count();

    return res.json({
      leadsMinerados,
      leadsMineradosMes,
      imoveisCadastrados,
      atualizadoEm: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Metricas] Erro ao buscar métricas de mineração:', error);
    return responderErro(res, 500, 'Erro ao carregar métricas');
  }
});

export default router;
