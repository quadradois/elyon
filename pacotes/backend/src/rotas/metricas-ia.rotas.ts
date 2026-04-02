/**
 * ROTAS DE MÉTRICAS DA IA
 * 
 * API para consultar performance dos agentes, guardrails,
 * ferramentas e sentimento dos leads.
 * 
 * Endpoints:
 * - GET /api/metricas-ia/resumo          — Conversões por agente, taxa de handoff
 * - GET /api/metricas-ia/guardrails      — Top guardrails acionados
 * - GET /api/metricas-ia/tools           — Taxa de sucesso/falha por tool
 * - GET /api/metricas-ia/sentimento      — Distribuição de sentimento
 * 
 * @version 1.0
 * @date 02/04/2026
 */

import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// ====================================
// GET /resumo — Performance geral dos agentes
// ====================================
router.get('/resumo', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const diasAtras = parseInt(req.query.dias as string) || 30;
    
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    // Buscar atividades de tool execution
    const atividades = await prisma.atividade.findMany({
      where: {
        titulo: { startsWith: 'TOOL_EXEC:' },
        criadoEm: { gte: limiteData },
        lead: { tenantId }
      },
      select: {
        titulo: true,
        descricao: true,
        criadoEm: true,
      }
    });

    // Contagens por resultado
    const totalExecucoes = atividades.length;
    const sucessos = atividades.filter((a: any) => a.descricao?.startsWith('SUCCESS')).length;
    const falhas = totalExecucoes - sucessos;

    // Contagens por tool
    const porTool: Record<string, { total: number; sucessos: number; falhas: number }> = {};
    for (const a of atividades as any[]) {
      const toolName = a.titulo.replace('TOOL_EXEC:', '');
      if (!porTool[toolName]) porTool[toolName] = { total: 0, sucessos: 0, falhas: 0 };
      porTool[toolName].total++;
      if (a.descricao?.startsWith('SUCCESS')) {
        porTool[toolName].sucessos++;
      } else {
        porTool[toolName].falhas++;
      }
    }

    // Métricas de leads
    const [totalLeads, leadsQuentes, leadsMornos, leadsFrios] = await Promise.all([
      prisma.lead.count({ where: { tenantId, criadoEm: { gte: limiteData } } }),
      prisma.lead.count({ where: { tenantId, temperatura: 'QUENTE', criadoEm: { gte: limiteData } } }),
      prisma.lead.count({ where: { tenantId, temperatura: 'MORNO', criadoEm: { gte: limiteData } } }),
      prisma.lead.count({ where: { tenantId, temperatura: 'FRIO', criadoEm: { gte: limiteData } } }),
    ]);

    // Conversões (leads captados)
    const captados = await prisma.lead.count({
      where: { tenantId, status: 'CAPTADO', criadoEm: { gte: limiteData } }
    });

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      resumo: {
        totalExecucoesTools: totalExecucoes,
        taxaSucesso: totalExecucoes > 0 ? `${((sucessos / totalExecucoes) * 100).toFixed(1)}%` : '0%',
        totalLeadsGerados: totalLeads,
        leadsCaptados: captados,
        taxaConversao: totalLeads > 0 ? `${((captados / totalLeads) * 100).toFixed(1)}%` : '0%',
      },
      distribuicaoTemperatura: {
        quentes: leadsQuentes,
        mornos: leadsMornos,
        frios: leadsFrios,
      },
      performancePorTool: porTool,
    });

  } catch (error: any) {
    console.error('[METRICAS-IA] Erro no resumo:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /tools — Detalhamento por ferramenta
// ====================================
router.get('/tools', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const diasAtras = parseInt(req.query.dias as string) || 7;
    
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const atividades = await prisma.atividade.findMany({
      where: {
        titulo: { startsWith: 'TOOL_EXEC:' },
        criadoEm: { gte: limiteData },
        lead: { tenantId }
      },
      select: {
        titulo: true,
        descricao: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });

    const porTool: Record<string, {
      total: number;
      sucessos: number;
      falhas: number;
      ultimaExecucao: Date | null;
      exemplosErro: string[];
    }> = {};

    for (const a of atividades) {
      const toolName = a.titulo.replace('TOOL_EXEC:', '');
      if (!porTool[toolName]) {
        porTool[toolName] = { total: 0, sucessos: 0, falhas: 0, ultimaExecucao: null, exemplosErro: [] };
      }
      porTool[toolName].total++;
      if (!porTool[toolName].ultimaExecucao) porTool[toolName].ultimaExecucao = a.criadoEm;

      if (a.descricao?.startsWith('SUCCESS')) {
        porTool[toolName].sucessos++;
      } else {
        porTool[toolName].falhas++;
        if (porTool[toolName].exemplosErro.length < 3) {
          porTool[toolName].exemplosErro.push(a.descricao || 'Erro desconhecido');
        }
      }
    }

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      tools: porTool,
    });

  } catch (error: any) {
    console.error('[METRICAS-IA] Erro nas tools:', error);
    res.status(500).json({ erro: error.message });
  }
});

// ====================================
// GET /conversoes — Timeline de conversões
// ====================================
router.get('/conversoes', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const diasAtras = parseInt(req.query.dias as string) || 30;

    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasAtras);

    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        criadoEm: { gte: limiteData },
      },
      select: {
        id: true,
        nome: true,
        temperatura: true,
        status: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });

    // Agrupar por dia
    const porDia: Record<string, { total: number; quentes: number; captados: number }> = {};
    for (const lead of leads) {
      const dia = lead.criadoEm.toISOString().split('T')[0];
      if (!porDia[dia]) porDia[dia] = { total: 0, quentes: 0, captados: 0 };
      porDia[dia].total++;
      if (lead.temperatura === 'QUENTE') porDia[dia].quentes++;
      if (lead.status === 'CAPTADO') porDia[dia].captados++;
    }

    res.json({
      periodo: `Últimos ${diasAtras} dias`,
      totalLeads: leads.length,
      timeline: porDia,
      ultimosLeads: leads.slice(0, 10).map((l: any) => ({
        nome: l.nome,
        temperatura: l.temperatura,
        status: l.status,
        tipo: l.tipoInteresse,
        data: l.criadoEm,
      })),
    });

  } catch (error: any) {
    console.error('[METRICAS-IA] Erro nas conversões:', error);
    res.status(500).json({ erro: error.message });
  }
});

export default router;
