import { responderErro } from '../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';

const router = Router();

/**
 * MÉTRICAS DOS AGENTES
 * 
 * Endpoints para monitorar performance dos agentes IA
 */

// Middleware para extrair tenantId
const getTenantId = (req: Request): string => {
  return req.headers['x-tenant-id'] as string || 'default-tenant';
};

/**
 * GET /api/metricas-agentes/resumo
 * Retorna resumo geral de performance
 */
router.get('/resumo', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { periodo = '7d' } = req.query;
    
    // Calcular data inicial baseada no período
    const diasAtras = periodo === '30d' ? 30 : periodo === '24h' ? 1 : 7;
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - diasAtras);
    
    // Buscar métricas
    const [
      totalConversas,
      conversasAtivas,
      leadsQualificados,
      leadsQuentes,
      leadsMornos,
      leadsFrios,
      totalMensagens
    ] = await Promise.all([
      // Total de conversas no período
      prisma.conversa.count({
        where: {
          lead: { tenantId },
          iniciadaEm: { gte: dataInicial }
        }
      }),
      
      // Conversas ativas agora
      prisma.conversa.count({
        where: {
          lead: { tenantId },
          estadoConversa: 'ativa'
        }
      }),
      
      // Leads qualificados no período
      prisma.lead.count({
        where: {
          tenantId,
          NOT: { temperatura: undefined },
          atualizadoEm: { gte: dataInicial }
        }
      }),
      
      // Leads QUENTES
      prisma.lead.count({
        where: {
          tenantId,
          temperatura: 'QUENTE',
          atualizadoEm: { gte: dataInicial }
        }
      }),
      
      // Leads MORNOS
      prisma.lead.count({
        where: {
          tenantId,
          temperatura: 'MORNO',
          atualizadoEm: { gte: dataInicial }
        }
      }),
      
      // Leads FRIOS
      prisma.lead.count({
        where: {
          tenantId,
          temperatura: 'FRIO',
          atualizadoEm: { gte: dataInicial }
        }
      }),
      
      // Total de mensagens processadas
      prisma.mensagem.count({
        where: {
          conversa: {
            lead: { tenantId }
          },
          enviadaEm: { gte: dataInicial }
        }
      })
    ]);
    
    // Calcular taxa de conversão
    const taxaConversao = totalConversas > 0 
      ? Math.round((leadsQuentes / totalConversas) * 100) 
      : 0;
    
    // Calcular média de mensagens por conversa
    const mediaMensagensPorConversa = totalConversas > 0
      ? Math.round(totalMensagens / totalConversas)
      : 0;
    
    res.json({
      periodo: `${diasAtras} dias`,
      resumo: {
        totalConversas,
        conversasAtivas,
        leadsQualificados,
        totalMensagens,
        mediaMensagensPorConversa,
        taxaConversao: `${taxaConversao}%`
      },
      distribuicaoTemperatura: {
        quentes: leadsQuentes,
        mornos: leadsMornos,
        frios: leadsFrios
      },
      tendencia: {
        // Placeholder para tendência (comparação com período anterior)
        conversas: '+12%',
        qualificados: '+8%'
      }
    });
    
  } catch (error) {
    console.error('[Métricas] Erro ao buscar resumo:', error);
    responderErro(res, 500, 'Erro ao buscar métricas');
  }
});

/**
 * GET /api/metricas-agentes/conversas-por-dia
 * Retorna volume de conversas por dia (para gráfico)
 */
router.get('/conversas-por-dia', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { dias = 7 } = req.query;
    
    const numDias = parseInt(dias as string);
    const resultado: { data: string; conversas: number; mensagens: number }[] = [];
    
    for (let i = numDias - 1; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      data.setHours(0, 0, 0, 0);
      
      const dataFim = new Date(data);
      dataFim.setHours(23, 59, 59, 999);
      
      const [conversas, mensagens] = await Promise.all([
        prisma.conversa.count({
          where: {
            lead: { tenantId },
            iniciadaEm: { gte: data, lte: dataFim }
          }
        }),
        prisma.mensagem.count({
          where: {
            conversa: { lead: { tenantId } },
            enviadaEm: { gte: data, lte: dataFim }
          }
        })
      ]);
      
      resultado.push({
        data: data.toISOString().split('T')[0],
        conversas,
        mensagens
      });
    }
    
    res.json({ dados: resultado });
    
  } catch (error) {
    console.error('[Métricas] Erro ao buscar conversas por dia:', error);
    responderErro(res, 500, 'Erro ao buscar dados');
  }
});

