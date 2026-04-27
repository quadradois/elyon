import { responderErro } from '../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import type { StatusLead } from '@prisma/client';
import { prisma } from '../lib/db';
import {
  camposCriticosFaltantes,
  obterLastSourceUpdateAt,
} from '../agentes/governanca-qualificacao';

const router = Router();

/**
 * MÉTRICAS DOS AGENTES
 * 
 * Endpoints para monitorar performance dos agentes IA
 */

const extrairTenantId = (req: Request): string | null => {
  const tenantDoContexto = typeof req.tenantId === 'string' ? req.tenantId : '';
  const tenantDoHeader = typeof req.headers['x-tenant-id'] === 'string'
    ? req.headers['x-tenant-id']
    : '';
  const tenantId = (tenantDoContexto || tenantDoHeader).trim();
  return tenantId.length > 0 ? tenantId : null;
};

const obterTenantIdOuResponder = (req: Request, res: Response): string | null => {
  const tenantId = extrairTenantId(req);
  if (!tenantId) {
    responderErro(res, 400, 'Tenant ID obrigatório');
    return null;
  }
  return tenantId;
};

const STATUS_QUALIFICACAO: StatusLead[] = [
  'NOVO',
  'TENTATIVA_AGENDAMENTO',
  'VISITA_AGENDADA',
  'AVALIACAO_EM_ANDAMENTO',
  'DOCUMENTACAO',
  'ONBOARDING',
  'CAPTADO',
] as const;

const getDiasPeriodo = (periodo?: string): number => {
  if (periodo === '30d') return 30;
  if (periodo === '24h') return 1;
  return 7;
};

const formatarTendencia = (atual: number, anterior: number): string => {
  if (anterior === 0) return atual > 0 ? '+100%' : '0%';
  const variacao = ((atual - anterior) / anterior) * 100;
  const arredondado = Math.round(variacao);
  return `${arredondado > 0 ? '+' : ''}${arredondado}%`;
};

/**
 * GET /api/metricas-agentes/resumo
 * Retorna resumo geral de performance
 */