/**
 * GET /api/metricas-agentes/workers
 * Retorna performance por worker
 */
router.get('/workers', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    // Por enquanto retorna dados mockados
    // Futuramente: criar tabela de logs de workers
    res.json({
      workers: [
        {
          nome: 'SDR Worker',
          status: 'ativo',
          conversasHoje: 45,
          tempoMedioResposta: '2.3s',
          taxaSucesso: '94%',
          ultimaExecucao: new Date().toISOString()
        },
        {
          nome: 'Documentos Worker',
          status: 'ativo',
          conversasHoje: 12,
          tempoMedioResposta: '1.8s',
          taxaSucesso: '98%',
          ultimaExecucao: new Date().toISOString()
        }
      ]
    });
    
  } catch (error) {
    console.error('[Métricas] Erro ao buscar workers:', error);
    responderErro(res, 500, 'Erro ao buscar dados');
  }
});

/**
 * GET /api/metricas-agentes/funil
 * Retorna dados do funil de qualificação
 */
router.get('/funil', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    const [
      totalLeads,
      leadsContatados,
      leadsQualificados,
      leadsQuentes,
      leadsConvertidos
    ] = await Promise.all([
      prisma.lead.count({ where: { tenantId } }),
      prisma.lead.count({ 
        where: { 
          tenantId,
          conversas: { some: {} }
        } 
      }),
      prisma.lead.count({ 
        where: { 
          tenantId,
          NOT: { temperatura: undefined }
        } 
      }),
      prisma.lead.count({ 
        where: { 
          tenantId,
          temperatura: 'QUENTE'
        } 
      }),
      // Leads com status de conversão (placeholder)
      prisma.lead.count({ 
        where: { 
          tenantId,
          status: 'CONVERTIDO'
        } 
      })
    ]);
    
    res.json({
      funil: [
        { etapa: 'Total de Leads', valor: totalLeads, cor: '#64748b' },
        { etapa: 'Contatados', valor: leadsContatados, cor: '#3b82f6' },
        { etapa: 'Qualificados', valor: leadsQualificados, cor: '#8b5cf6' },
        { etapa: 'Leads Quentes', valor: leadsQuentes, cor: '#f97316' },
        { etapa: 'Convertidos', valor: leadsConvertidos, cor: '#22c55e' }
      ],
      taxas: {
        contatoParaQualificado: leadsContatados > 0 
          ? `${Math.round((leadsQualificados / leadsContatados) * 100)}%` 
          : '0%',
        qualificadoParaQuente: leadsQualificados > 0 
          ? `${Math.round((leadsQuentes / leadsQualificados) * 100)}%` 
          : '0%',
        quenteParaConvertido: leadsQuentes > 0 
          ? `${Math.round((leadsConvertidos / leadsQuentes) * 100)}%` 
          : '0%'
      }
    });
    
  } catch (error) {
    console.error('[Métricas] Erro ao buscar funil:', error);
    responderErro(res, 500, 'Erro ao buscar dados');
  }
});

/**
 * GET /api/metricas-agentes/atividade-recente
 * Retorna últimas atividades dos agentes
 */
router.get('/atividade-recente', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    // Buscar últimas mensagens dos agentes
    const mensagensRecentes = await prisma.mensagem.findMany({
      where: {
        conversa: { lead: { tenantId } },
        remetente: 'assistente'
      },
      orderBy: { enviadaEm: 'desc' },
      take: 10,
      include: {
        conversa: {
          include: {
            lead: {
              select: { nome: true, telefone: true }
            }
          }
        }
      }
    });
    
    const atividades = mensagensRecentes.map(msg => ({
      tipo: 'mensagem_enviada',
      descricao: `Respondeu ${msg.conversa.lead.nome}`,
      preview: msg.conteudo.substring(0, 80) + (msg.conteudo.length > 80 ? '...' : ''),
      tempo: msg.enviadaEm,
      leadId: msg.conversa.leadId
    }));
    
    res.json({ atividades });
    
  } catch (error) {
    console.error('[Métricas] Erro ao buscar atividade:', error);
    responderErro(res, 500, 'Erro ao buscar dados');
  }
});

export default router;