router.get('/resumo', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;
    const periodo = String(req.query.periodo || '7d');
    
    // Janela atual
    const diasAtras = getDiasPeriodo(periodo);
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - diasAtras);

    // Janela anterior (mesmo tamanho da atual)
    const dataInicialAnterior = new Date(dataInicial);
    dataInicialAnterior.setDate(dataInicialAnterior.getDate() - diasAtras);
    
    // Buscar métricas
    const [
      totalConversas,
      totalConversasAnterior,
      conversasAtivas,
      leadsQualificados,
      leadsQualificadosAnterior,
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

      // Total de conversas no período anterior (mesmo tamanho de janela)
      prisma.conversa.count({
        where: {
          lead: { tenantId },
          iniciadaEm: { gte: dataInicialAnterior, lt: dataInicial }
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
          status: { in: STATUS_QUALIFICACAO },
          atualizadoEm: { gte: dataInicial }
        }
      }),

      // Leads qualificados no período anterior
      prisma.lead.count({
        where: {
          tenantId,
          status: { in: STATUS_QUALIFICACAO },
          atualizadoEm: { gte: dataInicialAnterior, lt: dataInicial }
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
        conversas: formatarTendencia(totalConversas, totalConversasAnterior),
        qualificados: formatarTendencia(leadsQualificados, leadsQualificadosAnterior)
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
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;
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
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;
    const periodo = String(req.query.periodo || '7d');
    const diasAtras = getDiasPeriodo(periodo);
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - diasAtras);

    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const metricas = await prisma.metricaMensagem.findMany({
      where: {
        tenantId,
        processadoEm: { gte: dataInicial },
      },
      select: {
        workerUsado: true,
        acaoSupervisor: true,
        tempoProcessamentoMs: true,
        processadoEm: true,
      },
      orderBy: { processadoEm: 'desc' },
    });

    const agregados = new Map<string, {
      total: number;
      sucessos: number;
      tempoTotal: number;
      tempoContagem: number;
      ultimaExecucao: Date | null;
      interacoesHoje: number;
    }>();

    for (const metrica of metricas) {
      const worker = metrica.workerUsado || 'DESCONHECIDO';
      if (!agregados.has(worker)) {
        agregados.set(worker, {
          total: 0,
          sucessos: 0,
          tempoTotal: 0,
          tempoContagem: 0,
          ultimaExecucao: null,
          interacoesHoje: 0,
        });
      }

      const agg = agregados.get(worker)!;
      agg.total += 1;
      if (metrica.acaoSupervisor === 'ENVIAR' || metrica.acaoSupervisor === 'REFINAR') {
        agg.sucessos += 1;
      }
      if (typeof metrica.tempoProcessamentoMs === 'number') {
        agg.tempoTotal += metrica.tempoProcessamentoMs;
        agg.tempoContagem += 1;
      }
      if (!agg.ultimaExecucao || metrica.processadoEm > agg.ultimaExecucao) {
        agg.ultimaExecucao = metrica.processadoEm;
      }
      if (metrica.processadoEm >= inicioHoje) {
        agg.interacoesHoje += 1;
      }
    }

    const agora = Date.now();
    const workers = Array.from(agregados.entries()).map(([worker, agg]) => {
      const mediaMs = agg.tempoContagem > 0 ? agg.tempoTotal / agg.tempoContagem : 0;
      const taxaSucesso = agg.total > 0 ? Math.round((agg.sucessos / agg.total) * 100) : 0;
      const minutosDesdeUltimaExecucao = agg.ultimaExecucao
        ? (agora - agg.ultimaExecucao.getTime()) / (1000 * 60)
        : Infinity;
      const status = minutosDesdeUltimaExecucao <= 60 ? 'ativo' : 'ocioso';

      return {
        nome: `${worker} Worker`,
        status,
        conversasHoje: agg.interacoesHoje,
        tempoMedioResposta: `${(mediaMs / 1000).toFixed(1)}s`,
        taxaSucesso: `${taxaSucesso}%`,
        ultimaExecucao: agg.ultimaExecucao?.toISOString() || null
      };
    }).sort((a, b) => b.conversasHoje - a.conversasHoje);

    res.json({
      periodo: `${diasAtras} dias`,
      workers
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
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;
    
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
          status: { in: STATUS_QUALIFICACAO }
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
          status: 'CAPTADO'
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
 * GET /api/metricas-agentes/governanca
 * Endpoint curto para governança da qualificação:
 * - taxa de completude (COMPLETA vs PARCIAL)
 * - top faltantes críticos
 * - fila prioritária de leads parciais para revisão
 */
router.get('/governanca', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;
    const periodo = String(req.query.periodo || '7d');
    const diasAtras = getDiasPeriodo(periodo);
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - diasAtras);

    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        status: { in: STATUS_QUALIFICACAO },
        atualizadoEm: { gte: dataInicial }
      },
      select: {
        id: true,
        nome: true,
        status: true,
        temperatura: true,
        atualizadoEm: true,
        interesseEm: true,
        tipoImovel: true,
        areaImovel: true,
        ocupacaoImovel: true,
        valorPretendido: true,
        doresIdentificadas: true,
        situacaoAtual: true,
        motivacaoVenda: true,
        consequencias: true,
        custosAtuais: true,
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const total = leads.length;
    if (total === 0) {
      return res.json({
        periodo: `${diasAtras} dias`,
        resumo: {
          totalLeadsQualificacao: 0,
          completa: 0,
          parcial: 0,
          taxaCompletude: '0%',
          taxaParcial: '0%',
        },
        faltantesTop: [],
        filaPrioritaria: [],
      });
    }

    let completas = 0;
    let parciais = 0;
    const faltantesCount: Record<string, number> = {};
    const filaPrioritaria: Array<{
      leadId: string;
      nome: string;
      status: string;
      temperatura: string;
      atualizadoEm: Date;
      faltantes: string[];
    }> = [];

    for (const lead of leads) {
      const faltantes = camposCriticosFaltantes({
        interesseEm: lead.interesseEm,
        tipoImovel: lead.tipoImovel,
        areaImovel: lead.areaImovel,
        ocupacaoImovel: lead.ocupacaoImovel,
        valorPretendido: lead.valorPretendido,
        doresIdentificadas: lead.doresIdentificadas,
        situacaoAtual: lead.situacaoAtual,
        motivacaoVenda: lead.motivacaoVenda,
        consequencias: lead.consequencias,
        custosAtuais: lead.custosAtuais,
      });

      if (faltantes.length === 0) {
        completas += 1;
        continue;
      }

      parciais += 1;
      for (const campo of faltantes) {
        faltantesCount[campo] = (faltantesCount[campo] || 0) + 1;
      }

      filaPrioritaria.push({
        leadId: lead.id,
        nome: lead.nome,
        status: lead.status,
        temperatura: lead.temperatura,
        atualizadoEm: lead.atualizadoEm,
        faltantes,
      });
    }

    const percentualCompleta = Math.round((completas / total) * 100);
    const percentualParcial = 100 - percentualCompleta;
    const pesoTemperatura: Record<string, number> = { QUENTE: 3, MORNO: 2, FRIO: 1 };

    const faltantesTop = Object.entries(faltantesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([campo, quantidade]) => ({ campo, quantidade }));

    const filaPrioritariaOrdenada = filaPrioritaria
      .sort((a, b) => {
        const pa = pesoTemperatura[a.temperatura] || 0;
        const pb = pesoTemperatura[b.temperatura] || 0;
        if (pb !== pa) return pb - pa;
        return b.atualizadoEm.getTime() - a.atualizadoEm.getTime();
      })
      .slice(0, 10)
      .map(item => ({
        ...item,
        atualizadoEm: item.atualizadoEm.toISOString(),
      }));

    res.json({
      periodo: `${diasAtras} dias`,
      resumo: {
        totalLeadsQualificacao: total,
        completa: completas,
        parcial: parciais,
        taxaCompletude: `${percentualCompleta}%`,
        taxaParcial: `${percentualParcial}%`,
      },
      faltantesTop,
      filaPrioritaria: filaPrioritariaOrdenada,
    });
  } catch (error) {
    console.error('[Métricas] Erro ao buscar governança da qualificação:', error);
    responderErro(res, 500, 'Erro ao buscar dados de governança');
  }
});

/**
 * GET /api/metricas-agentes/governanca/trilha?leadId=<uuid>&limite=<n>
 * Trilha operacional da conversa/lead para auditoria de decisão:
 * - decisões de fase/status
 * - execução de tools (TOOL_EXEC)
 * - atualização de source_of_truth
 * - últimas mensagens da conversa
 */
router.get('/governanca/trilha', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;

    const leadId = String(req.query.leadId || '').trim();
    const limite = Math.min(100, Math.max(10, parseInt(String(req.query.limite || '50'), 10) || 50));

    if (!leadId) {
      return responderErro(res, 400, 'leadId é obrigatório');
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: {
        id: true,
        nome: true,
        status: true,
        temperatura: true,
        ultimaAcaoIA: true,
        ultimaAcaoIAEm: true,
        atualizadoEm: true,
        schemaState: true,
      }
    });

    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado');
    }

    const [atividades, mensagens] = await Promise.all([
      prisma.atividade.findMany({
        where: {
          leadId,
          OR: [
            { titulo: { startsWith: 'TOOL_EXEC:' } },
            { titulo: { contains: 'Lead qualificado' } },
            { titulo: { contains: 'Movido para' } },
          ]
        },
        orderBy: { criadoEm: 'desc' },
        take: limite,
        select: {
          id: true,
          tipo: true,
          titulo: true,
          descricao: true,
          criadoEm: true,
          completadoEm: true,
          criadoPor: true,
        }
      }),
      prisma.mensagem.findMany({
        where: {
          conversa: { leadId }
        },
        orderBy: { enviadaEm: 'desc' },
        take: Math.min(30, Math.floor(limite / 2)),
        select: {
          id: true,
          remetente: true,
          conteudo: true,
          enviadaEm: true,
          conversaId: true,
        }
      })
    ]);

    const eventosAtividades = atividades.map((a) => {
      const ehToolExec = a.titulo.startsWith('TOOL_EXEC:');
      const toolName = ehToolExec ? a.titulo.replace('TOOL_EXEC:', '').trim() : null;
      return {
        id: a.id,
        origem: 'atividade',
        tipo: ehToolExec ? 'tool_exec' : 'qualificacao',
        toolName,
        titulo: a.titulo,
        descricao: a.descricao,
        ator: a.criadoPor || 'sistema',
        timestamp: (a.completadoEm || a.criadoEm).toISOString(),
      };
    });

    const eventosMensagens = mensagens.map((m) => ({
      id: m.id,
      origem: 'mensagem',
      tipo: m.remetente === 'assistente' ? 'mensagem_agente' : 'mensagem_lead',
      conversaId: m.conversaId,
      ator: m.remetente,
      conteudo: m.conteudo,
      timestamp: m.enviadaEm.toISOString(),
    }));

    const eventosSistema = [];
    if (lead.ultimaAcaoIA && lead.ultimaAcaoIAEm) {
      eventosSistema.push({
        id: `ultima-acao-ia-${lead.id}`,
        origem: 'lead',
        tipo: 'fase_status',
        detalhe: lead.ultimaAcaoIA,
        timestamp: lead.ultimaAcaoIAEm.toISOString(),
      });
    }
    const lastSourceUpdateAt = obterLastSourceUpdateAt(lead.schemaState);
    if (lastSourceUpdateAt) {
      eventosSistema.push({
        id: `source-update-${lead.id}`,
        origem: 'schemaState',
        tipo: 'source_of_truth_update',
        detalhe: 'schemaState.fieldSources atualizado',
        timestamp: lastSourceUpdateAt,
      });
    }

    const timeline = [...eventosAtividades, ...eventosMensagens, ...eventosSistema]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limite);

    res.json({
      lead: {
        id: lead.id,
        nome: lead.nome,
        status: lead.status,
        temperatura: lead.temperatura,
        atualizadoEm: lead.atualizadoEm.toISOString(),
      },
      resumo: {
        totalEventos: timeline.length,
        toolsExecutadas: eventosAtividades.filter((e) => e.tipo === 'tool_exec').length,
        mensagensMapeadas: eventosMensagens.length,
        possuiTrilhaSourceOfTruth: Boolean(lastSourceUpdateAt),
      },
      timeline,
    });
  } catch (error) {
    console.error('[Métricas] Erro ao buscar trilha de governança:', error);
    responderErro(res, 500, 'Erro ao buscar trilha de governança');
  }
});

/**
 * GET /api/metricas-agentes/atividade-recente
 * Retorna últimas atividades dos agentes
 */
router.get('/atividade-recente', async (req: Request, res: Response) => {
  try {
    const tenantId = obterTenantIdOuResponder(req, res);
    if (!tenantId) return;
    
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
